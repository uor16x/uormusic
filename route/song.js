const router = require('express').Router();
const fetchVideoInfo = require('youtube.get-video-info');
const request = require('request');
const fetch = require("node-fetch");
const cheerio = require('cheerio');
let yt;
const path = require('path');

const idParserRegExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
const idParser = link => {
    const match = link.match(idParserRegExp);
    return (match && match[7].length === 11)? match[7] : false;
};

module.exports = app => {
    yt = require('../helper/youtube');
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
        fetchVideoInfo.retrieve(videoId, function (err, videoInfo) {
            if (err) {
                return res.result(err.message);
            }
            const title = videoInfo.title.replace(/\"/g, "").replace(/\+/g, " ");
            global.sockets[req.body.socketId].emit('progress:start', {
                videoId,
                title
            });
            const dl = new yt();
            dl.getMP3(videoId, req.body.socketId, async (err, data) => {
                if (err) {
                    global.sockets[req.body.socketId].emit('progress:fail', {
                        videoId: videoInfo.videoId
                    });
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
                global.sockets[req.body.socketId].emit('progress:finish', { videoId });
                return res.result(null, newSong);
            });
        });
    });

    router.get('/data/:title', async (req, res) => {
        if (!req.params.title) {
            return res.result('Title missing');
        }
        let splitted = req.params.title.split('-');
        if (!splitted[0] || !splitted[1]) {
            splitted = req.params.title.split('–');
        }
        if (!splitted[0] || !splitted[1]) {
            return res.result('Can\'t parse artist and title');
        }
        const artist = splitted[0].trim();
        const songtitle = splitted[1].trim();
        const url = "http://lyrics.wikia.com/" + encodeURI(artist.trim().replace(/ /g, '_').replace('танк', 'Танк')) + ":" + encodeURI(songtitle.trim().replace(/ /g, '_'));
        try {
            const response = await fetch(url);
            const html = await response.text();
            const $ = cheerio.load(html);
            $("div.lyricbox > .rtMatcher, div.lyricbox > .lyricsbreak").remove();
            $("div.lyricbox > br").replaceWith("\n");
            const lyrics = $("div.lyricbox").text();
            app.lastFM.track.getSimilar({
                'artist': artist
                    .toLowerCase()
                    .replace(/lyrics/g, '')
                    .replace(/\(lyrics\)/g, '')
                    .replace(/\([0-9]+\)/g, '')
                    .replace(/\(!\)/g, '')
                    .trim(),
                'track': songtitle.toLowerCase(),
                autocorrect: 1
            }, (err, similar) => {
                if (err || !similar) {
                    similar = {
                        track: []
                    };
                }
                if (similar.track.length === 0) {
                    app.lastFM.artist.getSimilar({
                        'artist': artist
                            .toLowerCase()
                            .replace(/lyrics/g, '')
                            .replace(/\(lyrics\)/g, '')
                            .replace(/\([0-9]+\)/g, '')
                            .replace(/\(!\)/g, '')
                            .trim(),
                        autocorrect: 1
                    }, (err, similar) => {
                        if (err || !similar) {
                            similar = {
                                artist: []
                            };
                        }
                        const songData = {
                            lyrics: lyrics && lyrics.split('\n'),
                            similar: similar && similar.artist && similar.artist.map(artist => artist.name)
                        };
                        return res.result(null, songData);
                    })
                } else {
                    const songData = {
                        lyrics: lyrics && lyrics.split('\n'),
                        similar: (similar && similar.track && similar.track.map(song => `${song.artist.name} - ${song.name}`)) || []
                    };
                    return res.result(null, songData);
                }
            });
        } catch (err) {
            return res.result(err);
        }
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

    router.get('/get/:id', async (req, res) => {
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



