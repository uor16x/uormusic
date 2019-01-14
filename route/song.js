const router = require('express').Router();
const fetchVideoInfo = require('youtube-info');
let yt;
const path = require('path');

const idParserRegExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
const idParser = link => {
    const match = link.match(idParserRegExp);
    return (match && match[7].length === 11)? match[7] : false;
};

module.exports = app => {
    yt = require('../helper/youtube')
    router.post('/youtube', (req, res) => {
        if (!req.body.playlistId) {
            return res.result('Playlist id missing');
        }
       if (!req.body.link) {
           return res.result('Link missing');
       }
        if (!req.body.socketId) {
            return res.result('SocketId missing');
        }
       const videoId = idParser(req.body.link);
        if (!videoId) {
            return res.result('Can\'t parse id');
        }
        fetchVideoInfo(videoId, function (err, videoInfo) {
            if (err) {
                return res.result(err.message);
            }
            global.sockets[req.body.socketId].emit('progress:start', {
                videoId: videoInfo.videoId,
                title: videoInfo.title
            });
            const dl = new yt();
            dl.getMP3(videoId, req.body.socketId, async (err, data) => {
                if (err) {
                    return res.result('Error download video');
                }
                const fileObject = new app.models.file({
                    path: data.file
                });
                fileObject.save(err => {
                    return err ? console.error(err) : null;
                });
                const newSong = new app.models.song({
                    title: data.videoTitle,
                    file: fileObject
                });
                await newSong.save();
                const playlist = await app.services.playlist.get({ _id: req.body.playlistId });
                if (!playlist) {
                    return res.result('Error getting playlist');
                }
                playlist.songs = [newSong._id, ...playlist.songs];
                await playlist.save();
                global.sockets[req.body.socketId].emit('progress:finish', { videoId })
                return res.result(null, newSong);
            });
        });
    });

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


