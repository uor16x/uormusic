function MainController($scope, AuthService) {
    $scope.music = {
        playing: false
    };

    $scope.auth = false;
    $scope.loading = true;
    $scope.authData = {
        username: '',
        password: ''
    };

    AuthService.authGet()
        .then(response => {
            if (response.data) {
                AuthService.set(response.data);
                $scope.auth = true;
            }
        })
        .catch(err => alert(err.data))
        .finally(() => {
            $scope.loading = false;
        });

    $scope.authPost = function () {
        if (!$scope.authData.username) {
            return alert('Username missing');
        }
        if (!$scope.authData.password) {
            return alert('Password missing');
        }
        $scope.loading = true;
        AuthService.authPost($scope.authData)
            .then(response => {
                if (response.data) {
                    AuthService.set(response.data);
                    $scope.auth = true;
                }

            })
            .catch(err => alert(err.data))
            .finally(() => {
                $scope.authData.password = '';
                $scope.loading = false;
            });
    };

    $scope.logout = function () {
        $scope.loading = true;
        AuthService.authDelete()
            .then(response => {
                AuthService.set(null);
                $scope.auth = false;
            })
            .catch(err => alert(err.data))
            .finally(() => {
                $scope.loading = false;
            });
    }
}
