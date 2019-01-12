const _ = require('lodash');
const hasher = require('password-hash-node');
let app;
let model;

const service = {
    create: async (username, password) => {
        const newUser = new model({
            username,
            password: await hasher.create(password, 'SSHA')
        });
        return newUser.save();
    },
    get: async (filter, multiple, populationArr) => {
        const query = multiple ? model.find(filter) : model.findOne(filter);
        return populationArr ? populationArr.reduce((acc, item) => {
            acc = acc.populate(item);
            return acc;
        }, query) : query;
    },
    verifyPassword: async (password, hash) => hasher.verify(password, hash)
};

module.exports = _app => {
    app = _app;
    model = app.models.user;
    return service;
};


