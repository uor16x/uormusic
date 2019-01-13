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

    return router;
};



