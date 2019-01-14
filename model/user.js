const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    username: String,
    password: String,
    playlists: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Playlist'
    }],
    lastFMUsername: String,
    lastFMKey: String,
    lastFMToggle: Boolean
});

module.exports = mongoose.model('User', userSchema);