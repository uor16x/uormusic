const sdk = require('ask-sdk');
let app;

/**
 * Handlers
 */
const LaunchRequestHandler = {
    canHandle: function(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle: async function(handlerInput) {
        let speechText;
        const userId = handlerInput.requestEnvelope.context.System.user.accessToken;
        if (userId) {
            const currentUser = await app.services.user.get({ _id: userId });
            speechText = currentUser ? `Hello, ${currentUser.username}` : 'Cant find user';
        } else {
            speechText =  'User id is missing';
        }
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Hello World', speechText)
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
