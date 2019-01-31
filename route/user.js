const router = require('express').Router();
const ObjectId = require('mongoose').Types.ObjectId;
const path = require('path');

module.exports = app => {

    router.get('/shared/:type/:id', async (req, res) => {
        if (!req.params.type) {
            return res.result('Type missing');
        }
        if (!req.params.id) {
            return res.result('Id missing');
        }

        if (req.params.type === 's') {
            try {
                const song = await app.services.song.get({ _id: req.params.id }, false, ['file']);
                if (!song) {
                    return res.result('So such song');
                }
                return res.result(null, [song]);
            } catch (err) {
                return res.result(err.message);
            }
        } else if (req.params.type === 'm') {

        } else {
            return res.result('Wrong type');
        }
    });

    /**
     * Get background
     */
    router.get('/background/:file', async (req, res) => {
        if (!req.params.file) {
            return res.result('Missing file');
        }
        const filePath = path.resolve(`./store/${req.params.file}`);
        return res.sendFile(filePath);
    });

    router.put('/background', async (req, res) => {
        const currUser = await app.services.user.get({
            _id: req.session.user._id
        });
        currUser.backgroundToggle = !currUser.backgroundToggle;
        await currUser.save();
        return res.result(null);
    });

    router.post('/background', app.upload.single('background'), async (req, res) => {
        if (!req.file) {
            return res.result('Error uploading file');
        }
        const currUser = await app.services.user.get({
            _id: req.session.user._id
        });
        currUser.background = req.file.filename;
        currUser.backgroundToggle = true;
        await currUser.save();
        return res.result(null);
    });

    /**
     * Get user
     */
    router.get('/', async (req, res) => {
        if (req.session.auth) {
            const currentUser = await app.services.user.get({ _id: req.session.user._id }, false, ['playlists']);
            if (!currentUser) {
                return res.result('Error getting current user, even though he is authorized');
            }
            currentUser.playlists = currentUser.playlists.map(async _id => await app.services.playlist.get({ _id }));
            currentUser.password = undefined;
            return res.result(null, currentUser);
        }
        return res.result(null, null);
    });

    /**
     * Sign in / Sign up
     */
    router.post('/', async (req, res) => {
        if (!req.body.username) {
            return res.result('Username missing');
        }
        if (!req.body.password) {
            return res.result('Password missing');
        }
        let currUser;
        const findUser = await app.services.user.get({ username: req.body.username }, false, ['playlists']);
        if (!findUser) {
            /**
             * Sign up
             */
            const newUser = await app.services.user.create(req.body.username, req.body.password);
            if (!newUser) {
                return res.result('Error create user')
            }
            newUser.password = undefined;
            currUser = newUser;
        } else {
            /**
             * Sign in
             */
            const passwordMatch = await app.services.user.verifyPassword(req.body.password, findUser.password);
            if (!passwordMatch) {
                return res.result('Wrong password')
            }
            findUser.playlists = findUser.playlists.map(async _id => await app.services.playlist.get({ _id }));
            findUser.password = undefined;
            currUser = findUser;
        }
        req.session.auth = true;
        req.session.user = currUser;
        return res.result(null, currUser);
    });

    /**
     * Logout
     */
    router.delete('/', (req, res) => {
        req.session.auth = false;
        req.session.user = null;
        return res.result(null);
    });

    /**
     * Playlists order
     */
    router.put('/', async (req, res) => {
        const currentUser = await app.services.user.get({ _id: req.session.user._id });
        if (!currentUser) {
            return res.result('Error getting current user');
        }
        if (req.body.playlists) {
            currentUser.playlists = req.body.playlists;
        }
        if (typeof req.body.lastFMToggle === 'boolean') {
            currentUser.lastFMToggle = req.body.lastFMToggle;
        }
        await currentUser.save();
        return res.result(null);
    });

    return router;
};



