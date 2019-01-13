const mongoose = require('mongoose');

const playlistSchema = mongoose.Schema({
    name: String,
    songs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref:'Song'
    }]
});

module.exports = mongoose.model('Playlist', playlistSchema);