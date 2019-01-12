const fs = require('fs');
const path = require('path');
const modelsPath = './model';

module.exports = () => {
    return fs.readdirSync(modelsPath)
        .filter(model => model !== 'index.js')
        .reduce((acc, model) => {
            acc[model.replace('.js', '')] = require(path.resolve(modelsPath, model));
            return acc;
        }, {});
};
