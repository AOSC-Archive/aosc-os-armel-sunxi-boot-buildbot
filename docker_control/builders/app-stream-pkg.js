(() => {
exports.builder = {name: 'Appstream Data Builder'};
exports.imageInfo = {name: 'ubuntu'};
let dockerOpts = {
    Image: imageInfo.name,
    Tty: true,
    Cmd: ['bash', '/workspace/builder.sh']
};


exports.preBuild = (done) => {

};


})();
