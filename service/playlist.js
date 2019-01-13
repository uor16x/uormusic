const _ = require('lodash');
let app;
let model;

const service = {
    create: async name => {
        const newPlaylist = new model({
            name,
            songs: []
        });
        return newPlaylist.save();
    },
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
    model = app.models.playlist;
    return service;
};


