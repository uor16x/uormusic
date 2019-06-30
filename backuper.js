const fs = require('fs');
const mongoose = require('mongoose');
const bluebird = require('bluebird');
const models = require('./model')();
const { zip } = require('zip-a-folder');
const unzip = require('node-unzip-2');
const empty = require('empty-folder');
const args = process.argv;

const modeArg = args.find(arg => arg.indexOf('--mode=') > -1);
if (!modeArg) {
    console.error('Error!\nProvide mode: --mode=backup|restore');
    process.exit(1);
}
const mode = modeArg.replace('--mode=', '');
if (mode !== 'backup' && mode !== 'restore') {
    console.error('Error!\nWrong mode!\nModes: backup|restore');
    process.exit(1);
}

const hostArg = args.find(arg => arg.indexOf('--host=') > -1);
if (!hostArg) {
    console.error('Error!\nProvide host: --host=localhost/mydb');
    process.exit(1);
}
const host = hostArg.replace('--host=', '');

if (mode === 'backup') {
    backup();
}
if (mode === 'restore') {
    restore();
}

function connect() {
    return mongoose.connect(`mongodb://${host}`, { useNewUrlParser: true })
        .then(() => console.log('Successfully connected to db'));
}

function backup() {
    const name = Date.now().toString();
    connect()
        .then(() => bluebird.props({
            user: models.user.find({}),
            playlist: models.playlist.find({}),
            song: models.song.find({}),
            file: models.file.find({})
        }))
        .then(dump => bluebird.promisify(fs.writeFile)(`./backup/${name}.json`, JSON.stringify(dump)))
        // .then(() => zip('./store', `./backup/${name}.zip`)) ZIP
        .then(() => console.log('Backup created'))
        .catch(err => {
            console.error(err);
            return process.exit(1);
        });
}

function restore() {
    let name;
    connect()
        .then(() => bluebird.props({
            user: models.user.deleteMany({}),
            playlist: models.playlist.deleteMany({}),
            song: models.song.deleteMany({}),
            file: models.file.deleteMany({})
        }))
        .then(() => bluebird.promisify(fs.readdir)('./backup'))
        .then(backupDir => {
            console.log('DB cleaned');
            backupDir.sort((a, b) => parseInt(b.replace('.json', '')) - parseInt(a.replace('.json', '')));
            name = backupDir[0].replace('.json', '');
            return bluebird.promisify(fs.readFile)(`./backup/${backupDir[0]}`)
        })
        .then(dump => {
            dump = JSON.parse(dump);
            console.log('Dump parsed');
            return bluebird.all([
                models.user.create(dump.user),
                models.playlist.create(dump.playlist),
                models.song.create(dump.song),
                models.file.create(dump.file),
            ]);
        }).then(() => console.log('Restore finished'))
        /*.then(() => {
            console.log('Data restored');
            return new Promise((resolve, reject) => {
                empty('./store', false, result => {
                    if (result.error) {
                        return reject(result.error);
                    }
                    console.log('Store cleared');
                    return resolve();
                });
            });
        })
        .then(() => {
            const fileWrite = fs.createReadStream(`./backup/${name}.zip`);
            const fileUnzip = unzip.Extract({ path: './store' });
            fileUnzip.on('finish', () => console.log('Backup restored'));
            fileWrite.pipe(fileUnzip);
        })*/
        .catch(err => {
            console.error(err);
            return process.exit(1);
        });
}
