const mongoose = require('mongoose');

const songSchema = mongoose.Schema({
    title: String,
    file: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File'
    }
});

module.exports = mongoose.model('Song', songSchema);