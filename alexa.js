const sdk = require('ask-sdk');

/**
 * Handlers
 */
const LaunchRequestHandler = {
    canHandle: function(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle: function(handlerInput) {
        const userId = handlerInput.requestEnvelope.context.System.user.accessToken;
        const speechText = userId ? `Your user id is: ${userId}` : 'Cant find user id';
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

module.exports = () => sdk.SkillBuilders
    .custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        HelloWorldIntentHandler
    )
    .create();;
