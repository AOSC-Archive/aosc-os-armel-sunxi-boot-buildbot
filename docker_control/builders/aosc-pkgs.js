(() => {
const path = require('path');
const log = require('../../utils/log');
exports.builder = {name: 'AOSC Package Builder'};
const imageInfo = {name: 'aosc/aosc-os-buildkit', buildFile: './dot/Dockerfile.tar'};
let dockerOpts = {
    Image: imageInfo.name,
    Tty: true,
    Cmd: ['bash', '/workspace/builder.sh'],
    Binds: [path.resolve('./utils/???.sh') + ':/workspace/builder.sh:ro']
};


exports.preBuild = (done) => {
  done(dockerOpts);
};


})();
