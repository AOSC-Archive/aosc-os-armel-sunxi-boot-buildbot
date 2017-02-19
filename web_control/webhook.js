'use strict';
const bodyParser = require('body-parser');
const GithubWebHook = require('express-github-webhook');
let dockerctl= require('../docker_control/dockerctl.js');
const webhookHandler = GithubWebHook({ path: '/insomnia'});

module.exports.listen = (app) => {
    app.use(bodyParser.json()); // for use with GitHub webhookHandler
    app.use(webhookHandler);
    webhookHandler.on('push', function (repo, data) {
       console.log('Got a push at ' + data.repository.full_name + ' by ' + data.head_commit.author.name);
       dockerctl.triggerBuild(data.repository.full_name);
    });
    return webhookHandler;
}
