const sdk = require('ask-sdk');

const handlers = {
    LaunchRequestHandler: {
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
    },
    HelloWorldIntentHandler: {
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
    }
};

function getSkill() {
    return sdk.SkillBuilders
        .custom()
        .addRequestHandlers(...handlers)
        .create();
}

module.exports = {
    getSkill
};
