const myMusic = angular.module('mymusic', ['ui-notification', 'ngMedia', 'ui.sortable']);

myMusic
    .directive('sglclick', ['$parse', function($parse) {
        return {
            restrict: 'A',
            link: function(scope, element, attr) {
                let fn = $parse(attr['sglclick']);
                let delay = 300, clicks = 0, timer = null;
                element.on('click', function (event) {
                    clicks++;
                    if(clicks === 1) {
                        timer = setTimeout(function() {
                            scope.$apply(function () {
                                fn(scope, { $event: event });
                            });
                            clicks = 0;
                        }, delay);
                    } else {
                        clearTimeout(timer);
                        clicks = 0;
                    }
                });
            }
        };
    }])
    .factory('debounce', function($timeout) {
        return function(callback, interval) {
            let timeout = null;
            return function() {
                $timeout.cancel(timeout);
                timeout = $timeout(function () {
                    callback.apply(this, arguments);
                }, interval);
            };
        };
    })
    .factory('socket', function ($rootScope) {
        const socket = io.connect({secure: true});
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
            startTop: 40,
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