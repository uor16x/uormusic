const router = require('express').Router();

module.exports = app => {

    router.get('/cb', (req, res) => {
        if (req.query.socketId && req.query.token) {
            global.sockets[req.query.socketId].emit('lastfm:access', {});
            app.lastFM.authenticate(req.query.token, async (err, session) => {
                if (err) {
                    return res.result(err.message);
                }
                const currUser = await app.services.user.get({
                    _id: req.session.user._id
                });
                currUser.lastFMUsername = session.username;
                currUser.lastFMKey = session.key;
                currUser.lastFMToggle = true;
                await currUser.save();
                global.sockets[req.query.socketId].emit('lastfm:auth', {});
                return res.result(null);
            });
        } else {
            return res.result(null);
        }
    });

    router.get('/scrobble/:songId', async (req, res) => {
        if (!req.params.songId) {
            return res.result('Song Id missing');
        }
        const currUser = await app.services.user.get({
            _id: req.session.user._id
        });
        if (!currUser) {
            return res.result('Error getting current user');
        }
        if (!currUser.lastFMUsername || !currUser.lastFMKey) {
            return res.result('LastFM Auth missing');
        }
        const currSong = await app.services.song.get({_id: req.params.songId });
        if (!currSong) {
            return res.result('No such song');
        }
        const splittedSongname = currSong.title.split('-');
        let artist = splittedSongname.length > 1 ? splittedSongname[0] : 'Unknown Artist';
        let songname = splittedSongname.length > 1 ? splittedSongname[1] : splittedSongname[0];
        app.lastFM.setSessionCredentials(currUser.lastFMUsername, currUser.lastFMKey);
        app.lastFM.track.scrobble({
            'artist': artist,
            'track': songname,
            'timestamp': Math.floor((new Date()).getTime() / 1000) - 30
        }, (err, scrobbles) => {
            if (err) {
                return res.result(err.message);
            }
            return res.result(null);
        });
    });

    router.get('/:socketId', (req, res) => {
        const socketId = req.params.socketId;
        if (!socketId) {
            return res.result('Socket id missing');
        }
        const link = app.lastFM.getAuthenticationUrl({ 'cb' : `${app.env.HOST}lfm/cb/?socketId=${socketId}&` });
        return res.result(null, link);
    });

    return router;
};



