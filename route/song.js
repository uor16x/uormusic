const router = require('express').Router();
const ytb = require('../helper/youtube');
const fetch = require("node-fetch");
const cheerio = require('cheerio');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const uuid = require('node-uuid');

const audio = require('../helper/audio');

const concurrency = 3;
const activeQueue = [];
const waitQueue = [];

const checkQueue = () => {
    if (activeQueue.length < concurrency) {
        const elem = waitQueue.pop();
        if (elem) {
            elem(() => {
                activeQueue.splice(activeQueue.indexOf(elem), 1);
                checkQueue();
            })
        }
    }
};
const pushQueue = item => {
    console.log('Item pushed');
    waitQueue.push(item);
    checkQueue();
};

const idParserRegExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
const idParser = link => {
    const match = link.match(idParserRegExp);
    return (match && match[2].length === 11) ? match[2] : false;
};

module.exports = app => {
    router.get('/search/:mode/:query', async (req, res) => {
        if (!req.params.mode || !req.params.query) {
            return res.result('Mode or query missing');
        }
        if (req.params.mode === 'VK') {
            axios.get(`https://vrit.me/audios205372980?q=${encodeURIComponent(req.params.query)}`)
                .then(response => {
                    const page = cheerio.load(response.data);
                    const audioEntries = page('.info');
                    const audios = [];
                    for (let i = 0; i < audioEntries.length; i++) {
                        const currentAudioEntry = cheerio.load(audioEntries[i]);
                        audios.push({
                            id: uuid.v4(),
                            title: `${currentAudioEntry('.artist')[0].children[0].data} - ${currentAudioEntry('.title')[0].children[0].data}`,
                            duration: currentAudioEntry('.duration')[0].children[0].data,
                            url: currentAudioEntry('a')[0].attribs.href
                        });
                    }
                    return res.result(null, audios);
                })
                .catch(err => {
                    return res.result(err);
                });
        } else if (req.params.mode === 'YT') {
            return res.result(null, []);
        } else {
            return res.result('Unrecognized mode');
        }
    });

    router.post('/youtube', (req, res) => {
        if (!req.body.playlistId) {
            return res.result('Playlist id missing');
        }
       if (!req.body.links) {
           return res.result('Link missing');
       }
        if (!req.body.socketId) {
            return res.result('SocketId missing');
        }
       const videoIds = req.body.links.map(idParser);
       const socket = global.sockets[req.body.socketId];
       videoIds.forEach(videoId => {
           socket && socket.emit('progress:start', {
               videoId,
               title: `https://www.youtube.com/watch?v=${videoId}`
           });
           const queueItem = function (queueCB) {
               setTimeout(() => {
                   let failedTimeout;
                   ytb(videoId, data => {
                       if (data) {
                           if (failedTimeout) {
                               clearTimeout(failedTimeout);
                           }
                           failedTimeout = setTimeout(function(){
                               pushQueue(queueItem);
                           }, 1000 * 60);

                           socket && socket.emit('progress:update', {
                               videoId,
                               title: data.title,
                               progress: data.percentage,
                               eta: data.eta
                           });
                       }
                   }, async (err, ytDownloadResult) => {
                       if (err || !ytDownloadResult) {
                           socket && socket.emit('progress:fail', {
                               videoId: videoId
                           });
                           return res.result('Error download video');
                       }
                       clearTimeout(failedTimeout);
                       const fileObject = new app.models.file({
                           path: ytDownloadResult.filename
                       });
                       fileObject.save(err => {
                           return err ? console.error(err) : null;
                       });
                       const newSong = new app.models.song({
                           title: ytDownloadResult.title,
                           file: fileObject
                       });
                       await newSong.save();
                       const playlist = await app.services.playlist.get({ _id: req.body.playlistId });
                       if (!playlist) {
                           return res.result('Error getting playlist');
                       }
                       playlist.songs = [newSong._id, ...playlist.songs];
                       await playlist.save();
                       socket && socket.emit('progress:finish', { videoId, newSong, plist: req.body.playlistId });
                       queueCB();
                   });
               }, 2000);
           };
           pushQueue(queueItem);
       });
        return res.result(null);
    });

    router.post('/vk', (req, res) => {
        if (!req.body.playlistId) {
            return res.result('Playlist id missing');
        }
        if (!req.body.url) {
            return res.result('Link missing');
        }
        if (!req.body.title) {
            return res.result('Title missing');
        }
        if (!req.body.socketId) {
            return res.result('SocketId missing');
        }
        const songFileName = `./store/${uuid.v4()}`;
        const socket = global.sockets[req.body.socketId];
        socket && socket.emit('progress:init', {
            playlistId: req.body.playlistId,
            title: req.body.title,
            id: songFileName
        });
        const queueItem = function (queueCB) {
            setTimeout(() => {
                const streamFileName = `${songFileName}-DOWNLOADED.mp3`;
                const file = fs.createWriteStream(streamFileName);
                const url = 'https://vrit.me' + encodeURI(req.body.url);
                axios({
                    url,
                    method: 'GET',
                    responseType: 'stream'
                }).then(response => {
                    if (response && response.data) {
                        socket && socket.emit('progress:download', {
                            playlistId: req.body.playlistId,
                            title: req.body.title,
                            id: songFileName
                        });
                    }
                    file.on('finish', () => {
                        socket && socket.emit('progress:encode', {
                            playlistId: req.body.playlistId,
                            title: req.body.title,
                            id: songFileName
                        });
                        audio.increaseBitrate(streamFileName, songFileName, req.body.title, async err => {
                            if (err) {
                                console.log(err);
                                socket && socket.emit('progress:fail', {
                                    id: songFileName
                                });
                                return queueCB();
                            }
                            const fileObject = new app.models.file({
                                path: songFileName
                            });
                            fileObject.save(err => {
                                return err ? console.error(err) : null;
                            });
                            const newSong = new app.models.song({
                                title: req.body.title,
                                file: fileObject
                            });
                            await newSong.save();
                            const playlist = await app.services.playlist.get({ _id: req.body.playlistId });
                            if (!playlist) {
                                return res.result('Error getting playlist');
                            }
                            playlist.songs = [newSong._id, ...playlist.songs];
                            await playlist.save();
                            socket && socket.emit('progress:finish', {
                                id: songFileName,
                                newSong,
                                playlistId: req.body.playlistId
                            });
                            queueCB();
                        })
                    });
                    file.on('error', (err) => {
                        console.log(err);
                        socket && socket.emit('progress:fail', {
                            id: songFileName
                        });
                        queueCB();
                    });
                    response.data.pipe(file);
                });
            }, 500);
        };
        pushQueue(queueItem);
        return res.result(null);
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
            return {
                lyrics: '',
                similar: []
            };
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



