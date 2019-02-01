function MainController($scope, $location, $anchorScroll, debounce, AuthService, MusicService, Notification, socket) {
    $('.modal').on('shown.bs.modal', function() {
        $(this).find('[autofocus]').focus();
    });

    $scope.queue = {};
    socket.on('progress:start', function (data) {
        $scope.queue[data.videoId] = {
            title: data.title,
            percentage: 0
        };
    });
    socket.on('progress:fail', function (data) {
        $scope.queue[data.videoId].failed = true;
        setTimeout(() => {
            delete $scope.queue[data.videoId];
        }, 1500);
    });
    socket.on('progress:update', function (data) {
        $scope.queue[data.videoId].percentage = Math.floor(data.progress) + '%';
        $scope.queue[data.videoId].eta = data.eta > 3 ? data.eta / 3 : 0;
        if ($scope.queue[data.videoId].percentage === '100%') {
            $scope.queue[data.videoId].percentage = 'Encoding...';
            debugger;
        }
    });
    socket.on('progress:finish', function (data) {
        Notification.info('Upload finished');
        $scope.queue[data.videoId].finished = true;
        if (data.plist === $scope.music.currentPlaylistId) {
            $scope.music.currentPlaylistSongs.unshift(data.newSong);
        }
        setTimeout(() => {
            delete $scope.queue[data.videoId];
        }, 1500);
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
    $scope.getQueueEta = () => {
        const summary = Object.keys($scope.queue).reduce((acc, key) => {
            const elem = $scope.queue[key];
            acc += (elem.percentage === 'Encoding' || !elem.eta) ? 0 : elem.eta;
            return acc;
        }, 0);
        return $scope.convertTime(summary);
    };
    $scope.showRemaining = () => {
        if ($scope.getKeysLength($scope.queue) === 0) {
            return false;
        }
        let counter = 0;
        for (let key in $scope.queue) {
            const elem = $scope.queue[key];
            if (!elem.finished && elem.percentage !== 'Encoding...') {
                counter++;
            }
        }
        return counter > 0;
    };

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
        sharePlaylist: $('#sharePlaylistModal').modal(initModalOptions)
    };
    $scope.music = {
        playing: false,
        repeat: false,
        random: false,
        scrobbled: false,
        loadingSongData: false,
        audio: $('#audio')[0],

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

        sharePlaylistSongs: []
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
        $scope.music.loadingSongData = true;
        MusicService.getSongData(song.title)
            .then(response => {
                if (response && response.data) {
                    $scope.music.currentSongData = response.data;
                }
            })
            .catch(err => Notification.error(err.data))
            .finally(() => {
                $scope.music.loadingSongData = false;
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
                            $scope.pause();
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
                $scope.getSongData({ title });
                Notification.success('Successfully renamed song');
            })
            .catch(err => Notification.info(err.data));
        $scope.music.renameSongTitle = '';
    };

    $scope.scrollToSong = id => {
        let offset = id ? angular.element(`#song-${id}`) &&
            angular.element(`#song-${id}`)[0] &&
            angular.element(`#song-${id}`)[0].offsetTop &&
            angular.element(`#song-${id}`)[0].offsetTop - 6 : -6;
        if (offset) {
            console.log(offset);
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
                const currPlist = $scope.music.addSongsDest._id;
                $scope.modals.addSong.modal('hide');
                $scope.loading = true;
                Notification.info('Upload started...');
                MusicService.uploadSong(currPlist, $scope.music.newSongFile)
                    .then(response => {
                        if (response.data) {
                            Notification.info('Upload finished')
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

    $scope.setSong = (song, currentPlayingPlaylistId, currentPlayingPlaylistName, currentPlayingPlaylistSongs) => {
        $scope.pause();
        $scope.music.audio.src = `/song/get/${song._id}`;
        $scope.music.currentSongId = song._id;
        $scope.music.currentSongTitle = song.title;
        $scope.music.currentSongData = null;
        $scope.music.currentPlayingPlaylistId = currentPlayingPlaylistId || $scope.music.currentPlaylistId;
        $scope.music.currentPlayingPlaylistName = currentPlayingPlaylistName || $scope.music.currentPlaylistName;
        $scope.music.currentPlayingPlaylistSongs = currentPlayingPlaylistSongs || $scope.music.currentPlaylistSongs;
        $scope.music.scrobbled = false;
        $scope.getSongData(song);
        $scope.play();
    };

    $scope.play = () => {
        if (!$scope.music.playing && $scope.music.currentSongId) {
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
    $scope.lfmAction = () => {
        if ($scope.user.lastFMUsername && $scope.user.lastFMKey) {
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
            'url(wallp.jpeg)';
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
            return Notification.info('Max 30 rows');
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
        copyTextToClipboard(link);
        Notification.info('Shared link has been copied to the clipboard');
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

}
