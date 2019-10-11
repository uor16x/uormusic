const sdk = require('ask-sdk');
const s3Adapter = require('ask-sdk-s3-persistence-adapter');
const defaultAttrs = {
    playback: {
        loop: false,
        shuffle: false,
        nextStreamEnqueued: false
    },
    current: {
        song: null,
        playlist: null
    },
    saved: null
};
let alexaService;
let app;

const texts = {
    launch: {
        REQUIRED_LINK: () => `Welcome to uormusic dot info. To use this skill you have to link you account first. You can do that in skill settings in your Alexa app`,
        SUCCESS: () => `Welcome, nice to hear you again!`,
        REPROMPT: () => `You can say HELP to find out existing commands`
    },
    help: {
        BASIC: () => `Welcome to uormusic dot info. You can use the following commands: "Show me the library" or "Overview" - to get current music library summary; Search playlist name or Find playlist name to search for playlist number. For example: Search The Smiths. What is current - command for getting current state variable. You can get the following variables: song - to get the current song, playlist - to get current playlist name and its songs, library - to get current playlists. To set a playlist or a song use set command. For example: Set playlist number 2 or Set song number 5. For more details, please, contact the developer.`
    },
    fallback: {
        BASIC: () => `Sorry, I can\'t understand you`
    },
    cancelAndStop: {
        BASIC: () => `See ya later pal`
    },
    overview: {
        BASIC: (playlists, songs) => `Your music library have ${playlists} playlists with total of ${songs} songs.`,
        CANT_GET: () => `Sorry, can\'t get you library summary`
    },
    search: {
        BASIC: (name) => `Playlist called ${name} found. Say "Set found" to play`
    }
};

/**
 * Handlers
 */
const LaunchRequestHandler = {
    canHandle: function(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle: async function(handlerInput) {
        const userId = alexaService.getUserId(handlerInput);
        if (!userId) {
            return alexaService.intentErrorHandler(
                handlerInput,
                texts.launch.REQUIRED_LINK(),
                true
            )
        }
        return handlerInput.responseBuilder
            .speak(texts.launch.SUCCESS())
            .reprompt(texts.launch.REPROMPT())
            .getResponse();
    }
};

const OverviewHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Overview';
    },
    async handle(handlerInput) {
        const overview = await alexaService.overview(handlerInput);
        if (!overview) {
            return alexaService.intentErrorHandler(
                handlerInput,
                texts.overview.CANT_GET(),
                false
            );
        }
        const speechText = texts.overview.BASIC(overview.playlists, overview.songs);
        return handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(false)
            .getResponse();
    }
};
const CurrentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Current';
    },
    async handle(handlerInput) {
        const slotValues = alexaService.getSlotValues(handlerInput);
        const attrs = await handlerInput.attributesManager.getPersistentAttributes();
        const userId = alexaService.getUserId(handlerInput);
        let speechText;
        if (userId && slotValues && slotValues.variable) {
            speechText = await alexaService.getCurrent(userId, slotValues.variable, attrs);
            return handlerInput.responseBuilder
                .speak(speechText)
                .withShouldEndSession(false)
                .getResponse();
        }
    }
};
const SearchHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Search';
    },
    async handle(handlerInput) {
        const slots = alexaService.getSlotValues(handlerInput);
        const userId = alexaService.getUserId(handlerInput);

        const speechText = await alexaService.search(userId, slots.searchQuery.resolved);
        return handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(false)
            .getResponse();
    }
};
const SetHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Set';
    },
    async handle(handlerInput) {
        const { speechText, attrs } = await alexaService.set(handlerInput);
        if (attrs.current.song) {
            attrs.current.saved = null;
            return handlerInput.responseBuilder
                .speak(speechText)
                .addAudioPlayerPlayDirective(
                    'REPLACE_ALL',
                    attrs.current.song.url,
                    attrs.current.song.token,
                    0,
                    null
                )
                .withShouldEndSession(true)
                .getResponse();
        }
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withShouldEndSession(false)
            .getResponse();
    }
};

const PlaybackNearlyFinishedEventHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackNearlyFinished';
    },
    async handle(handlerInput){
        const {
            attributesManager,
            responseBuilder
        } = handlerInput;
        const attrs = await attributesManager.getPersistentAttributes();
        const nextSong = attrs.playback.loop ? attrs.current.song : alexaService.findNext(attrs);
        attrs.playback.nextStreamEnqueued = true;
        return responseBuilder
            .addAudioPlayerPlayDirective(
                'ENQUEUE',
                nextSong.url,
                nextSong.token,
                0,
                handlerInput.requestEnvelope.context.AudioPlayer.token
            )
            .getResponse();
    }
};
const PlaybackStartedEventHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackStarted';
    },
    async handle(handlerInput){
        const {
            attributesManager,
            responseBuilder
        } = handlerInput;
        const attrs = await attributesManager.getPersistentAttributes();
        attrs.playback.nextStreamEnqueued = false;
        if (attrs.current.song.token !== handlerInput.requestEnvelope.context.AudioPlayer.token) {
            const foundSong = attrs.current.playlist.songs
                .find(s => s._id.toString() === handlerInput.requestEnvelope.context.AudioPlayer.token);
            attrs.current.song = {
                url: `${app.env.mode === 'dev'
                    ? `${app.env.OUTSIDE_URL}/song/get`
                    : 'https://uormusic.info/song/get'}/${foundSong._id}`,
                title: foundSong.title,
                token: foundSong._id.toString(),
                expectedPreviousToken: attrs.current.song.token,
                offsetInMilliseconds: 0
            };
        }
        return responseBuilder.getResponse();
    }
};
const PauseHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PauseIntent';
    },
    async handle(handlerInput) {
        const attrs = await handlerInput.attributesManager.getPersistentAttributes();
        attrs.saved = Object.assign(attrs.current.song,
            { offsetInMilliseconds: handlerInput.requestEnvelope.context.AudioPlayer.offsetInMilliseconds });
        return handlerInput.responseBuilder
            .addAudioPlayerStopDirective()
            .withShouldEndSession(true)
            .getResponse();
    }
};
const ResumeHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ResumeIntent';
    },
    async handle(handlerInput) {
        const attrs = await handlerInput.attributesManager.getPersistentAttributes();
        attrs.current.song = attrs.saved;
        return handlerInput.responseBuilder
            .addAudioPlayerPlayDirective(
                'REPLACE_ALL',
                attrs.current.song.url,
                attrs.current.song.token,
                attrs.saved.offsetInMilliseconds,
                null
            )
            .withShouldEndSession(true)
            .getResponse();
    }
};
const NextHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent';
    },
    async handle(handlerInput) {
        const attrs = await handlerInput.attributesManager.getPersistentAttributes();
        attrs.current.song = alexaService.findNext(attrs);
        return handlerInput.responseBuilder
            .addAudioPlayerPlayDirective(
                'REPLACE_ALL',
                attrs.current.song.url,
                attrs.current.song.token,
                0,
                null
            )
            .withShouldEndSession(true)
            .getResponse();
    }
};
const PrevHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PreviousIntent';
    },
    async handle(handlerInput) {
        const attrs = await handlerInput.attributesManager.getPersistentAttributes();
        attrs.current.song = alexaService.findPrev(attrs);
        return handlerInput.responseBuilder
            .addAudioPlayerPlayDirective(
                'REPLACE_ALL',
                attrs.current.song.url,
                attrs.current.song.token,
                0,
                null
            )
            .withShouldEndSession(true)
            .getResponse();
    }
};
const LoopOnHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.LoopOnIntent';
    },
    async handle(handlerInput) {
        const attrs = await handlerInput.attributesManager.getPersistentAttributes();
        attrs.playback.loop = true;
        if (attrs.playback.nextStreamEnqueued) {
            return handlerInput.responseBuilder
                .speak('Loop turned on')
                .addAudioPlayerPlayDirective(
                    'ENQUEUE',
                    attrs.current.song.url,
                    attrs.current.song.token,
                    0,
                    attrs.current.song.token
                )
                .withShouldEndSession(true)
                .getResponse();
        }
        return handlerInput.responseBuilder
            .speak('Loop turned on')
            .withShouldEndSession(true)
            .getResponse();
    }
};
const LoopOffHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.LoopOffIntent';
    },
    async handle(handlerInput) {
        const attrs = await handlerInput.attributesManager.getPersistentAttributes();
        attrs.playback.loop = false;
        const nextSong = alexaService.findNext(attrs);
        if (attrs.playback.nextStreamEnqueued) {
            return responseBuilder
                .speak('Loop turned off')
                .withShouldEndSession(true)
                .addAudioPlayerPlayDirective(
                    'ENQUEUE',
                    nextSong.url,
                    nextSong.token,
                    0,
                    handlerInput.requestEnvelope.context.AudioPlayer.token
                )
                .getResponse();
        }
        return handlerInput.responseBuilder
            .speak('Loop turned off')
            .withShouldEndSession(true)
            .getResponse();
    }
};
const StartOverHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StartOverIntent';
    },
    async handle(handlerInput) {
        const attrs = await handlerInput.attributesManager.getPersistentAttributes();
        return handlerInput.responseBuilder
            .addAudioPlayerPlayDirective(
                'REPLACE_ALL',
                attrs.current.song.url,
                attrs.current.song.token,
                0,
                null
            )
            .withShouldEndSession(true)
            .getResponse();
    }
};

