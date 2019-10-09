const sdk = require('ask-sdk');
const s3Adapter = require('ask-sdk-s3-persistence-adapter');
let alexaService;
let app;

const texts = {
    launch: {
        REQUIRED_LINK: () => `Welcome to uormusic dot info. To use this skill you have to link you account first. You can do that in skill settings in your Alexa app`,
        SUCCESS: () => `Welcome, nice to hear you again!`,
        REPROMPT: () => `You can say HELP to find out existing commands`
    },
    help: {
        BASIC: () => `This is the helptext. Currently in development, sorry`
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
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const userId = alexaService.getUserId(handlerInput);
        let speechText;
        if (userId && slotValues && slotValues.variable) {
            speechText = await alexaService.getCurrent(userId, slotValues.variable, sessionAttributes);
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
        const { speechText, session } = await alexaService.set(handlerInput);
        return handlerInput.responseBuilder
            .speak(speechText)
            .addAudioPlayerPlayDirective(
                'REPLACE_ALL',
                session.current.song.url,
                session.current.song.token,
                0,
                null
            )
            .withShouldEndSession(true)
            .getResponse();
    }
};

const AudioPlayerEventHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackNearlyFinished';
    },
    async handle(handlerInput){
        const {
            attributesManager,
            responseBuilder
        } = handlerInput;
        const persistentAttributes = await attributesManager.getPersistentAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes();
        sessionAttributes.current.song = alexaService.findNext(persistentAttributes);
        attributesManager.setSessionAttributes(sessionAttributes);

        return responseBuilder
            .addAudioPlayerPlayDirective(
                'ENQUEUE',
                sessionAttributes.current.song.url,
                sessionAttributes.current.song.token,
                0,
                persistentAttributes.current.song.token
            )
            .getResponse();
    }
};
const PauseHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PauseIntent';
    },
    async handle(handlerInput) {
        const session = handlerInput.attributesManager.getSessionAttributes();
        session.savedSong = Object.assign(session.current.song,
            { offsetInMilliseconds: handlerInput.requestEnvelope.context.AudioPlayer.offsetInMilliseconds });
        handlerInput.attributesManager.setSessionAttributes(session);
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
        const session = handlerInput.attributesManager.getSessionAttributes();
        session.current.song = session.savedSong;
        return handlerInput.responseBuilder
            .addAudioPlayerPlayDirective(
                'REPLACE_ALL',
                session.current.song.url,
                session.current.song.token,
                session.savedSong.offsetInMilliseconds,
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
        const session = handlerInput.attributesManager.getSessionAttributes();
        session.current.song = alexaService.findNext(session);
        return handlerInput.responseBuilder
            .addAudioPlayerPlayDirective(
                'REPLACE_ALL',
                session.current.song.url,
                session.current.song.token,
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
        const session = handlerInput.attributesManager.getSessionAttributes();
        session.current.song = alexaService.findPrev(session);
        return handlerInput.responseBuilder
            .addAudioPlayerPlayDirective(
                'REPLACE_ALL',
                session.current.song.url,
                session.current.song.token,
                0,
                null
            )
            .withShouldEndSession(true)
            .getResponse();
    }
};

const PersistenceRequestInterceptor = {
    async process(handlerInput) {
        if(handlerInput.requestEnvelope.session && handlerInput.requestEnvelope.session['new']) {
            console.log('Into new session process #1');
            const attrs = await handlerInput.attributesManager.getPersistentAttributes();
            console.log('Attrs read => ' + JSON.stringify(attrs));
            handlerInput.attributesManager.setSessionAttributes(attrs);
            console.log('Attrs set');
        }
    }
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
        let sessionAttrs = handlerInput.attributesManager.getSessionAttributes();
        console.log('Session end; Session attrs => ' + JSON.stringify(sessionAttrs));
        handlerInput.attributesManager.setPersistentAttributes(sessionAttrs);
        await handlerInput.attributesManager.savePersistentAttributes();
        console.log('Persistent attrs set & saved');
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
            AudioPlayerEventHandler,
            CancelAndStopIntentHandler,
            SessionEndedRequestHandler,
            FallbackIntentHandler,
            IntentReflectorHandler
        )
        .addRequestInterceptors(PersistenceRequestInterceptor)
        .withPersistenceAdapter(new s3Adapter.S3PersistenceAdapter({
            bucketName: app.env.S3_BUCKET
        }))
        .addErrorHandlers(
            ErrorHandler
        )
        .create();
};
