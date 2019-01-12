function AuthService($http) {
    let _user = null;

    this.get = function () {
        return _user;
    };
    this.set = function (user) {
        _user = user;
    };

    this.authPost = function (data) {
        return $http.post('/user/auth', data);
    };
    this.authGet = function () {
        return $http.get('/user/auth');
    };
    this.authDelete = function () {
        return $http.delete('/user/auth');
    };
}