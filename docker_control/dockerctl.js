(() => {
'use strict';
const Docker = require('dockerode');
const fs = require('fs');
const cfg = require('./config_manager');
const imgName = 'aosc-insomnia-sunxi';
const tempfile = require('tempfile2');
const path = require('path');
const socketio = require('../web_control/socketio');
const through = require('through2');
const log_db = require('./log-db');
let log = require('../utils/log.js');
var docker, containerObj;
var queue = [];
var dockerBuilder = {};

function isBuilding() {
    return dockerBuilder.alive;
}

exports.getBuilderLog = (since, callback) => {
    var epoch = 0;
    var buffer = '';
    if (!isBuilding) {
        callback(null);
    }
    if (since) {
        epoch = since;
    }
    containerObj.logs({
        since: epoch,
        stdout: 1,
        stderr: 1
    }, (err, data) => {
        if (err) {
            log.error('Docker API: Fetch log: ' + err);
        }
        data.on('data', (chunk) => {
            buffer += chunk; // accumulate logs
        });
        data.on('end', () => {
            callback(buffer);
        });
    });
}

exports.getBuilderInfo = () => {
    return {
        start: dockerBuilder.startTime,
        id: dockerBuilder.id
    };
}

exports.dockerinit = () => { // '127.0.0.1:8777'
    docker = new Docker(cfg.getConfig('docker'));
    // Test if our connection is vaild (since Dockerode won't throw errors on error)
    docker.ping((err, res) => {
        if (!res) {
            throw 'Unable to retrieve data from Docker daemon: ' + err + ' Shutting down...';
        }
        console.log('Docker API: Successfully connected to Docker API endpoint');
    });
};

exports.getDaemonInfo = (callback) => {
    if (!docker) {
        log.error('Docker API: Not yet initialized');
        return;
    }
    docker.info((err, res) => {
        if (!res) {
            log.error('Docker API: Unable to retrieve data from Docker daemon!');
        }
        callback(res);
    });
};

exports.updateImage = () => {
    // Currently very buggy, unsure about the cause. Seems like Docker will build
    // the image, but won't save it to local storage area (?)
    log.info('Docker API: Updating base image...');
    if (!docker) {
        log.error('Docker API: Not yet initialized');
        return;
    }
    docker.buildImage('./dot/Dockerfile.tar', {
        t: imgName
    }, (err, res) => {
        if (err) {
            log.error('Docker API: Image building > errored.');
            throw err;
        }
        log.info('Docker API: Image building > started.')
    });
}

exports.isBuilding = isBuilding;

exports.triggerBuild = (repo) => {
  const map = {'AOSC-Dev/aosc-os-armel-sunxi-boot': 'sunxi-boot', 'AOSC-Dev/aosc-appstream-data': 'aosc-appstream-pkg'};
  if (!map[repo]) {
    log.warn('Docker API: The repository ' + repo + ' is unknown to me...');
    return;
  }
  var builder = require('./builders/' + map[repo]);
  return startBuild(builder);
};

function startBuild(builder) {
    log.info('Docker API: Attempt to initialize a new build...');
    if (!docker) {
        log.error('Docker API: Initialization failure');
        return;
    }
    if (isBuilding()) {
        log.warn('Docker API: Another build is in progress, this one is queued...');
        return;
    }
    builder.preBuild((opts) => {
        var logfn = tempfile({
            path: '../logs/',
            ext: '.log'
        });
        docker.createContainer(opts, (err, container) => {
            if (err) {
                log.error('Docker API: Failed to create container: ' + err);
                return;
            }
            containerObj = container;
            container.start((err, data) => {
                dockerBuilder = {
                    alive: true,
                    startTime: Date.now() / 1000
                };
                container.inspect(function(err, data) {
                    dockerBuilder.id = data.Config.Hostname;
                });
                container.attach({
                    stream: true,
                    stdout: true,
                    stderr: true
                }, (err, stream) => {
                    stream.on('end', () => {
                        var EndTime = Date.now() / 1000;
                        dockerBuilder.alive = false;
                        dockerBuilder.stop = EndTime;
                        socketio.broadcast('buildstop', EndTime);
                        log_db.saveLogEntry(path.resolve(logfn), dockerBuilder);
                        container.remove({}, () => {});
                        if (queue.length() > 0) {
                          console.log('Docker Builder: Catching up with backlog: ' + queue.length() + ' remaining')
                          startBuild(queue.pop());
                        }
                    });
                    stream.pipe(through.obj((chunk, enc, callback) => {
                        fs.writeFile(logfn, chunk.toString(), {
                            flag: 'a'
                        }, (err) => {
                            return;
                        });
                        socketio.broadcast('termupdate', chunk.toString());
                        callback();
                    }));
                });
            });
        });
    }); // end of genscript callbacks
}

})();
