'use strict';
var app = require('express')();
const express = require('express');
const server = require('http').Server(app);
const io = require('./web_control/socketio').listen(server);
const webhookHandler = require('./web_control/webhook').listen(app);

// Webpage server
app.set('trust proxy', 'loopback');
server.listen(5000, function () {
  console.log('combined server: Services listening at port ' + server.address().port);
});
// WebPage Rendering - Engine (PugJS)
app.set('view engine', 'pug');
app.set('views', './views');
// Routing - Filters
app.use(express.static('static'));
app.use('/', require('./web_control/router.js'));
app.get( '*' , (req, res) => {
   console.log('router: Client requested a unreachable URI ' + req.originalUrl);
   res.status(404).render('err/404', {'params' : {
     'url' : req.path
   }});
 });
app.all( '*' , (req, res) => {
 console.log('router: Bad Request ' + req.originalUrl);
 res.sendStatus(400);
});
