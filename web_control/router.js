/* ---- Router ---- */
(() => {
'use strict';

let express  = require('express');
let router   = express.Router();
let dockerctl= require('../docker_control/dockerctl.js');

router.get('/insomnia', (err, res) => {
    res.render('index');
});

router.get('/', (err, res) => {
    res.status(301).redirect('/insomnia');
});

(function init() {
    dockerctl.dockerinit();
})();

router.get('/insomnia_build', (err, res) => {
    res.render('terminal');
});

router.get('/status', (err, res) => {
    dockerctl.getDaemonInfo((data) => {
        if (!data) {
          res.render('status', {'params':
          {'status': 'Offline',
           'Name': '-','OperatingSystem': '-',
           'NCPU': '-',
           'DefaultRuntime': '-', 'Busy': '-'}});
          return;
        }
        var status = data;
        status.status = 'Online';
        status.busy = dockerctl.isBuilding() ? 'Busy' : 'Idle';
        res.render('status', {'params': status});
    });
});
module.exports = router;
})();
