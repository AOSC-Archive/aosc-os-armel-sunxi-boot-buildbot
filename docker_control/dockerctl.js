(() => {
'use strict';
const Docker = require('dockerode');
const fs = require('fs');
const imgName = 'aosc-insomnia-sunxi';
const tempfile = require('tempfile2');
const request = require('request');
const bluebird = require('bluebird');
const socketio = require('../web_control/socketio');
const through = require('through2');
let log = require('../utils/log.js');
var docker, containerObj;
var dockerBuilder = {};

function isBuilding() {
    return dockerBuilder.alive;
}

exports.getBuilderLog = (since, callback) => {
    var epoch = 0;
    if (!isBuilding) {callback(null);}
    if (since) {epoch = since;}
    containerObj.logs({since: epoch, stdout: 1, stderr: 1}, (err, data) => {
      if (err) {log.error('Docker API: Fetch log: ' + err);}
      data.on('data', (chunk)=>{
        callback(chunk.toString());
      });
    });
}

exports.getBuilderInfo = () => {
    return {start: dockerBuilder.startTime, id: dockerBuilder.id};
}

exports.dockerinit = () => { // '127.0.0.1:8777'
    docker = new Docker({
        host: '127.0.0.1',
        port: 8777
    });
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


function getReleases(callback) {
    var releases = {};
    const u_boot = 'ftp://ftp.denx.de/pub/u-boot/u-boot-2017.03-rc1.tar.bz2';
    releases.ub = u_boot;
    request.get({
        url: 'https://www.kernel.org/releases.json',
        json: true
    }, (err, res, data) => {
        if (err) {
            log.error('Builder: Failed to determine latest kernel release!' + err);
            callback(null);
        }
        let latest = data.latest_stable.version;
        for (let i of data.releases) {
            if (i.version == latest) {
                releases.kernel = i.source;
            }
        }
        callback(releases);
    });
}

function genScript(callback) {
    var fn = tempfile({
        path: '/tmp',
        ext: '.sh'
    });
    var script;
    var writeScript = (fn, data) => {
        fs.open(fn, 'w+', (err, fd) => {
            if (err) {
                log.error('Builder: Error opening tempfile to write: ' + err);
            }
            fs.writeSync(fd, data);
            return fn;
        });
    }
    fs.open(__dirname + '/../utils/build_template.sh', 'r', (err, fd) => {
        if (err) {
            log.error('Builder: Unable to read template script! ' + err); // WTF?!!
        }
        var script = fs.readFileSync(fd, 'utf-8');
        new Promise((res, rej) => {
            getReleases((data) => {
                script = script.replace('++LINUX_SRC++', data.kernel).replace('++UBOOT_SRC++', data.ub);
                res();
            });
        }).then(() => {
            fs.closeSync(fd);
            writeScript(fn, script);
            callback(fn);
        });
    });
}

exports.startBuild = () => {
    log.info('Docker API: Attempt to initialize a new build...');
    if (!docker) {
        log.error('Docker API: Initialization failure');
        return;
    }
    if (isBuilding()) {
        log.warn('Docker API: Another build is in progress, bailing out...');
        return;
    }
    genScript((fn) => {
        docker.createContainer({
            Image: imgName,
            Tty: true,
            Cmd: ['bash', '/workspace/builder.sh'],
            Binds: [fn + ':/workspace/builder.sh:ro']
        }, (err, container) => {
            if (err) {
                log.error('Docker API: Failed to create container: ' + err);
                return;
            }
            containerObj = container;
            container.start((err, data) => {
                dockerBuilder = {alive: true, startTime: Date.now() / 1000};
                container.inspect(function (err, data) {
                    dockerBuilder.id = data.Config.Hostname;
                });
                container.attach({
                    stream: true,
                    stdout: true,
                    stderr: true
                }, (err, stream) => {
                    stream.pipe(through.obj((chunk, enc, callback) => {
                      socketio.broadcast('termupdate', chunk.toString());
                      callback();
                    }));
                });
            });
        });
    });
}

})();
