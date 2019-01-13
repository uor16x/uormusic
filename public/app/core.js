const myMusic = angular.module('mymusic', []);

myMusic
    .directive('fileModel', ['$parse', fileModel])
    .service('AuthService', AuthService)
    .service('MusicService', MusicService)
    .controller('MainController', ['$scope', 'AuthService', 'MusicService', MainController]);