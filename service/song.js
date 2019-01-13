const _ = require('lodash');
let app;
let model;

const service = {
    get: async (filter, multiple, populationArr) => {
        const query = multiple ? model.find(filter) : model.findOne(filter);
        return populationArr ? populationArr.reduce((acc, item) => {
            acc = acc.populate(item);
            return acc;
        }, query) : query;
    }
};

module.exports = _app => {
    app = _app;
    model = app.models.song;
    return service;
};


