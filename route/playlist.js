const router = require('express').Router();

module.exports = app => {
    /**
     * Create
     */
    router.post('/', async (req, res) => {
        if (!req.body.name) {
            return res.result('Username missing');
        }
        const newPlaylist = await app.services.playlist.create(req.body.name);
        if (!newPlaylist) {
            return res.result('Error creating playlist');
        }
        const currentUser = await app.services.user.get({ _id: req.session.user._id }, false, ['playlists']);
        if (!currentUser) {
            return res.result('Error getting current user');
        }
        currentUser.playlists.push(newPlaylist);
        await currentUser.save();
        return res.result(null, currentUser.playlists);
    });

    /**
     * Edit
     */
    router.put('/:id', async (req, res) => {
        if (!req.params.id) {
            return res.result('Id missing');
        }
        const currPlaylist = await app.services.playlist.get({ _id: req.params.id });
        if (!currPlaylist) {
            return res.result('No such playlist');
        }
        if (req.body.name) {
            currPlaylist.name = req.body.name;
        }
        if (req.body.songs) {
            currPlaylist.songs = req.body.songs;
        }
        await currPlaylist.save();
        return res.result(null, currPlaylist);
    });

    /**
     * Get
     */
    router.get('/:id', async (req, res) => {
        if (!req.params.id) {
            return res.result('Playlist id missing');
        }
        const currentUser = await app.services.user.get({ _id: req.session.user._id });
        if (!currentUser) {
            return res.result('Error getting current user');
        }
        const IDs = currentUser.playlists.map(p => p._id.toString());
        if (IDs.indexOf(req.params.id) === -1) {
            return res.result('You\'re not the owner');
        }
        const currPlist = await app.services.playlist.get({ _id: req.params.id }, false, ['songs']);
        if (!currPlist) {
            return res.result('Error getting playlist');
        }
        return res.result(null, currPlist.songs);
    });

    /**
     * Delete
     */
    router.delete('/:id', async (req, res) => {
        if (!req.params.id) {
            return res.result('Playlist id missing');
        }
        const currentUser = await app.services.user.get({ _id: req.session.user._id }, false, ['playlists']);
        if (!currentUser) {
            return res.result('Error getting current user');
        }
        const IDs = currentUser.playlists.map(p => p._id.toString());
        if (IDs.indexOf(req.params.id) === -1) {
            return res.result('You\'re not the owner');
        }
        const currPlist = await app.services.playlist.get({ _id: req.params.id });
        if (!currPlist) {
            return res.result('Error getting playlist');
        }

        await app.services.song.remove(currPlist.songs);
        await currPlist.remove();
        currentUser.playlists = currentUser.playlists.filter(p => p._id.toString() !== req.params.id);
        await currentUser.save();

        return res.result(null, currentUser.playlists);
    });

    return router;
};



