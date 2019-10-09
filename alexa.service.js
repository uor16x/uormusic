const latinize = require('latinize');
let songUrlBase;
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
    search: async (userId, query) => {
        const currentUser = await app.services.user.get({ _id: userId }, false, ['playlists']);
        const playlists = await app.services.playlist.get({ _id: currentUser.playlists.map(p => p._id)}, true);
        const foundIndicies = playlists
            .reduce((acc, item, index) => {
                if (item.name.toLowerCase().indexOf(query) > -1) {
                    acc.push(index);
                }
                return acc;
            }, []);
        if (foundIndicies.length === 0) {
            console.log(`Cant find playlists: ${query}`);
            throw new Error(`Can\'t find any playlist called ${query}`);
        }
        const speechText = foundIndicies.reduce((acc, item) => {
            acc += `#${item} - ${latinize(playlists[item].name)}; `;
            return acc;
        }, 'The following playlists were found: ');
        return speechText;
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
                const currentUser = await app.services.user.get({ _id: userId });
                const playlistsUnsorted = await app.services.playlist.get({ _id: currentUser.playlists}, true);
                const playlists = [];
                currentUser.playlists.forEach((playlistID, i) => {
                    playlists[i] = playlistsUnsorted.find(playlistUnsorted =>
                        playlistUnsorted._id.toString() === playlistID.toString());
                });
                const playlistIndex = parseInt(slotValues.number.resolved.match(/[0-9 , \.]+/g)[0]) - 1;
                const currentPlaylist = await app.services.playlist
                    .get({ _id: playlists[playlistIndex]._id}, false, ['songs']);
                session.current.playlist = currentPlaylist;
                console.log(session.current.playlist.songs.map(s => s._id.toString()).join(', '));
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
    intentErrorHandler: (handlerInput, msg, endSession) => {
        console.error(msg);
        return handlerInput.responseBuilder
            .speak(msg)
            .withShouldEndSession(endSession)
            .getResponse();
    },
    getUserId: handlerInput => handlerInput.requestEnvelope.context.System.user.accessToken,
    overview: async handlerInput => {
        const userId = methods.getUserId(handlerInput);
        const user = await app.services.user.get({ _id: userId }, false, ['playlists']);
        return {
            playlists: user.playlists.length,
            songs: user.playlists.reduce((acc, item) => {
                acc += item.songs.length;
                return acc;
            }, 0)
        };
    },
    findNext: session => {
        console.log('Find next session => ' + JSON.stringify(session));
        const songIndex = session.current.playlist.songs
            .findIndex(song => song._id.toString() === session.current.song.token);
        const newIndex = songIndex === session.current.playlist.songs.length - 1
            ? 0
            : songIndex + 1;
        const newSong = session.current.playlist.songs[newIndex];
        console.log(session.current.playlist.songs.map(s => s._id.toString()).join(', '));
        console.log(JSON.stringify(newSong));
        return {
            url: `${songUrlBase}/${newSong._id}`,
            title: newSong.title,
            token: newSong._id.toString(),
            expectedPreviousToken: session.current.song.token,
            offsetInMilliseconds: 0
        };
    },
    findPrev: session => {
        const songIndex = session.current.playlist.songs
            .findIndex(song => song._id.toString() === session.current.song.token);
        const newIndex = songIndex - 1 === 0
            ? 0
            : songIndex - 1;
        const newSong = session.current.playlist.songs[newIndex];
        return {
            url: `${songUrlBase}/${newSong._id}`,
            title: newSong.title,
            token: newSong._id.toString(),
            expectedPreviousToken: session.current.song.token,
            offsetInMilliseconds: 0
        };
    }
};

module.exports = _app => {
    app = _app;
    songUrlBase = app.env.mode === 'dev'
        ? `${app.env.OUTSIDE_URL}/song/get`
        : 'https://uormusic.info/song/get';
    return methods;
};
