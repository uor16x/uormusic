let app;

const methods = {
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
