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
                return `Current song is ${session.current.song ? session.current.song.title : 'none'}`;
            case 'LIST':
                if (!session.current.playlist) {
                    return 'Current playlist is none';
                }
                const currentPlaylistSongs = session.current.playlist.songs.reduce((acc, item, index) => {
                    if (item.title.indexOf(session.current.playlist.name) > -1) {
                        item.title = item.title.replace(session.current.playlist.name, '');
                    }
                    item.title = item.title.replace(/&/g, 'and');
                    acc += `${latinize(item.title)} - #${index + 1} , `;
                    return acc;
                }, '');
                return `Current list is ${latinize(session.current.playlist.name)}. It has the following songs: ${currentPlaylistSongs}`;
            case 'LIBRARY':
                const currentUser = await app.services.user.get({ _id: userId }, false, ['playlists']);
                return 'You have the following playlists: ' + currentUser.playlists.reduce((acc, item, index) => {
                    acc += `${latinize(item.name)} - #${index + 1}, `;
                    return acc;
                }, '');
            default:
                throw new Error('Something went wrong');
        }
    },
    search: async (userId, query) => {
        const currentUser = await app.services.user.get({ _id: userId }, false, ['playlists']);
        const playlistsUnsorted = await app.services.playlist.get({ _id: currentUser.playlists.map(p => p._id)}, true);
        const playlists = [];
        currentUser.playlists.forEach((playlistID, i) => {
            playlists[i] = playlistsUnsorted.find(playlistUnsorted =>
                playlistUnsorted._id.toString() === playlistID.toString());
        });
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
        const attrs = await handlerInput.attributesManager.getPersistentAttributes();
        const slotValues = methods.getSlotValues(handlerInput);
        const queryIndex = parseInt(slotValues.number.resolved.match(/[0-9 , \.]+/g)[0]);
        switch (slotValues.entity.id) {
            case 'SONG':
                if (!attrs.current.playlist) {
                    return {
                        attrs,
                        speechText: 'Select playlist first'
                    };
                }
                const selectedSong = attrs.current.playlist.songs[queryIndex - 1];
                attrs.current.song = {
                    url: `${songUrlBase}/${selectedSong._id}`,
                    title: selectedSong.title,
                    token: selectedSong._id.toString(),
                    expectedPreviousToken: null,
                    offsetInMilliseconds: 0
                };
                return {
                    attrs,
                    speechText: `Song set: ${selectedSong.title}`
                };
            case 'LIST':
                const currentUser = await app.services.user.get({ _id: userId });
                const playlistsUnsorted = await app.services.playlist.get({ _id: currentUser.playlists}, true);
                const playlists = [];
                currentUser.playlists.forEach((playlistID, i) => {
                    playlists[i] = playlistsUnsorted.find(playlistUnsorted =>
                        playlistUnsorted._id.toString() === playlistID.toString());
                });
                const playlistIndex = queryIndex - 1;
                const currentPlaylist = await app.services.playlist
                    .get({ _id: playlists[playlistIndex]._id}, false, ['songs']);
                attrs.current.playlist = currentPlaylist;
                const currentSong = currentPlaylist.songs[0];
                attrs.current.song = {
                    url: `${songUrlBase}/${currentSong._id}`,
                    title: currentSong.title,
                    token: currentSong._id.toString(),
                    expectedPreviousToken: null,
                    offsetInMilliseconds: 0
                };
                return {
                    attrs,
                    speechText: `Playlist set: ${currentPlaylist.name}`
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
    findNext: attrs => {
        const songIndex = attrs.current.playlist.songs
            .findIndex(song => song._id.toString() === attrs.current.song.token);
        const newIndex = songIndex === attrs.current.playlist.songs.length - 1
            ? 0
            : songIndex + 1;
        const newSong = attrs.current.playlist.songs[newIndex];
        return {
            url: `${songUrlBase}/${newSong._id}`,
            title: newSong.title,
            token: newSong._id.toString(),
            expectedPreviousToken: attrs.current.song.token,
            offsetInMilliseconds: 0
        };
    },
    findPrev: attrs => {
        const songIndex = attrs.current.playlist.songs
            .findIndex(song => song._id.toString() === attrs.current.song.token);
        const newIndex = songIndex - 1 === 0
            ? 0
            : songIndex - 1;
        console.log(newIndex);
        const newSong = attrs.current.playlist.songs[newIndex];
        console.log(JSON.stringify(newSong));
        console.log(JSON.stringify(attrs.current.playlist.songs));
        return {
            url: `${songUrlBase}/${newSong._id}`,
            title: newSong.title,
            token: newSong._id.toString(),
            expectedPreviousToken: null,
            offsetInMilliseconds: 0
        };
    },
    saveSession: async handlerInput => {
        return {};
        const sessionAttrs = handlerInput.attributesManager.getSessionAttributes();
        handlerInput.attributesManager.setPersistentAttributes(sessionAttrs);
        await handlerInput.attributesManager.savePersistentAttributes();
    }
};

module.exports = _app => {
    app = _app;
    songUrlBase = app.env.mode === 'dev'
        ? `${app.env.OUTSIDE_URL}/song/get`
        : 'https://uormusic.info/song/get';
    return methods;
};
