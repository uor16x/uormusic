const fs = require('fs');
const path = require('path');
const servicesPath = './service';

module.exports = app => {
    return fs.readdirSync(servicesPath)
        .filter(service => service !== 'index.js')
        .reduce((acc, service) => {
            acc[service.replace('.js', '')] = require(path.resolve(servicesPath, service))(app);
            return acc;
        }, {});
};