const PersistenceRequestInterceptor = {
    async process(handlerInput) {
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        // console.log(`In PRI: attrs: ${JSON.stringify(persistentAttributes)}`);
        if (Object.keys(persistentAttributes).length === 0) {
            handlerInput.attributesManager.setPersistentAttributes(Object.assign({}, defaultAttrs));
        }
    }
};
const PersistenceResponseInterceptor = {
    async process(handlerInput) {
        await handlerInput.attributesManager.savePersistentAttributes();
    },
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = texts.help.BASIC();
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        handlerInput.attributesManager.setPersistentAttributes(Object.assign({}, defaultAttrs));
        const speakOutput = texts.cancelAndStop.BASIC();
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .addAudioPlayerStopDirective()
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    async handle(handlerInput) {
        return handlerInput.responseBuilder.getResponse();
    }
};
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speechText = texts.fallback.BASIC();
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = handlerInput.requestEnvelope.request.intent.name;
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        if (error.name !== 'AskSdk.GenericRequestDispatcher Error' && error.name !== 'AskSdk.AttributesManager Error') {
            console.log(`~~~~ Error handled: ${error.stack}`);
        }
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

module.exports = _app => {
    app = _app;
    alexaService = require('./alexa.service')(_app);
    return sdk.SkillBuilders
        .custom()
        .withSkillId(app.env.ALEXA_SKILL_ID)
        .addRequestHandlers(
            LaunchRequestHandler,
            HelpIntentHandler,
            OverviewHandler,
            SearchHandler,
            CurrentHandler,
            SetHandler,
            PauseHandler,
            ResumeHandler,
            NextHandler,
            PrevHandler,
            LoopOnHandler,
            LoopOffHandler,
            StartOverHandler,
            PlaybackNearlyFinishedEventHandler,
            PlaybackStartedEventHandler,
            CancelAndStopIntentHandler,
            SessionEndedRequestHandler,
            FallbackIntentHandler,
            IntentReflectorHandler
        )
        .addRequestInterceptors(PersistenceRequestInterceptor)
        .addResponseInterceptors(PersistenceResponseInterceptor)
        .withPersistenceAdapter(new s3Adapter.S3PersistenceAdapter({
            bucketName: app.env.S3_BUCKET
        }))
        .addErrorHandlers(
            ErrorHandler
        )
        .create();
};
