const sdk = require('ask-sdk');
let alexaService;
let app;

/**
 * .addAudioPlayerPlayDirective('REPLACE_ALL', stream.url, stream.token, 0, null)
 const stream = {
        url: 'https://uormusic.info/song/get/5d94b563c4d11759f3a766dd',
        token: "0", // Unique token for the track - needed when queueing multiple tracks
        expectedPreviousToken: null, // The expected previous token - when using queues, ensures safety
        offsetInMilliseconds: 0
    }

 */

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
        BASIC: (playlists, songs) => `Your music library have ${playlists} playlists with total of ${songs} songs`
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
        const response = handlerInput.responseBuilder;
        let speechText;
        try {
            const userId = handlerInput.requestEnvelope.context.System.user.accessToken;
            if (!userId) {
                throw new Error(texts.launch.REQUIRED_LINK());
            }

            speechText = texts.launch.SUCCESS();
            return response
                .speak(speechText)
                .reprompt(speechText)
                .getResponse();
        } catch (err) {
            speechText = err.message;
            return response
                .speak(speechText)
                .withShouldEndSession(true)
                .getResponse();
        }
    }
};

const OverviewHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'Overview';
    },
    async handle(handlerInput) {
        const overview = await alexaService.overview(handlerInput.requestEnvelope.context.System.user.accessToken);
        const speechText = texts.overview.BASIC(overview.playlists, overview.songs);
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
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
