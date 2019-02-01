const ffmpeg = require("fluent-ffmpeg");
const progress = require("progress-stream");
const info = require('./info.min');
const ytdl = require("ytdl-core");
const uuid = require('node-uuid');
const path = require('path');

const youtubeVideoQuality = 'highest';
const outputPath = './store';
const progressTimeout = 800;
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

        const stream = ytdl.downloadFromInfo(info, {
            quality: youtubeVideoQuality,
            requestOptions: requestOptions
        });
        stream.on('response', httpResponse => {
            const progressStream = progress({
                length: parseInt(httpResponse.headers["content-length"]),
                time: progressTimeout
            });

            progressStream.on('progress', progress => {
                progress.title = result.title;
                progressCB(progress);
            });

            new ffmpeg({
                source: stream.pipe(progressStream)
            })
                .audioBitrate(320)
                .withAudioCodec('libmp3lame')
                .toFormat('mp3')
                .outputOptions('-id3v2_version', '4')
                .on('error', err => {
                    cb(err, null);
                })
                .on('end', () => {
                    cb(null, result);
                })
                .saveToFile(result.filename);

        });
    });
};