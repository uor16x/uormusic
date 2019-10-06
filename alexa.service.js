let app;

const methods = {
    overview: async userId => {
        const playlists = await app.service.user.get({ _id: userId }, false, ['playlists']);
        return {
            playlists: playlists.length,
            songs: playlists.reduce((acc, item) => {
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
