const sdk = require('ask-sdk');

/**
 * Handlers
 */
const LaunchRequestHandler = {
        canHandle: function(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle: function(handlerInput) {
    const speechText = 'Welcome to the Alexa Skills Kit, you can say hello!';
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
    return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('Hello World', speechText)
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
