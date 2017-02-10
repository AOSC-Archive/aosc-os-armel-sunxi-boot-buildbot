'use strict';
const bodyParser = require('body-parser');
const GithubWebHook = require('express-github-webhook');
let dockerctl= require('../docker_control/dockerctl.js');
const webhookHandler = GithubWebHook({ path: '/insomnia'});

module.exports.listen = (app) => {
    app.use(bodyParser.json()); // for use with GitHub webhookHandler
    app.use(webhookHandler);
    webhookHandler.on('push', function (repo, data) {
       console.log('Got a push: ' + data);
       dockerctl.startBuild();
    });
    return webhookHandler;
}
