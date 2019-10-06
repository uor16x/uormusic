/**
 * Modules
 */
const dotenv = require('dotenv-safe');
const session = require('express-session');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const lastfmapi = require('lastfmapi');
const uuid = require('node-uuid');
const http = require('http');
const Alexa = require('./alexa');

process.on('uncaughtException', err => {
    console.log('Caught exception: ' + err);
});
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
process.env['FFMPEG_PATH'] = ffmpegPath;
process.env['FFPROBE_PATH'] = ffmpegPath;

/**
 * Dotenv
 */
dotenv.config();
const app = express();
app.env = process.env;

/**
 * DB
 */
mongoose.connect(`mongodb://${app.env.DB_CONNECTION}`, { useNewUrlParser: true }, err => {
    if (err) {
        console.error(err);
        return process.exit(1);
    }
    console.log('Successfully connected to db');

    configureApp(app);
});

/**
 * Config
 * @param app
 */
function configureApp(app) {
    /**
     * Session && other
     */
    app.set('trust proxy', 1) ;
    app.use(session({
        secret: app.env.COOKIES_SECRET,
        resave: true,
        saveUninitialized: true,
        cookie: { secure: false }
    }));
    app.lastFM = new lastfmapi({
        'api_key' : app.env.LFM_API_KEY,
        'secret' : app.env.LFM_SECRET
    });
    global.sockets = {};

    /**
     * Multer
     */
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, path.join('./store/'))
        },
        filename: (req, file, cb) => {
            cb(null,
                `${uuid.v4()}${file.mimetype.indexOf('image') > -1 ?
                    file.originalname.substr(file.originalname.length - 4):
                    ''}`)
        }
    });
    app.upload = multer({storage: storage});

    /**
     * Public
     */
    app.use('/node_modules', express.static('node_modules'));
    app.use(express.static('public'));
    app.get('/', (req, res) => {
        console.log(req.params);
        console.log(req.originalUrl);
        return res.sendFile('music.html', { root: __dirname + '/public' });
    });
    app.get('/shared', (req, res) => {
        res.sendFile('shared.html', { root: __dirname + '/public' });
    });
    app.use((req, res, next) => {
        next();
    });
    app.use(bodyParser.json({limit: '100mb', extended: false}));

    /**
     * Alexa
     */
    app.alexaSkill = Alexa();
    app.post('/alexa', (req, res) => {
        app.alexaSkill.invoke(req.body)
            .then(responseBody => res.json(responseBody))
            .catch((error) => {
                console.log(error);
                return res.status(500).send('Error during the request');
            });
    });

    /**
     * Custom middlewares
     */
    app.use((req, res, next) => {
        if (req.session.auth) {
            return next();
        }
        if ((req.originalUrl === '/user' && req.method !== 'PUT') ||
            req.originalUrl.indexOf('/lfm/cb') > -1 ||
            req.originalUrl.indexOf('/song/get') > -1 ||
            req.originalUrl.indexOf('/song/vkmp3') > -1 ||
            req.originalUrl.indexOf('/user/shared') > -1 ) {
            return next();
        }
        return res.status(401).end();
    });
    app.use((req, res, next) => {
        res.result = function (err, data) {
            if (err) {
                const errObj = new Error(err);
                console.error(errObj);
                res.status(400).json(err);
            }
            return data ? res.json(data): res.end();
        };
        return next();
    });

    /**
     * Routes && services && models
     */
    app.models = require('./model')();
    const routes = require('./route')(app);
    for (const routeName in routes) {
        if (routes.hasOwnProperty(routeName)) {
            app.use(`/${routeName}`, routes[routeName]);
            console.info(`${routeName} router attached!`);
        }
    }
    app.services = require('./service')(app);

    if (app.env.MODE === 'dev') {
        const server = require('http').Server(app);
        const io = require('socket.io')(server);
        io.on('connection', function (socket) {
            global.sockets[socket.id] = socket;
            socket.on('disconnect', () => {
                global.sockets[socket.id] = undefined;
            });
        });
        server.listen(app.env.PORT, () => {
            console.log('Server started');
        });
    } else {
        const privateKey = fs.readFileSync('/root/files/private.key', 'utf8');
        const certificate = fs.readFileSync('/root/files/certificate.crt', 'utf8');
        const ca = fs.readFileSync('/root/files/ca_bundle.crt', 'utf8');
        const credentials = {
            key: privateKey,
            cert: certificate,
            ca: ca
        };
        const httpsServer = require('https').createServer(credentials, app);
        const io = require('socket.io')(httpsServer);
        io.on('connection', function (socket) {
            global.sockets[socket.id] = socket;
            socket.on('disconnect', () => {
                global.sockets[socket.id] = undefined;
            });
        });
        httpsServer.listen(app.env.PORT);
        http.createServer(function (req, res) {
            res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
            res.end();
        }).listen(80);
    }

}

