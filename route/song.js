const router = require('express').Router();
const path = require('path');

module.exports = app => {

    router.post('/:id', app.upload.array("songs[]", 30), async (req, res) => {
        const songs = await req.files
            .map(file => {
                const fileObject = new app.models.file({
                    path: file.path
                });
                fileObject.save(err => {
                    return err ? console.error(err) : null;
                });
                return {
                    title: file.originalname.replace('.mp3', ''),
                    file: fileObject
                };
            });
        const createdSongs = await app.models.song.create(songs);
        const playlist = await app.services.playlist.get({ _id: req.params.id });
        playlist.songs = [...createdSongs.map(s => s._id), ...playlist.songs];
        await playlist.save();
        return res.result(null, createdSongs);
    });

    router.get('/:id', async (req, res) => {
        if (!req.params.id) {
            return res.result('Id missing');
        }
        const song = await app.services.song.get({ _id: req.params.id }, false, ['file']);
        if (song) {
            const filePath = path.resolve(song.file.path);
            return res.sendFile(filePath);
        } else {
            return res.result('Something went wrong');
        }
    });

    router.put('/:id', async (req, res) => {
        if (!req.params.id) {
            return res.result('Id missing');
        }
        if (!req.body.songIDs) {
            return res.result('Id missing');
        }
        const playlist = await app.services.playlist.get({ _id: req.params.id });
        if (!playlist) {
            return res.result('Error getting playlist');
        }
        playlist.songs = [
            ...req.body.songIDs,
            ...playlist.songs
        ];
        await playlist.save();
        return res.result(null);
    });

    router.put('/rename/:id', async (req, res) => {
        if (!req.params.id) {
            return res.result('Id missing');
        }
        if (!req.body.title) {
            return res.result('Title missing');
        }
        const song = await app.services.song.get({ _id: req.params.id });
        if (!song) {
            return res.result('Error getting song');
        }
        song.title = req.body.title;
        await song.save();
        return res.result(null);
    });

    router.delete('/:playlistId/:songId', async (req, res) => {
        if (!req.params.playlistId) {
            return res.result('Id missing');
        }
        if (!req.params.songId) {
            return res.result('Id missing');
        }
        const playlist = await app.services.playlist.get({ _id: req.params.playlistId }, false, ['songs']);
        if (!playlist) {
            return res.result('Error getting playlist');
        }
        const song = playlist.songs.find(s => s._id.toString() === req.params.songId);
        if (!song) {
            return res.result('Wrong playlist or song ID');
        }
        playlist.songs = playlist.songs.filter(s => s._id.toString() !== req.params.songId);
        await playlist.save();
        await app.services.song.remove([song._id]);
        return res.result(null, playlist.songs);
    });

    return router;
};



