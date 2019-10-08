const latinize = require('latinize');
let app;

const methods = {
    getSlotValues: (handlerInput) => {
        const filledSlots = handlerInput.requestEnvelope.request.intent.slots;
        const slotValues = {};
        Object.keys(filledSlots).forEach((item) => {
            const { name } = filledSlots[item];

        if (filledSlots[item]
            && filledSlots[item].resolutions
            && filledSlots[item].resolutions.resolutionsPerAuthority[0]
            && filledSlots[item].resolutions.resolutionsPerAuthority[0].status
            && filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
            switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
                case 'ER_SUCCESS_MATCH':
                    slotValues[name] = {
                        synonym: filledSlots[item].value,
                        resolved: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
                        id: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.id,
                    };
                    break;
                case 'ER_SUCCESS_NO_MATCH':
                    slotValues[name] = {
                        synonym: filledSlots[item].value,
                        resolved: filledSlots[item].value,
                    };
                    break;
                default:
                    break;
            }
        } else {
            slotValues[name] = {
                synonym: filledSlots[item].value,
                resolved: filledSlots[item].value,
            };
        }
    }, this);
    return slotValues;
},
    getCurrent: async (userId, variable, session) => {
        switch (variable.id) {
            case 'SONG':
                return 'Current song is';
            case 'LIST':
                if (!session.current || !session.current.playlist) {
                    return 'Current playlist is none';
                }
                const currentPlaylistSongs = session.current.playlist.songs.reduce((acc, item, index) => {
                    if (item.title.indexOf(session.current.playlist.name) > -1) {
                        item.title = item.title.replace(session.current.playlist.name, '');
                    }
                    acc += `#${index + 1} ${latinize(item.title)}, `;
                    return acc;
                }, '');
                return `Current list is ${session.current.playlist.name}. It has the following songs: ${currentPlaylistSongs}`;
            case 'LIBRARY':
                const currentUser = await app.services.user.get({ _id: userId }, false, ['playlists']);
                return 'You have the following playlists: ' + currentUser.playlists.reduce((acc, item, index) => {
                    acc += `#${index + 1} - ${latinize(item.name)}, `;
                    return acc;
                }, '');
            case 'FOUND':
                return `Current search result is ${session.found ? session.found.name : 'none'}`;
            default:
                throw new Error('Something went wrong');
        }
    },
    perform: async (userId, variable, session) => {
        switch (variable) {
            case 'FOUND':
                const songs = await app.services.song
                    .get({ _id: session.found.songs }, true);
                const songUrlBase = app.env.mode === 'dev'
                    ? `${app.env.OUTSIDE_URL}/song/get`
                    : 'https://uormusic.info/song/get';
                const streams = songs.map(song => {
                    return {
                        url: `${songUrlBase}/${song._id}`,
                        title: song.title,
                        token: song._id.toString(),
                        expectedPreviousToken: null,
                        offsetInMilliseconds: 0
                    };
                });
                return {
                    stream: streams[session.found.startIndex],
                    list: streams
                };
            default:
                throw new Error('Sorry, can\'t understand what to perform.');
        }
    },
    search: async (userId, query) => {
        const currentUser = await app.services.user.get({ _id: userId }, false, ['playlists']);
        const playlists = await app.services.playlist.get({ _id: currentUser.playlists.map(p => p._id)}, true);
        query = query.toLowerCase();
        console.log(query);
        const foundPlaylist = playlists.find(p => p.name.toLowerCase().indexOf(query) > -1);
        if (!foundPlaylist) {
            console.log(`Cant find playlist: ${query}`);
            throw new Error(`Can\'t find such playlist called ${query}`);
        }
        return {
            name: foundPlaylist.name,
            songs: foundPlaylist.songs.map(s => s._id)
        };
    },
    set: async (handlerInput) => {
        const userId = methods.getUserId(handlerInput);
        const session = handlerInput.attributesManager.getSessionAttributes();
        if (!session.current) {
            session.current = {};
        }
        const slotValues = methods.getSlotValues(handlerInput);
        switch (slotValues.entity.id) {
            case 'SONG':
                return 'Current song is';
            case 'LIST':
                const currentUser = await app.services.user.get({ _id: userId }, false, ['playlists']);
                const playlists = await app.services.playlist.get({ _id: currentUser.playlists.map(p => p._id)}, true);
                const playlistIndex = parseInt(slotValues.number.resolved.match(/[0-9 , \.]+/g)[0]) - 1;
                const currentPlaylist = await app.services.playlist
                    .get({ _id: playlists[playlistIndex]._id}, false, ['songs']);
                session.current.playlist = currentPlaylist;
                const songUrlBase = app.env.mode === 'dev'
                    ? `${app.env.OUTSIDE_URL}/song/get`
                    : 'https://uormusic.info/song/get';
                const currentSong = currentPlaylist.songs[0];
                session.current.song = {
                    url: `${songUrlBase}/${currentSong._id}`,
                    title: currentSong.title,
                    token: currentSong._id.toString(),
                    expectedPreviousToken: null,
                    offsetInMilliseconds: 0
                };
                handlerInput.attributesManager.setSessionAttributes(session);
                return {
                    session,
                    speechText: `Playlist set: ${currentPlaylist.name}`,
                    index: 0
                };
            default:
                throw new Error('Something went wrong');
        }
    },
    intentErrorHandler: (handlerInput, err) => {
        console.error(err.stack);
        speechText = err.message;
        return handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(true)
            .getResponse();
    },
    getUserId: handlerInput => handlerInput.requestEnvelope.context.System.user.accessToken,
    overview: async userId => {
        const user = await app.services.user.get({ _id: userId }, false, ['playlists']);
        return {
            playlists: user.playlists.length,
            songs: user.playlists.reduce((acc, item) => {
                acc += item.songs.length;
                return acc;
            }, 0)
        };
    }
};

module.exports = _app => {
    app = _app;
    return methods;
}
