function MainController($scope, AuthService, MusicService) {
    $scope.user = null;
    const initModalOptions = {
        show: false
    };
    $scope.modals = {
        addPlaylist: $('#addPlaylistModal').modal(initModalOptions),
        addSong: $('#addSongModal').modal(initModalOptions),
    };
    $scope.music = {
        playing: false,
        repeat: false,
        audio: $('#audio')[0],

        newPlaylistName: '',
        newSongYoutubeLink: '',
        newSongFile: null,
        newSongInput: $('#newSongDisk'),

        currentPlaylistName: '',
        currentPlaylistId: null,
        currentPlaylistSongs: [],

        currentPlayingPlaylistName: '',
        currentPlayingPlaylistId: null,
        currentPlayingPlaylistSongs: [],

        currentSongId: null,
        currentSongTitle: '',
        currentSongName: ''
    };

    $scope.loading = true;
    $scope.authData = {
        username: '',
        password: ''
    };

    AuthService.authGet()
        .then(response => {
            if (response.data) {
                AuthService.set(response.data);
                $scope.user = response.data;
            }
        })
        .catch(err => alert(err.data))
        .finally(() => {
            $scope.loading = false;
        });

    $scope.authPost = function () {
        if (!$scope.authData.username) {
            return alert('Username missing');
        }
        if (!$scope.authData.password) {
            return alert('Password missing');
        }
        $scope.loading = true;
        AuthService.authPost($scope.authData)
            .then(response => {
                if (response.data) {
                    AuthService.set(response.data);
                    $scope.user = response.data;
                }

            })
            .catch(err => alert(err.data))
            .finally(() => {
                $scope.authData.password = '';
                $scope.loading = false;
            });
    };

    $scope.logout = function () {
        $scope.loading = true;
        AuthService.authDelete()
            .then(response => {
                AuthService.set(null);
                $scope.user = null;
            })
            .catch(err => alert(err.data))
            .finally(() => {
                $scope.loading = false;
            });
    };

    $scope.addPlaylist = () => {
        if (!$scope.music.newPlaylistName) {
            return alert('Playlist name missing');
        }
        console.log($scope.music.newPlaylistName);
        $scope.loading = true;
        MusicService.addPlaylist($scope.music.newPlaylistName)
            .then(response => {
                if (response.data) {
                    $scope.user.playlists = response.data;
                }
            })
            .catch(err => alert(err.data))
            .finally(() => {
                $scope.loading = false;
                $scope.music.newPlaylistName = '';
            });
        $scope.music.newPlaylistName = '';
    };

    $scope.setPlaylist = item => {
        $scope.loading = true;
        $scope.music.currentPlaylistId = item._id;
        $scope.music.currentPlaylistName = item.name;
        MusicService.getPlaylist(item._id)
            .then(response => {
                if (response.data) {
                    $scope.music.currentPlaylistSongs = response.data;
                }
            })
            .catch(err => alert(err.data))
            .finally(() => {
                $scope.loading = false;
            });
    }

    $scope.addSongModalShow = () => {
        return $scope.music.currentPlaylistId ? $scope.modals.addSong.modal('show') : alert('Select playlist first');
    };

    $scope.addSongYoutube = () => {

    };

    $scope.selectFile = () => {
        const stopWatch = $scope.$watch('music.newSongFile', () => {
            if ($scope.music.newSongFile) {
                stopWatch();
                const currPlist = $scope.music.currentPlaylistId;
                $scope.modals.addSong.modal('hide');
                $scope.loading = true;
                MusicService.uploadSong(currPlist, $scope.music.newSongFile)
                    .then(response => {
                        if (response.data && currPlist === $scope.music.currentPlaylistId) {
                            $scope.music.currentPlaylistSongs.unshift(...response.data);
                        }
                    })
                    .catch(err => alert(err.data))
                    .finally(() => {
                        $scope.music.newSongFile = null;
                        $scope.loading = false;
                    })
            }
        });
        $scope.music.newSongInput.click();
    };

    $scope.setSong = (song, currentPlayingPlaylistId, currentPlayingPlaylistName, currentPlayingPlaylistSongs) => {
        $scope.pause();
        $scope.music.audio.src = `/song/${song._id}`;
        $scope.music.currentSongId = song._id;
        $scope.music.currentSongTitle = song.title;
        $scope.music.currentPlayingPlaylistId = currentPlayingPlaylistId || $scope.music.currentPlaylistId;
        $scope.music.currentPlayingPlaylistName = currentPlayingPlaylistName || $scope.music.currentPlayingPlaylistName;
        $scope.music.currentPlayingPlaylistSongs = currentPlayingPlaylistSongs || $scope.music.currentPlaylistSongs;
        $scope.play();
    };

    $scope.play = () => {
        if (!$scope.music.playing) {
            $scope.music.audio.play();
            $scope.music.playing = true;
        }
    };

    $scope.pause = () => {
        if ($scope.music.playing) {
            $scope.music.audio.pause();
            $scope.music.playing = false;
        }
    };

    $scope.next = manual => {
        const songIndex = $scope.music.currentPlayingPlaylistSongs
            .findIndex(song => song._id === $scope.music.currentSongId);
        if ($scope.music.repeat && !manual) {
            return $scope.setSong(
                $scope.music.currentPlayingPlaylistSongs.songs[songIndex],
                $scope.music.currentPlayingPlaylistId,
                $scope.music.currentPlayingPlaylistName,
                $scope.music.currentPlayingPlaylistSongs
            );
        } else {
            let newIndex;
            if (songIndex === $scope.music.currentPlayingPlaylistSongs.length - 1) {
                newIndex = 0;
            } else {
                newIndex = songIndex + 1;
            }
            return $scope.setSong(
                $scope.music.currentPlayingPlaylistSongs[newIndex],
                $scope.music.currentPlayingPlaylistId,
                $scope.music.currentPlayingPlaylistName,
                $scope.music.currentPlayingPlaylistSongs
            );
        }
    };

    $scope.prev = () => {
        let newIndex;
        const songIndex = $scope.music.currentPlayingPlaylistSongs
            .findIndex(song => song._id === $scope.music.currentSongId);
        newIndex = songIndex - 1;
        if (newIndex < 0) {
            newIndex = 0;
        }
        return $scope.setSong(
            $scope.music.currentPlayingPlaylistSongs[newIndex],
            $scope.music.currentPlayingPlaylistId,
            $scope.music.currentPlayingPlaylistName,
            $scope.music.currentPlayingPlaylistSongs
        );
    };
}
