const myMusic = angular.module('shared', ['ngMedia']);

function SharedController($scope, $location, DataService) {
    $scope.music = {
        currentSongId: '',
        currentSongTitle: 'Shared Music',
        songs: [],
        playing: false,
        audio: $('#audio')[0],
        currentTime: '00:00',
        durationTime: '00:00'
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

    $scope.setSong = song => {
        $scope.pause();
        $scope.music.audio.src = `/song/get/${song._id}`;
        $scope.music.currentSongId = song._id;
        $scope.music.currentSongTitle = song.title;
        $scope.play();
    };

    $scope.next = () => {
        if (!$scope.music.currentSongId) {
            return;
        }
        const songIndex = $scope.music.songs
            .findIndex(song => song._id === $scope.music.currentSongId);
        let newIndex;
        if (songIndex === $scope.music.songs.length - 1) {
            newIndex = 0;
        } else {
            newIndex = songIndex + 1;
        }
        return $scope.setSong($scope.music.songs[newIndex]);
    };

    $scope.prev = () => {
        if (!$scope.music.currentSongId) {
            return;
        }
        let newIndex;
        const songIndex = $scope.music.songs
            .findIndex(song => song._id === $scope.music.currentSongId);
        newIndex = songIndex - 1;
        if (newIndex < 0) {
            newIndex = 0;
        }
        return $scope.setSong($scope.music.songs[newIndex]);
    };

    $scope.convertTime = secs => {
        secs = parseInt(secs);
        const mins = Math.floor(secs / 60);
        const finalMins = mins < 10 ? `0${mins}` : mins;
        const remainingSecs = secs % 60;
        const finalSecs = remainingSecs < 10 ? `0${remainingSecs}` : remainingSecs;
        return (!isNaN(finalMins) && !isNaN(finalSecs)) ? `${finalMins}:${finalSecs}` : null;
    };

    $scope.updateTime = () => {
        $scope.music.currentTime = $scope.convertTime($scope.music.audio.currentTime);
        $scope.music.durationTime = $scope.music.audio.duration ?
            $scope.convertTime($scope.music.audio.duration) :
            $scope.music.durationTime;
    };

    const params = $location.search();
    $scope.valid = params.type && (params.type === 's' || params.type === 'm') && params.id;
    if ($scope.valid) {
        DataService.get(params.type, params.id)
            .then(response => {
                if (response && response.data) {
                    $scope.music.songs = response.data;
                }
            }, err => {
                console.error(err);
                $scope.valid = false;
            });
    }
}

function DataService($http) {
    this.get = function (type, id) {
        return $http.get(`/user/shared/${type}/${id}`);
    };
}

myMusic
    .config(($locationProvider) => {
        $locationProvider.html5Mode({
            enabled: true,
            requireBase: false
        });
    })
    .service('DataService', DataService)
    .controller('SharedController', SharedController);