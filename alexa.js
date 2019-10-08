const sdk = require('ask-sdk');
let alexaService;
let app;

const texts = {
    launch: {
        REQUIRED_LINK: () => `Welcome to uormusic dot info. To use this skill you have to link you account first. You can do that in skill settings in your Alexa app`,
        SUCCESS: () => `Welcome, nice to hear you again!`
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
        console.debug('Launched!');
        try {
            let speechText;
            const userId = alexaService.getUserId(handlerInput);
            if (!userId) {
                throw new Error(texts.launch.REQUIRED_LINK());
            }
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            sessionAttributes.current = {};
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            speechText = texts.launch.SUCCESS();
            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(speechText)
                .getResponse();
        } catch (err) {
            return alexaService.intentErrorHandler(handlerInput, err);
        }
    }
};

const OverviewHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Overview';
    },
    async handle(handlerInput) {
        try {
            const overview = await alexaService.overview(handlerInput.requestEnvelope.context.System.user.accessToken);
            if (!overview) {
                throw new Error(texts.overview.CANT_GET());
            }
            const speechText = texts.overview.BASIC(overview.playlists, overview.songs);
            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(speechText)
                .getResponse();
        } catch (err) {
            return alexaService.intentErrorHandler(handlerInput, err);
        }
    }
};
const CurrentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Current';
    },
    async handle(handlerInput) {
        try {
            const slotValues = alexaService.getSlotValues(handlerInput);
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            const userId = alexaService.getUserId(handlerInput);
            let speechText;
            if (userId && slotValues && slotValues.variable) {
                speechText = await alexaService.getCurrent(userId, slotValues.variable, sessionAttributes);
                return handlerInput.responseBuilder
                    .speak(speechText)
                    .reprompt(speechText)
                    .getResponse();
            }
        } catch (err) {
            return alexaService.intentErrorHandler(handlerInput, err);
        }
    }
};
const SearchHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Search';
    },
    async handle(handlerInput) {
        try {
            const slots = alexaService.getSlotValues(handlerInput);
            const userId = alexaService.getUserId(handlerInput);
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            sessionAttributes.found = await alexaService.search(userId, slots.searchQuery.resolved);;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            const speechText = texts.search.BASIC(sessionAttributes.found.name);
            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(speechText)
                .getResponse();
        } catch (err) {
            return alexaService.intentErrorHandler(handlerInput, err);
        }
    }
};
const SetHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Set';
    },
    async handle(handlerInput) {
        try {
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
                .getResponse();
        } catch (err) {
            return alexaService.intentErrorHandler(handlerInput, err);
        }
    }
};

const PauseHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PauseIntent';
    },
    async handle(handlerInput) {
        try {
            return handlerInput.responseBuilder
                .addAudioPlayerStopDirective()
                .withShouldEndSession(false)
                .getResponse();
        } catch (err) {
            return alexaService.intentErrorHandler(handlerInput, err);
        }
    }
};
const ResumeHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ResumeIntent';
    },
    async handle(handlerInput) {
        try {
            const speechText = 'Resume called';
            return handlerInput.responseBuilder
                .speak(speechText)
                .getResponse();
        } catch (err) {
            return alexaService.intentErrorHandler(handlerInput, err);
        }
    }
};
const PerformHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Perform';
    },
    async handle(handlerInput) {
        try {
            const userId = alexaService.getUserId(handlerInput);
            const slotValues = alexaService.getSlotValues(handlerInput);
            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            sessionAttributes.current = await alexaService.perform(userId, slotValues.variable.id, sessionAttributes);
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            return handlerInput.responseBuilder
                .addAudioPlayerPlayDirective(
                    'REPLACE_ALL',
                    sessionAttributes.current.stream.url,
                    sessionAttributes.current.stream.token,
                    0,
                    null
                )
                .getResponse();
        } catch (err) {
            return alexaService.intentErrorHandler(handlerInput, err);
        }
    }
};

const AudioPlayerEventHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type.startsWith('AudioPlayer.');
    },
    handle(handlerInput){
        console.log(handlerInput.requestEnvelope.request.type);
        /*
        console.log(handlerInput.requestEnvelope.request.offsetInMilliseconds);
        */
        return handlerInput.responseBuilder
            .getResponse();
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
    handle(handlerInput) {
        // Any cleanup logic goes here.
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
        console.log(`~~~~ Error handled: ${error.stack}`);
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
        .addRequestHandlers(
            LaunchRequestHandler,
            HelpIntentHandler,
            OverviewHandler,
            SearchHandler,
            CurrentHandler,
            SetHandler,
            PauseHandler,
            ResumeHandler,
            PerformHandler,
            AudioPlayerEventHandler,
            CancelAndStopIntentHandler,
            SessionEndedRequestHandler,
            FallbackIntentHandler,
            IntentReflectorHandler
        )
        .addErrorHandlers(
            ErrorHandler
        )
        .create();
};
