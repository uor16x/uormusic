function fileModel($parse) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            const model = $parse(attrs.fileModel);
            const modelSetter = model.assign;

            element.bind('change', function(){
                scope.$apply(function(){
                    modelSetter(scope, element[0].files);
                });
            });
        }
    };
}