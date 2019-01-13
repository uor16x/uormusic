const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    username: String,
    password: String,
    playlists: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Playlist'
    }]
});

module.exports = mongoose.model('User', userSchema);