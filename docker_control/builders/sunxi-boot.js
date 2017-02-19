(() => {
'use strict';
exports.builder = {name: 'SUNXI Image Builder'};
const imageInfo = {name: 'aosc-insomnia-sunxi', buildFile: './dot/Dockerfile.tar'};
const fs = require('fs');
const cfg = require('../config_manager');
const request = require('request');
const tempfile = require('tempfile2');
const path = require('path');
const log = require('../../utils/log');
var ccchain;
let ccpath = cfg.getConfig('cross_compiler_path');
let dockerOpts = {
    Image: imageInfo.name,
    Tty: true,
    Cmd: ['bash', '/workspace/builder.sh']
};

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

function getCCChain() {
    var ccbinpath = ccpath + '/bin/';
    if (!ccpath || !fs.existsSync(ccbinpath)) {
      log.error('Builder: Where\'s your cross compiler? I can\'t find it...');
      return null;
    }
    for (let file of fs.readdirSync(ccbinpath)) {
      var prefix = file.match(/(.*-)gcc/);
      if (prefix) {return prefix[1];}
    }
}

function genScript(callback) {
    /* In this step, we'll generate script from our template script,
    we'll figure out cross-compiling chain and latest kernel release together
    with U-Boot (Currently remain manually updated) then fill into the script
    */
    var fn = tempfile({
        path: '/tmp',
        ext: '.sh'
    });
    var script;
    ccchain = '/workspace/cross-gcc/bin/' + getCCChain();
    var writeScript = (fn, data) => {
        fs.open(fn, 'w+', (err, fd) => {
            if (err) {
                log.error('Builder: Error opening tempfile to write: ' + err);
            }
            fs.writeSync(fd, data);
            return fn;
        });
    }
    fs.open(__dirname + '/../../utils/build_template.sh', 'r', (err, fd) => {
        if (err) {
            log.error('Builder: Unable to read template script! ' + err); // WTF?!!
        }
        var script = fs.readFileSync(fd, 'utf-8');
        new Promise((res, rej) => {
            script = script.replace('++CROSS_CHAIN++', ccchain);
            getReleases((data) => {
                script = script.replace('++LINUX_SRC++', data.kernel)
                .replace('++UBOOT_SRC++', data.ub);
                res();
            });
        }).then(() => {
            fs.closeSync(fd);
            writeScript(fn, script);
            callback(fn);
        });
    });
}

exports.preBuild = (done) => {
  genScript((fn) => {
    var logfn = tempfile({
        path: './logs/',
        ext: '.log'
    });
    dockerOpts.Binds = [fn + ':/workspace/builder.sh:ro',
    ccpath + ':/workspace/cross-gcc:ro',
    path.resolve('../out/') + ':/workspace/out:rw'];
    // Here we "mount" the generated script into the container
    done(dockerOpts);
  });
};


})();
