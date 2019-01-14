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
}

function MusicService($http) {
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
    this.uploadSongYT = function (playlistId, link, socketId) {
        return $http.post('/song/youtube', {
            playlistId,
            link,
            socketId
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