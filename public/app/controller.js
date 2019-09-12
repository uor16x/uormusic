function MainController($scope, $location, $anchorScroll, $sce, debounce, AuthService, MusicService, Notification, socket) {
    $('.modal').on('shown.bs.modal', function() {
        $(this).find('[autofocus]').focus();
    });

    $scope.eq = {
        canvas: $('#eq')[0],
        interval: null,
        inited: false
    };

    $scope.modePlaylists = true;
    $scope.modePlaylistsTurnOn = () => {
        $scope.music.currentPlaylistName = '';
        $scope.music.currentPlaylistId = null;
        $scope.music.currentPlaylistSongs = [];
        $scope.modePlaylists = true;
    };
    $scope.setModePlaylists = state => $scope.modePlaylists = state;

    $scope.queue = [];
    function queueIndexById(id) {
        return $scope.queue.findIndex(item => item.id === id);
    }
    function spliceQueue(index) {
        if ($scope.queue.length === 1) {
            return $scope.queue = [];
        }
        $scope.queue.splice(index, 1);
    }
    socket.on('progress:init', function (data) {
        const index = queueIndexById(data.id);
        if (index === -1) {
            $scope.queue = [{
                title: data.title,
                playlistId: data.playlistId,
                status: 'In queue...',
                id: data.id
            }, ...$scope.queue];
        } else {
            $scope.queue[index] = {
                title: data.title,
                playlistId: data.playlistId,
                status: 'In queue...',
                id: data.id
            };
        }
    });
    socket.on('progress:download', function (data) {
        const index = queueIndexById(data.id);
        if (index === -1) {
            $scope.queue = [{
                title: data.title,
                playlistId: data.playlistId,
                status: 'In queue...',
                id: data.id
            }, ...$scope.queue];
        } else {
            $scope.queue[index] = {
                title: data.title,
                playlistId: data.playlistId,
                status: 'Downloading...',
                id: data.id
            };
        }
    });
    socket.on('progress:encode', function (data) {
        const index = queueIndexById(data.id);
        if (index === -1) {
            $scope.queue = [{
                title: data.title,
                playlistId: data.playlistId,
                status: 'In queue...',
                id: data.id
            }, ...$scope.queue];
        } else {
            $scope.queue[index] = {
                title: data.title,
                playlistId: data.playlistId,
                status: 'Encoding...',
                id: data.id
            };
        }
    });
    socket.on('progress:fail', function (data) {
        const index = queueIndexById(data.id);
        Notification.error($scope.queue[index].title + ' failed!');
        spliceQueue(index);
    });

    socket.on('progress:finish', function (data) {
        const index = queueIndexById(data.id);
        $scope.queue[index].status = 'Done!';
        if (data.playlistId === $scope.music.currentPlaylistId) {
            $scope.music.currentPlaylistSongs.unshift(data.newSong);
        }
        Notification.info($scope.queue[index].title + ' finished!');
        spliceQueue(index);
    });
    socket.on('lastfm:access', function (data) {
        if ($scope.lastFMWinRef) {
            $scope.lastFMWinRef.close();
            $scope.lastFMWinRef = null;
        }
    });
    socket.on('lastfm:auth', function (data) {
        $scope.authGet();
    });
    $scope.convertTime = secs => {
        secs = parseInt(secs);
        const mins = Math.floor(secs / 60);
        const finalMins = mins < 10 ? `0${mins}` : mins;
        const remainingSecs = secs % 60;
        const finalSecs = remainingSecs < 10 ? `0${remainingSecs}` : remainingSecs;
        return (!isNaN(finalMins) && !isNaN(finalSecs)) ? `${finalMins}:${finalSecs}` : null;
    };
    $scope.getKeysLength = obj => Object.keys(obj).length;

    $scope.user = null;
    const initModalOptions = {
        show: false
    };
    $scope.modals = {
        addPlaylist: $('#addPlaylistModal').modal(initModalOptions),
        addSong: $('#addSongModal').modal(initModalOptions),
        renamePlaylist: $('#renamePlaylistModal').modal(initModalOptions),
        renameSong: $('#renameSongModal').modal(initModalOptions),
        copySongs: $('#copySongsModal').modal(initModalOptions),
        sharePlaylist: $('#sharePlaylistModal').modal(initModalOptions),
        extra: $('#extraModal').modal(initModalOptions)
    };
    $scope.music = {
        playing: false,
        repeat: false,
        random: false,
        scrobbled: false,
        loadingSongData: false,
        audio: $('#audio')[0],
        vkaudio: $('#vkaudio')[0],

        currentTime: '00:00',
        durationTime: '00:00',

        newPlaylistName: '',
        newSongYoutubeLink: '',
        newSongFile: null,
        newSongInput: $('#newSongDisk'),

        renamePlaylist: null,
        renameSong: null,
        addSongsDest: null,

        currentPlaylistName: '',
        currentPlaylistId: null,
        currentPlaylistSongs: [],

        currentPlayingPlaylistName: '',
        currentPlayingPlaylistId: null,
        currentPlayingPlaylistSongs: [],

        currentSongId: null,
        currentSongTitle: 'MyMusic',
        currentSongData: null,

        backgroundFile: null,
        backgroundInput: $('#backgroundInput'),

        youtubeLinks: [''],
        addFromYTMode: false,

        sharePlaylistSongs: [],

        searchOpt: 'VK',
        searchLine: '',
        searchLoading: false,
        groupedPlaylists: []
    };
    $scope.sortablePlaylists = {
        stop: () => {
            MusicService.sortPlaylists($scope.user.playlists.map(p => p._id))
                .catch(err => Notification.error(err.data));
        }
    };
    $scope.sortableSongs = {
        stop: () => {
            MusicService.sortSongs($scope.music.currentPlaylistId, $scope.music.currentPlaylistSongs.map(s => s._id))
                .catch(err => Notification.error(err.data));
        }
    };

    $scope.loading = true;
    $scope.authData = {
        username: '',
        password: ''
    };
    $scope.authGet = () => {
        AuthService.authGet()
            .then(response => {
                if (response.data) {
                    AuthService.set(response.data);
                    if (!$scope.user) {
                        Notification.primary(`Welcome, ${response.data.username}!`);
                    }
                    $scope.user = response.data;
                }
            })
            .catch(err => Notification.info(err.data))
            .finally(() => {
                $scope.loading = false;
            });
    };
    $scope.authGet();
    $scope.$watch('music.currentSongId', debounce(function() {
        $scope.scrollToSong($scope.music.currentSongId);
    }, 300), true);
    $scope.$watch('user', () => {
        if ($scope.user && $scope.user.playlists) {
            $scope.music.groupedPlaylists = $scope.getGroupedPlaylists(4);
        }
    }, true);

    $scope.authPost = function () {
        if (!$scope.authData.username) {
            return Notification.info('Username missing');
        }
        if (!$scope.authData.password) {
            return Notification.info('Password missing');
        }
        $scope.loading = true;
        AuthService.authPost($scope.authData)
            .then(response => {
                if (response.data) {
                    AuthService.set(response.data);
                    $scope.user = response.data;
                    Notification.primary(`Welcome, ${$scope.user.username}!`);
                }

            })
            .catch(err => Notification.info(err.data))
            .finally(() => {
                $scope.authData.password = '';
                $scope.loading = false;
            });
    };

    $scope.logout = function () {
        $scope.loading = true;
        AuthService.authDelete()
            .then(response => {
                Notification.primary(`See you next time, ${$scope.user.username}!`);
                AuthService.set(null);
                $scope.user = null;
            })
            .catch(err => Notification.info(err.data))
            .finally(() => {
                $scope.loading = false;
            });
    };

    $scope.getSongData = song => {
        $scope.loading = true;
        MusicService.getSongData(song.title)
            .then(response => {
                if (response && response.data) {
                    $scope.music.currentSongData = response.data;
                    $scope.modals.extra.modal('show');
                }
            })
            .catch(err => Notification.error(err.data))
            .finally(() => {
                $scope.loading = false;
            });
    };

    $scope.addPlaylist = () => {
        if (!$scope.music.newPlaylistName) {
            return Notification.info('Playlist name missing');
        }
        $scope.loading = true;
        $scope.modals.addPlaylist.modal('hide');
        MusicService.addPlaylist($scope.music.newPlaylistName)
            .then(response => {
                if (response.data) {
                    Notification.success('Successfully added playlist');
                    $scope.user.playlists = response.data;
                }
            })
            .catch(err => Notification.info(err.data))
            .finally(() => {
                $scope.loading = false;
                $scope.music.newPlaylistName = '';
            });
        $scope.music.newPlaylistName = '';
    };

    $scope.removePlaylist = (item) => {
        if (confirm(`Are you sure you want to delete ${item.name}?`)) {
            MusicService.removePlaylist(item._id)
                .then(response => {
                    if (response.data) {
                        $scope.user.playlists = response.data;
                        const currVisible = $scope.music.currentPlaylistId === item._id;
                        const currPlaying = $scope.music.currentPlayingPlaylistId === item._id;
                        if (currVisible) {
                            $scope.music.currentPlaylistId = null;
                            $scope.music.currentPlaylistName = '';
                            $scope.music.currentPlaylistSongs = [];
                        }
                        if (currPlaying) {
                            $scope.pause();
                            $scope.music.currentSongId = null;
                            $scope.music.currentSongTitle = 'MyMusic';
                            $scope.music.audio.src = '';
                            $scope.music.currentPlayingPlaylistId = null;
                            $scope.music.currentPlayingPlaylistName = '';
                            $scope.music.currentPlayingPlaylistSongs = [];
                        }
                        Notification.success('Successfully removed');
                    }
                })
                .catch(err => Notification.error(err.data));
        }
    };

    $scope.removeSong = item => {
        if ($scope.music.currentSongId === item._id) {
            return Notification.info('You can\'t delete song, which is currently playing');
        }
        const plistID = $scope.music.currentPlaylistId;
        if (confirm(`Are you sure you want to delete ${item.title}?`)) {
            MusicService.removeSong(plistID, item._id)
                .then(response => {
                    if (response.data) {
                        if ($scope.music.currentPlaylistId === plistID) {
                            $scope.music.currentPlaylistSongs = response.data;
                        }
                        if ($scope.music.currentPlayingPlaylistId === plistID) {
                            $scope.music.currentPlayingPlaylistSongs = response.data;
                        }
                    }
                })
                .catch(err => Notification.error(err.data));
        }
    };

    $scope.renamePlaylist = () => {
        const name = $scope.music.renamePlaylist.name;
        if (!name) {
            return Notification.info('Playlist name missing');
        }
        const plistId = $scope.music.renamePlaylist._id;
        $scope.modals.renamePlaylist.modal('hide');
        MusicService.renamePlaylist(plistId, name)
            .then(response => {
                if (response.data) {
                    Notification.success('Successfully renamed playlist');
                    const plistIndex = $scope.user.playlists.findIndex(plist => plist._id === plistId);
                    $scope.user.playlists[plistIndex] = response.data;
                    if ($scope.music.currentPlayingPlaylistId) {
                        $scope.music.currentPlayingPlaylistName = response.data.name;
                        $scope.music.currentPlayingPlaylistSongs = response.data.songs;
                    }
                }
            })
            .catch(err => Notification.info(err.data));
        $scope.music.renamePlaylistName = '';
    };

    $scope.renameSong = () => {
        const title = $scope.music.renameSong.title;
        if (!title) {
            return Notification.info('Song title missing');
        }
        const songId = $scope.music.renameSong._id;
        $scope.modals.renameSong.modal('hide');
        MusicService.renameSong(songId, title)
            .then(response => {
                if ($scope.music.currentSongId === songId) {
                    $scope.music.currentSongTitle = title;
                }
                const index = $scope.music.currentPlaylistSongs.findIndex(s => s._id === songId);
                $scope.music.currentPlaylistSongs[index].title = title;
                Notification.success('Successfully renamed song');
            })
            .catch(err => Notification.info(err.data));
        $scope.music.renameSongTitle = '';
    };

    $scope.scrollToSong = id => {
        let offset = id ? angular.element(`#song-${id}`) &&
            angular.element(`#song-${id}`)[0] &&
            angular.element(`#song-${id}`)[0].offsetTop &&
            angular.element(`#song-${id}`)[0].offsetTop - 51 : -51;
        if (offset) {
            angular.element('#songs-container').animate({
                scrollTop: offset
            }, 600);
        } else if (id) {
            setTimeout(() => $scope.scrollToSong(id), 100);
        }
    };

    $scope.setPlaylist = item => {
        $scope.loading = true;
        $scope.music.currentPlaylistId = item._id;
        $scope.music.currentPlaylistName = item.name;
        MusicService.getPlaylist(item._id)
            .then(response => {
                if (response.data) {
                    $scope.music.currentPlaylistSongs = response.data;
                    if ($scope.music.currentPlayingPlaylistId === item._id) {
                        $scope.scrollToSong($scope.music.currentSongId);
                    } else {
                        $scope.scrollToSong();
                    }
                    $scope.modePlaylists = false;
                }
            })
            .catch(err => Notification.info(err.data))
            .finally(() => {
                $scope.loading = false;
            });
    };

    $scope.addSongModalShow = (item) => {
        $scope.music.addSongsDest = {
            ...item
        };
        return $scope.modals.addSong.modal('show');
    };

    $scope.renamePlaylistModalShow = (item) => {
        $scope.music.renamePlaylist = {...item};
        $scope.modals.renamePlaylist.modal('show');
    };

    $scope.renameSongModalShow = (item) => {
        $scope.music.renameSong = {...item};
        $scope.modals.renameSong.modal('show');
    };

    $scope.addSongYoutube = () => {
        $scope.modals.addSong.modal('hide');
        const currPlist = $scope.music.addSongsDest._id;
        const links = $scope.music.youtubeLinks;
        const socketId = socket.getId();
        MusicService.uploadSongYT(currPlist, links, socketId)
            .catch(err => {
                return Notification.error(err.data);
            });
        $scope.music.addFromYTMode = false;
        $scope.music.youtubeLinks = [''];
    };

    $scope.selectFile = () => {
        const stopWatch = $scope.$watch('music.newSongFile', () => {
            if ($scope.music.newSongFile) {
                stopWatch();
                const currPlist = $scope.music.currentPlaylistId;
                Notification.info('Disk upload started...');
                const diskUploadPrefix = 'Disk upload #';
                const lastNumber = $scope.queue
                    .filter(i => i.title.indexOf(diskUploadPrefix) > -1)
                    .map(i => i.title.replace(diskUploadPrefix, ''))
                    .map(i => parseInt(i))
                    .sort((a, b) => b - a)[0];
                const title = `${diskUploadPrefix}${lastNumber ? lastNumber + 1 : 1}`;
                let queueObj = {
                    title,
                    playlistId: currPlist,
                    status: 'Downloading...'
                };
                $scope.queue.push(queueObj);
                MusicService.uploadSong($scope.music.currentPlaylistId, $scope.music.newSongFile, e => {
                    if (e.lengthComputable) {
                        const percentage = (e.loaded / e.total) * 100;
                        if (percentage < 100) {
                            queueObj.status = `Downloading: ${Math.floor(percentage)}%`;
                        } else {
                            queueObj.status = `Encoding...`;
                        }
                    }
                })
                    .then(response => {
                        if (response.data) {
                            Notification.info('Disk upload finished');
                            const queueIndex = $scope.queue.findIndex(i => i.title === queueObj.title);
                            spliceQueue(queueIndex);
                        }
                        if (response.data && currPlist === $scope.music.currentPlaylistId) {
                            $scope.music.currentPlaylistSongs.unshift(...response.data);
                        }
                    })
                    .catch(err => Notification.info(err.data))
                    .finally(() => {
                        $scope.music.newSongFile = null;
                        $scope.loading = false;
                    })
            }
        });
        $scope.music.newSongInput.click();
    };

    function initEQ() {
        $scope.eq.inited = true;
        $scope.eq.audioContext = new AudioContext();
        $scope.eq.source = $scope.eq.audioContext.createMediaElementSource($scope.music.audio);
        $scope.eq.ctx = $scope.eq.canvas.getContext('2d');
        $scope.eq.analyser = $scope.eq.audioContext.createAnalyser();
        $scope.eq.source.connect($scope.eq.analyser);
        $scope.eq.analyser.connect($scope.eq.audioContext.destination);
        $scope.eq.height = window.innerHeight / 2;
        $scope.eq.width = window.innerWidth / 2;
    }
    $scope.setSong = (song, currentPlayingPlaylistId, currentPlayingPlaylistName, currentPlayingPlaylistSongs) => {
        if (!$scope.eq.inited) {
            initEQ();
        }
        $scope.pause();
        clearInterval($scope.eq.interval);
        $scope.eq.interval = setInterval(() =>{
            const freqData = new Uint8Array($scope.eq.analyser.frequencyBinCount);

            $scope.eq.analyser.getByteFrequencyData(freqData);

            $scope.eq.ctx.clearRect(0, 0, $scope.eq.width, $scope.eq.height);
            $scope.eq.ctx.fillStyle = 'rgba(255,255,255,0.05)';

            for (let i = 0; i < freqData.length; i++ ) {
                let magnitude = freqData[i];

                $scope.eq.ctx.fillRect(i*14, $scope.eq.height, 13.7, -magnitude * 1.5);
            }
        }, 33);

        $scope.music.audio.src = `/song/get/${song._id}`;
        $scope.music.currentSongId = song._id;
        $scope.music.currentSongTitle = song.title;
        $scope.music.currentSongData = null;
        $scope.music.currentPlayingPlaylistId = currentPlayingPlaylistId || $scope.music.currentPlaylistId;
        $scope.music.currentPlayingPlaylistName = currentPlayingPlaylistName || $scope.music.currentPlaylistName;
        $scope.music.currentPlayingPlaylistSongs = currentPlayingPlaylistSongs || $scope.music.currentPlaylistSongs;
        $scope.music.scrobbled = false;
        $scope.play();
    };

    $scope.play = () => {
        $scope.music.vkaudio.pause();
        if (!$scope.music.playing && $scope.music.currentSongId) {
            $scope.music.audio.play();
            $scope.music.playing = true;
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: $scope.music.currentSongTitle,
                });
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    $scope.next();
                });
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    $scope.prev();
                });
            }
        }
    };

    $scope.pause = () => {
        if ($scope.music.playing) {
            $scope.music.audio.pause();
            $scope.music.playing = false;
        }
    };

    $scope.getRandomSongIndex = currIndex => {
        let result = currIndex;
        while (result === currIndex) {
            result = Math.floor(Math.random() * $scope.music.currentPlayingPlaylistSongs.length);
        }
        return result;
    };

    $scope.next = manual => {
        if (!$scope.music.currentSongId) {
            return;
        }
        const songIndex = $scope.music.currentPlayingPlaylistSongs
            .findIndex(song => song._id === $scope.music.currentSongId);
        if ($scope.music.random) {
            let randomIndex = $scope.getRandomSongIndex(songIndex);
            return $scope.setSong(
                $scope.music.currentPlayingPlaylistSongs[randomIndex],
                $scope.music.currentPlayingPlaylistId,
                $scope.music.currentPlayingPlaylistName,
                $scope.music.currentPlayingPlaylistSongs
            );
        }
        if ($scope.music.repeat && !manual) {
            return $scope.setSong(
                $scope.music.currentPlayingPlaylistSongs[songIndex],
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
        if (!$scope.music.currentSongId) {
            return;
        }
        let newIndex;
        const songIndex = $scope.music.currentPlayingPlaylistSongs
            .findIndex(song => song._id === $scope.music.currentSongId);
        if ($scope.music.random) {
            let randomIndex = $scope.getRandomSongIndex(songIndex);
            return $scope.setSong(
                $scope.music.currentPlayingPlaylistSongs[randomIndex],
                $scope.music.currentPlayingPlaylistId,
                $scope.music.currentPlayingPlaylistName,
                $scope.music.currentPlayingPlaylistSongs
            );
        }
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

    $scope.footerPlaylistLink = () => {
        if ($scope.music.currentPlaylistId !== $scope.music.currentPlayingPlaylistId) {
            $scope.setPlaylist({
                _id: $scope.music.currentPlayingPlaylistId,
                name: $scope.music.currentPlayingPlaylistName,
            });
        } else {
            $scope.scrollToSong($scope.music.currentSongId);
        }
    };

    $scope.footerSongLink = () => {
        if ($scope.music.currentPlayingPlaylistId !== $scope.music.currentPlaylistId) {
            $scope.setPlaylist({
                _id: $scope.music.currentPlayingPlaylistId,
                name: $scope.music.currentPlayingPlaylistName,
            });
        }
    };


    $scope.updateTime = () => {
        if ($scope.music.audio.currentTime > 60 && !$scope.music.scrobbled) {
            $scope.music.scrobbled = true;
            $scope.scrobble($scope.music.currentSongId);
        }
        $scope.music.currentTime = $scope.convertTime($scope.music.audio.currentTime);
        $scope.music.durationTime = $scope.music.audio.duration ?
            $scope.convertTime($scope.music.audio.duration) :
            $scope.music.durationTime;
    };

    /**
     * Checkers
     */
    $scope.showPlaylistActions = () => {
        return !!$scope.music.currentPlaylistId;
    };

    $scope.showSongActions = () => {
        return !!$scope.music.currentSongId;
    };

    /**
     * Copy songs wizard
     */
    $scope.copySongsWizard = {
        step: 0,
        srcPlaylist: null,
        songIDs: []
    };
    $scope.copySongsWizardSetPlaylist = item => {
        $scope.copySongsWizard.srcPlaylist = item;
        MusicService.getPlaylist(item._id)
            .then(response => {
                if (response.data) {
                    $scope.copySongsWizard.srcPlaylist.songs = response.data;
                    $scope.copySongsWizard.step = 1;
                }
            })
            .catch(err => Notification.info(err.data));
    };
    $scope.copySongsWizardFinish = (item) => {
        MusicService.copySongs(item._id, $scope.copySongsWizard.songIDs)
            .then(() => {
                Notification.success('Successfully copied songs');
                $scope.copyWizardClose();
                const currVisible = $scope.music.currentPlaylistId === item._id;
                const currPlaying = $scope.music.currentPlayingPlaylistId === item._id;
                if (currVisible || currPlaying) {
                    MusicService.getPlaylist(item._id)
                        .then(response => {
                            if (response.data) {
                                if (currVisible) {
                                    $scope.music.currentPlaylistSongs = response.data;
                                }
                                if (currPlaying) {
                                    $scope.music.currentPlayingPlaylistSongs = response.data;
                                }
                            }
                        })
                        .catch(err => Notification.error(err.data));
                }
            })
            .catch(err => Notification.error(err.data));
    };
    $scope.copySongsWizardSelectDestPlaylists = () => {
        $scope.copySongsWizard.songIDs = $scope.copySongsWizard.srcPlaylist.songs
            .filter(s => s.copyActive)
            .map(s => s._id);
        $scope.copySongsWizard.step = 2;
    };
    $scope.copyWizardBack = step => {
      if (step === 0) {
          $scope.copySongsWizard.srcPlaylist = null;
          $scope.copySongsWizard.step = 0;
      }
      if (step === 1) {
          $scope.copySongsWizard.srcPlaylist.songs = $scope.copySongsWizard.srcPlaylist.songs
              .map(s => {
                  s.copyActive = undefined;
                  return s;
              });
          $scope.copySongsWizard.step = 1;
      }
    };
    $scope.copyWizardClose = () => {
        $scope.modals.copySongs.modal('hide');
        $scope.copySongsWizard = {
            step: 0,
            srcPlaylist: null,
            songIDs: [],
            destPlaylistsIDs: []
        };
    };
    $scope.copyWizardStepDescription = () => {
        switch ($scope.copySongsWizard.step) {
            case 0:
                return 'Select source';
            case 1:
                return 'Select songs';
            case 2:
                return 'Select destination';
        }
    }

    /**
     * LFM
     */
    $scope.lastFMWinRef = null;
    $scope.lfmAction = (option) => {
        if ($scope.user.lastFMUsername && $scope.user.lastFMKey && option) {
            $scope.user.lastFMToggle = !$scope.user.lastFMToggle;
            MusicService.setLastFMToggle($scope.user.lastFMToggle)
                .catch(err => Notification.error(err.data));
        } else {
            $scope.getLfmLink();
        }
    };
    $scope.getLfmLink = () => {
        MusicService.getLfmLink(socket.getId())
            .then(response => {
                if (response.data) {
                    $scope.lastFMWinRef = window.open(response.data, 'Last FM Auth',
                        `scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no,height=${screen.availHeight-100},width=${screen.availWidth-100},top=100,left=100`);
                    $scope.lastFMWinRef.focus();
                }
            })
            .catch(err => Notification.error(err.data));
    };
    $scope.scrobble = id => {
        if ($scope.user.lastFMToggle) {
            MusicService.scrobble(id)
                .catch(err => Notification.error(err.data));
        }
    };

    /**
     * Other
     */
    $scope.getWallp = () => {
        return $scope.user && $scope.user.backgroundToggle && $scope.user.background ?
            `url(${`/user/background/${$scope.user.background}`})` :
            'url(wallp.jpg)';
    };

    $scope.backgroundAction = () => {
        if (!$scope.user.background) {
            return Notification.info('Upload background first (double-click)');
        }
        return $scope.backgroundToggle();
    };

    $scope.backgroundUpload = () => {
        const stopWatch = $scope.$watch('music.backgroundFile', () => {
            if ($scope.music.backgroundFile && $scope.music.backgroundFile.length > 0) {
                stopWatch();
                $scope.loading = true;
                AuthService.uploadBackground($scope.music.backgroundFile[0])
                    .then(response => {
                        $scope.authGet();
                    })
                    .catch(err => Notification.info(err.data))
                    .finally(() => {
                        $scope.music.backgroundFile = null;
                        $scope.loading = false;
                    })
            }
        });
        $scope.music.backgroundInput.click();
    };

    $scope.backgroundToggle = () => {
        AuthService.toggleBackground()
            .then(response => {
                $scope.user.backgroundToggle = !$scope.user.backgroundToggle;
            })
            .catch(err => Notification.info(err.data));
    };

    $scope.downloadSong = (item) => {
        const link = document.createElement('a');
        link.download = `${item ? item.title : $scope.music.currentSongTitle}.mp3`;
        link.href = `/song/get/${item ? item._id : $scope.music.currentSongId}`;
        link.click();
    };

    $scope.checkYTButtonDisabled = () => {
        return $scope.music.youtubeLinks.filter(item => item === '').length > 0;
    };

    $scope.addYTRow = () => {
        if ($scope.music.youtubeLinks.length > 30) {
            return Notification.info('Maximum 30 songs at once');
        }
        $scope.music.youtubeLinks.push('');
    };

    $scope.removeYTRow = index => {
        $scope.music.youtubeLinks.splice(index, 1);
    };

    function fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }

        document.body.removeChild(textArea);
    }
    function copyTextToClipboard(text) {
        if (!navigator.clipboard) {
            fallbackCopyTextToClipboard(text);
            return;
        }
        navigator.clipboard.writeText(text).then(function() {
            console.log('Async: Copying to clipboard was successful!');
        }, function(err) {
            console.error('Async: Could not copy text: ', err);
        });
    }

    $scope.shareSongs = ids => {
        const port = $location.port();
        const link = `${$location.protocol()}://${$location.host()}${port === 80 || port === 443 ? '' : ':' + port}/shared?ids=${encodeURIComponent(btoa(ids.join(',')))}`;
        MusicService.getShortenedLink(link)
            .then(response => {
                copyTextToClipboard(response.data.shortUrl);
                Notification.info('Shared link has been copied to the clipboard');
            })
            .catch(err => {
                Notification.info(err.data)
            });
    };

    $scope.showPlaylistShareButton = () =>
        $scope.music.sharePlaylistSongs.filter(s => s.toShare).length > 0;

    $scope.showPlaylistSelectAllButton = () =>
        $scope.music.sharePlaylistSongs.filter(s => s.toShare).length < $scope.music.sharePlaylistSongs.length;

    $scope.showPlaylistDeselectAllButton = () =>
        $scope.music.sharePlaylistSongs.filter(s => s.toShare).length > 0;

    $scope.sharePlaylistSetAllStatus = status => {
        $scope.music.sharePlaylistSongs = $scope.music.sharePlaylistSongs
            .map(s => {
                s.toShare = status;
                return s;
            });
    };

    $scope.sharePlaylist = playlist => {
        MusicService.getPlaylist(playlist._id)
            .then(response => {
                if (response && response.data) {
                    $scope.music.sharePlaylistSongs = response.data;
                    $scope.modals.sharePlaylist.modal('show');
                }
            })
            .catch(err => Notification.info(err.data))
            .finally(() => {
                $scope.loading = false;
            });
    };

    $scope.copySharedPlaylist = () => {
        const ids = $scope.music.sharePlaylistSongs
            .filter(s => s.toShare)
            .map(s => s._id);
        $scope.modals.sharePlaylist.modal('hide');
        $scope.music.sharePlaylistSongs = [];
        $scope.shareSongs(ids);
    };

    $scope.openSimilar = song => {
        const query = song.replace(/ /g, '+');
        const url = `https://www.youtube.com/results?search_query=${query}`;
        window.open(url, 'Youtube Search',
            `scrollbars=yes,resizable=no,status=no,location=no,toolbar=no,menubar=no,height=${screen.availHeight-200},width=${screen.availWidth-200},top=50,left=50`);
    };

    $scope.openLyricsSearchGenius = () => {
        const query = encodeURI($scope.music.currentSongTitle);
        const url = `https://genius.com/search?q=${query}`;
        window.open(url, 'Genius Lyrics Search',
            `scrollbars=yes,resizable=no,status=no,location=no,toolbar=no,menubar=no,height=${screen.availHeight-200},width=${screen.availWidth-200},top=50,left=50`)
    };
    $scope.openLyricsSearchGoogle = () => {
        const query = encodeURI($scope.music.currentSongTitle.replace(/ /g, '+'));
        const url = `https://www.google.com/search?q=${query}+lyrics`;
        window.open(url, 'Google Lyrics Search',
            `scrollbars=yes,resizable=no,status=no,location=no,toolbar=no,menubar=no,height=${screen.availHeight-200},width=${screen.availWidth-200},top=50,left=50`)
    };

    $scope.changeSearchMode = mode => {
        if ($scope.music.searchOpt !== mode) {
            $scope.music.searchOpt = mode;
            if ($scope.music.searchLine) {
                $scope.search();
            }
        }
    };
    $scope.search = (query) => {
        if (query) {
            $scope.music.searchLine = query;
        }
        $scope.music.vkaudio.pause();
        $scope.music.vkaudio.src = '';
        if (!$scope.music.searchLine) {
            return $scope.music.searchResults = [];
        }
        $scope.music.searchResults = [];
        $scope.music.searchLoading = true;
        MusicService.search($scope.music.searchOpt, $scope.music.searchLine)
            .then(response => {
                if (response && response.data) {
                    console.log(response.data);
                    $scope.music.searchResults = response.data;
                }
            })
            .catch(err => Notification.info(err.data))
            .finally(() => {
                $scope.music.searchLoading = false;
            });
    };

    $scope.toggleVkAudio = audio => {
        if (audio.playing) {
            $scope.music.vkaudio.pause();
            audio.playing = false;
        } else {
            $scope.pause();
            $scope.music.vkaudio.pause();
            $scope.music.searchResults.forEach(item => item.playing = false);
            $scope.music.vkaudio.src = `/song/vkmp3/${audio.vk_id}/${audio.hash}`;
            $scope.music.vkaudio.play();
            audio.playing = true;
        }
    };

    $scope.downloadVKSong = (item) => {
        const link = document.createElement('a');
        link.download = `${item.title}.mp3`;
        link.href = `/song/vkmp3/${item.vk_id}/${item.hash}`;
        link.click();
    };

    $scope.getGroupedPlaylists = count => {
        const result = [];
        for (let i = 0; i < $scope.user.playlists.length; i+=count) {
            result.push($scope.user.playlists.slice(i, i + count));
        }
        return result.map(plistRow => {
            return plistRow.map(plist => {
                return {
                    id: plist._id,
                    name: plist.name
                }
            })
        });
    };

    $scope.uploadSongVK = (item, plistId) => {
        plistId = plistId || $scope.music.currentPlaylistId;
        item.adding = false;
        MusicService.uploadSongVK(item.title, item.vk_id, item.hash, item.duration, plistId, socket.getId())
            .catch(err => Notification.info(err.data));
    };

    $scope.getQueuePlaylistName = id => {
        const plist = $scope.user.playlists.find(plist => plist._id === id);
        return plist.name;
    }
}
