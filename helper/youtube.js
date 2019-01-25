const ytDownloader = require("youtube-mp3-downloader");
const uuid = require('node-uuid');
const os = require('os');

const downloader = function () {
    this.YD = new ytDownloader({
        "ffmpegPath": os.platform() === 'win32' ? './ffmpeg/bin/ffmpeg' : '/usr/bin/ffmpeg',
        "outputPath": "./store",
        "youtubeVideoQuality": "highest",
        "queueParallelism": 2,
        "progressTimeout": 2000
    });

    this.queue = {};

    this.YD.on("finished", (err, data) => {
        if (this.queue[data.videoId]) {
            this.queue[data.videoId].cb(err, data);
        } else {
            console.log("Error: No callback for videoId!");
        }

    });

    this.YD.on("error", (err, data) => {
        console.error(err);
        if (data && this.queue[data.videoId]) {
            this.queue[data.videoId].cb(err, data);
        } else {
            console.log("Error: No callback for videoId!");
        }
    });

    this.YD.on('progress', (data) => {
        if (this.queue[data.videoId]) {
            const socket = global.sockets[this.queue[data.videoId].socketId];
            if (socket) {
                socket.emit('progress:update', {
                    videoId: data.videoId,
                    progress: data.progress.percentage
                });
            }
        } else {
            console.log("Error: No callback for videoId!");
        }
    });

    this.YD.on("error", (err, data) => {
        console.error(err + " on videoId " + data.videoId);
        if (this.queue[data.videoId]) {
            const socket = global.sockets[this.queue[data.videoId].socketId];
            if (socket) {
                socket.emit('progress:fail', {
                    videoId: data.videoId
                });
            }
            this.queue[data.videoId].cb(err, data);
        } else {
            console.log("Error: No callback for videoId!");
        }
    });

};

downloader.prototype.getMP3 = function(videoId, socketId, cb){
    this.queue[videoId] = {
        cb: cb,
        socketId
    };
    this.YD.download(videoId, uuid.v4());
};

module.exports = downloader;