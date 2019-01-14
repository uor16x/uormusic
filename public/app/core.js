const myMusic = angular.module('mymusic', ['ui-notification', 'ngMedia', 'ui.sortable']);

myMusic
    .factory('socket', function ($rootScope) {
        const socket = io.connect();
        return {
            on: function (eventName, callback) {
                socket.on(eventName, function () {
                    const args = arguments;
                    $rootScope.$apply(function () {
                        callback.apply(socket, args);
                    });
                });
            },
            emit: function (eventName, data, callback) {
                socket.emit(eventName, data, function () {
                    const args = arguments;
                    $rootScope.$apply(function () {
                        if (callback) {
                            callback.apply(socket, args);
                        }
                    });
                })
            },
            getId: () => socket.id
        };
    })
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