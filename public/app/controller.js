function MainController($scope, AuthService) {
    $scope.auth = false;
    $scope.loading = true;
    AuthService.authGet()
        .then(response => {
            if (response.data) {
                AuthService.set(response.data);
                $scope.auth = true;
            }
            $scope.loading = false;
        })
        .catch(err => alert(err.data));

    $scope.authPost = function () {
        $scope.loading = true;
        AuthService.authPost({username: 'aaa', password: '434'})
            .then(response => {
                if (response.data) {
                    AuthService.set(response.data);
                    $scope.auth = true;
                }
                $scope.loading = false;
            })
            .catch(err => alert(err.data));
    };

    $scope.logout = function () {
        $scope.loading = true;
        AuthService.authDelete()
            .then(response => {
                AuthService.set(null);
                $scope.auth = false;
                $scope.loading = false;
            })
            .catch(err => alert(err.data));
    }
}
