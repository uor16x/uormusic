const router = require('express').Router();
const atob = require('atob');
const path = require('path');

module.exports = app => {

    router.get('/shared/:ids', async (req, res) => {
        if (!req.params.ids) {
            return res.result('Ids missing');
        }
        const ids = atob(decodeURIComponent(req.params.ids)).split(',');
        try {
            const songs = await app.services.song.get({ _id: ids }, true, ['file']);
            if (!songs) {
                return res.result('So such song');
            }
            songs.reverse();
            return res.result(null, songs);
        } catch (err) {
            return res.result(err.message);
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



