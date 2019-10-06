const sdk = require('ask-sdk');
let app;

const texts = {
    launch: {
        REQUIRED_LINK: () => `Welcome to uormusic dot info. To use this skill you have to link you account first. You can do that in skill settings in your Alexa app`,
        USER_NOT_FOUND: () => `Sorry, I can\'t find such user. Perhaps, it was deleted from the database. Contact the site support to resolve this issue.`,
        SUCCESS: (username) => `Welcome, ${username}! Nice to hear you again!`
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
            const currentUser = await app.services.user.get({ _id: userId });
            if (!currentUser) {
                throw new Error(texts.launch.USER_NOT_FOUND());
            }
            speechText = texts.launch.SUCCESS(currentUser.username);
        } catch (err) {
            speechText = err.message;
            response.withShouldEndSession(true);
        }
        return response
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};
const HelloWorldIntentHandler =  {
        canHandle: function(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'HelloWorldIntent';
    },
    handle: function(handlerInput) {
    const speechText = 'Hello World!';
    const stream = {
        url: 'https://uormusic.info/song/get/5d94b563c4d11759f3a766dd',
        token: "0", // Unique token for the track - needed when queueing multiple tracks
        expectedPreviousToken: null, // The expected previous token - when using queues, ensures safety
        offsetInMilliseconds: 0
    }
    return handlerInput.responseBuilder
        .speak(speechText)
        // .addAudioPlayerPlayDirective('REPLACE_ALL', stream.url, stream.token, 0, null)
        .getResponse();
}
};

module.exports = _app => {
    app = _app;
    return sdk.SkillBuilders
        .custom()
        .addRequestHandlers(
            LaunchRequestHandler,
            HelloWorldIntentHandler
        )
        .create();
};
