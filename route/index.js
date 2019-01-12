const fs = require('fs');
const path = require('path');
const routesPath = './route';

module.exports = app => {
    return fs.readdirSync(routesPath)
        .filter(route => route !== 'index.js')
        .reduce((acc, route) => {
            acc[route.replace('.js', '')] = require(path.resolve(routesPath, route))(app);
            return acc;
        }, {});
};
