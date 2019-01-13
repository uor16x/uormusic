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
const uuid = require('node-uuid');

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

    /**
     * Multer
     */
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, path.join('./store/'))
        },
        filename: (req, file, cb) => {
            cb(null, uuid.v4())
        }
    });
    app.upload = multer({storage: storage});

    /**
     * Public
     */
    app.use('/node_modules', express.static('node_modules'));
    app.use(express.static('public'));
    app.get('/view', (req, res) => res.sendFile('music.html', { root: __dirname + '/public' }));
    app.use((req, res, next) => {
        next();
    });
    app.use(bodyParser.json({limit: '100mb', extended: false}));

    /**
     * Custom middlewares
     */
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
    app.listen(app.env.PORT, () => {
        console.log('Server started');
    });
}

