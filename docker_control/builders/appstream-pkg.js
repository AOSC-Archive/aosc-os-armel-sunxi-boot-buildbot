(() => {
const path = require('path');
const log = require('../../utils/log');
exports.builder = {name: 'Appstream Data Builder'};
const imageInfo = {name: 'aosc-insomnia-sunxi', buildFile: './dot/Dockerfile.tar'};
let dockerOpts = {
    Image: imageInfo.name,
    Tty: true,
    Cmd: ['bash', '/workspace/builder.sh'],
    Binds: [path.resolve('./utils/appstream_pkg_tpl.sh') + ':/workspace/builder.sh:ro',
    path.resolve('./out/') + ':/workspace/out:rw']
};


exports.preBuild = (done) => {
  done(dockerOpts);
};


})();
