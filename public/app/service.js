function AuthService($http) {
    let _user = null;

    this.get = function () {
        return _user;
    };
    this.set = function (user) {
        _user = user;
    };

    this.authPost = function (data) {
        return $http.post('/user', data);
    };
    this.authGet = function () {
        return $http.get('/user');
    };
    this.authDelete = function () {
        return $http.delete('/user');
    };

    this.uploadBackground = function (file) {
        const formData = new FormData();
        formData.append("background", file, file.name);

        return $http({
            url: `/user/background`,
            method: 'POST',
            data: formData,
            headers: { 'Content-Type': undefined},
            transformRequest: angular.identity
        });
        // return $http.post(`/song/${playlistId}`, formData);
    };
    this.toggleBackground = function () {
        return $http.put('/user/background');
    };
}

function MusicService($http) {
    this.getSongData = function (title) {
        return $http.get(`/song/data/${title}`);
    };
    this.addPlaylist = function (name) {
        return $http.post('/playlist', {
            name
        });
    };
    this.removePlaylist = function (id) {
        return $http.delete(`/playlist/${id}`);
    };
    this.removeSong = function (playlistId, songId) {
        return $http.delete(`/song/${playlistId}/${songId}`);
    };
    this.renamePlaylist = function (id, name) {
        return $http.put(`/playlist/${id}`, {
            name
        });
    };
    this.renameSong = function (id, title) {
        return $http.put(`/song/rename/${id}`, {
            title
        });
    };
    this.getPlaylist = function (id) {
        return $http.get(`/playlist/${id}`);
    };
    this.uploadSong = function (playlistId, files) {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            formData.append("songs[]", file, file.name);
        }

        return $http({
            url: `/song/${playlistId}`,
            method: 'POST',
            data: formData,
            headers: { 'Content-Type': undefined},
            transformRequest: angular.identity
        });
        // return $http.post(`/song/${playlistId}`, formData);
    };
    this.uploadSongYT = function (playlistId, links, socketId) {
        return $http.post('/song/youtube', {
            playlistId,
            links,
            socketId
        });
    };
    this.getShortenedLink = function (link) {
        return $http.post('https://api.rebrandly.com/v1/links', { destination: link }, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'fc420d567a9747e18bb55b114536f640'
            }
        });
    };
    this.copySongs = function (playlistId, songIDs) {
        return $http.put(`/song/${playlistId}`, {
            songIDs
        })
    };
    this.sortPlaylists = function (playlists) {
        return $http.put('/user', {
            playlists
        })
    };
    this.setLastFMToggle = function (state) {
        return $http.put('/user', {
            lastFMToggle: state
        });
    };
    this.scrobble = function (songId) {
        return $http.get(`/lfm/scrobble/${songId}`);
    };
    this.sortSongs = function (id, songs) {
        return $http.put(`/playlist/${id}`, {
            songs
        });
    };
    this.getLfmLink = function (socketId) {
        return $http.get(`/lfm/${socketId}`);
    }
}