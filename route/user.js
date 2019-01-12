const router = require('express').Router();
let app;

module.exports = _app => {
    app = _app;

    /**
     * Get user
     */
    router.get('/auth', (req, res) => {
        return res.result(null, req.session.auth ? req.session.user : null);
    });

    /**
     * Sign in / Sign up
     */
    router.post('/auth', async (req, res) => {
        if (!req.body.username) {
            return res.result('Username missing');
        }
        if (!req.body.password) {
            return res.result('Password missing');
        }
        let currUser;
        const findUser = await app.services.user.get({ username: req.body.username });
        if (!findUser) {
            /**
             * Sign up
             */
            const newUser = await app.services.user.create(req.body.username, req.body.password);
            if (!newUser) {
                return res.result('Error create user')
            }
            newUser.password = undefined;
            currUser = newUser;
        } else {
            /**
             * Sign in
             */
            const passwordMatch = await app.services.user.verifyPassword(req.body.password, findUser.password);
            if (!passwordMatch) {
                return res.result('Wrong password')
            }
            findUser.password = undefined;
            currUser = findUser;
        }
        req.session.auth = true;
        req.session.user = currUser;
        return res.result(null, currUser);
    });

    /**
     * Logout
     */
    router.delete('/auth', (req, res) => {
        req.session.auth = false;
        req.session.user = null;
        return res.result(null);
    });

    return router;
};



