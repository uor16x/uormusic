const ffmpeg = require("fluent-ffmpeg");
const progress = require("progress-stream");
const info = require('./info.min');
const ytdl = require("ytdl-core");
const uuid = require('node-uuid');
const path = require('path');
const fs = require('fs');

const youtubeVideoQuality = 'highest';
const outputPath = './store';
const progressTimeout = 200;
const requestOptions = { maxRedirects: 5 };
const fileNameReplacements = [[/"/g, ""], [/'/g, ""], [/\//g, ""], [/\?/g, ""], [/:/g, ""], [/;/g, ""]];

const cleanupTitle = title => {
    fileNameReplacements.forEach(replacement => {
        title = title.replace(replacement[0], replacement[1]);
    });
    return title;
};

module.exports = (id, progressCB, cb) => {
    const result = {
        id
    };
    info(id, { quality: youtubeVideoQuality }, (err, info) => {
        info.full = true;
        result.filename = path.join(outputPath, uuid.v4());
        result.title = cleanupTitle(info.title);

        const videoName = `${result.filename}.mp4`;
        const stream = fs.createWriteStream(videoName);
        const videoDownloadStream = ytdl(`http://www.youtube.com/watch?v=${id}`, {
            requestOptions
        });
        videoDownloadStream.once('response', data => {
            const progressStream = progress({
                length: parseInt(data.headers["content-length"]),
                time: progressTimeout
            });

            progressStream.on('progress', progress => {
                progress.title = result.title;
                progressCB(progress);
            });

            progressStream.on('end', () => {
                new ffmpeg({
                    source: `${result.filename}.mp4`
                })
                    .audioBitrate(320)
                    .withAudioCodec('libmp3lame')
                    .toFormat('mp3')
                    .outputOptions('-id3v2_version', '4')
                    .on('error', err => {
                        cb(err, null);
                    })
                    .on('end', () => {
                        fs.unlink(`${result.filename}.mp4`, err => console.error(err));
                        cb(null, result);
                    })
                    .saveToFile(result.filename);
            });

            videoDownloadStream.pipe(progressStream).pipe(stream);
        });
    });
};
