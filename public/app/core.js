const myMusic = angular.module('mymusic', []);

myMusic
    .service('AuthService', AuthService)
    .controller('MainController', ['$scope', 'AuthService', MainController]);