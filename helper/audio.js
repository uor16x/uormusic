const ffmpeg = require("fluent-ffmpeg");
const ffmpegOnProgress = require('ffmpeg-on-progress');
const path = require('path');
const fs = require('fs');

module.exports = {
    increaseBitrate: (src, dest, title, cb) => {
        new ffmpeg({ source: src })
            .audioBitrate(320)
            .withAudioCodec('libmp3lame')
            .toFormat('mp3')
            .outputOptions('-id3v2_version', '4')
            .on('error', err => {
                console.log(err);
                return cb(err);
            })
            .on('end', () => {
                fs.unlink(path.resolve(src), err => err ? console.error(err) : null);
                cb(null);
            })
            .saveToFile(dest);
    },
};
