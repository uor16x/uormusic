const _ = require('lodash');
const fs = require('fs');
let app;
let model;

const service = {
    get: async (filter, multiple, populationArr) => {
        const query = multiple ? model.find(filter) : model.findOne(filter);
        return populationArr ? populationArr.reduce((acc, item) => {
            acc = acc.populate(item);
            return acc;
        }, query) : query;
    },
    remove: async IDs => {
        const songs = await app.services.song.get({ _id: IDs }, true, ['file']);
        songs.forEach(async song => {
            fs.unlink(song.file.path, err => err && console.error(err));
            await song.file.remove();
            await song.remove();
        });
    }
};

module.exports = _app => {
    app = _app;
    model = app.models.song;
    return service;
};


