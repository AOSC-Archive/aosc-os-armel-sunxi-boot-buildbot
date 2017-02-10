(() => {
'use strict';
const socketio = require('socket.io');
const docker   = require('../docker_control/dockerctl');
var api, io, gsocket;

module.exports.listen = (app) => {
    io = socketio.listen(app);
    api = io.of('/insomnia_build_api');
    api.on('connection', (socket) => {
      gsocket = socket;
      socket.on('hello', (time) => {
        socket.emit('termupdate', '\r\n');
        if(!docker.isBuilding()) {
          socket.emit('termupdate', '[+] No build is currently available.');
          return;
        };
        socket.emit('buildinfo', docker.getBuilderInfo());
        docker.getBuilderLog(time,(data)=>{socket.emit('termupdate', data);});
      });
    });

    return io;
}

module.exports.broadcast = (sig, msg) => {
  if (!api) {return;}
  api.emit(sig, msg);
}
})();
