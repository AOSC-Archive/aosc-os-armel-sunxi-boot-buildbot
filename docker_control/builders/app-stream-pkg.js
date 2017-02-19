(() => {
exports.builder = {name: 'Appstream Data Builder'};
exports.imageInfo = {name: 'ubuntu'};
let dockerOpts = {
    Image: imageInfo.name,
    Tty: true,
    Cmd: ['bash', '/workspace/builder.sh'],
    Binds: [path.resolve('../../utils/') + ':/workspace/builder.sh:ro',
    path.resolve('../out/') + ':/workspace/out:rw']
};


exports.preBuild = (done) => {
  done(dockerOpts);
};


})();
