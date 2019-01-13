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
    }
}