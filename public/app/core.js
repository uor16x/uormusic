const myMusic = angular.module('mymusic', ['ui-notification', 'ngMedia', 'ui.sortable']);

myMusic
    .config(function(NotificationProvider) {
        NotificationProvider.setOptions({
            delay: 5000,
            startTop: 20,
            startRight: 10,
            verticalSpacing: 10,
            horizontalSpacing: 10,
            positionX: 'right',
            positionY: 'bottom',
            maxCount: 5
        });
    })
    .directive('fileModel', ['$parse', fileModel])
    .service('AuthService', AuthService)
    .service('MusicService', MusicService)
    .controller('MainController', MainController);