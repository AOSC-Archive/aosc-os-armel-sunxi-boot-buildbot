(() => {
'use strict';
const socketio = require('socket.io');
const docker   = require('../docker_control/dockerctl');
const log_db   = require('../docker_control/log-db');
const fs = require('fs');
var api, io;

function ToLocalDate (inDate) {
    var date = new Date(inDate);
    date.setTime(date.valueOf() - 60000 * date.getTimezoneOffset());
    return date.toISOString();
}

module.exports.listen = (app) => {
    io = socketio.listen(app);
    api = io.of('/insomnia_build_api');
    api.on('connection', (socket) => {
      socket.on('hello', (time) => {
        socket.emit('termupdate', '\r\n');
        if(!docker.isBuilding()) {
          socket.emit('termupdate', '[+] No build is currently available.');
          return;
        };
        socket.emit('buildinfo', docker.getBuilderInfo());
        docker.getBuilderLog(time,(data)=>{
          socket.emit('termupdate', data);
        });
      });
      socket.on('logview', (opts) => {
        if (opts == 'ls') {
          log_db.getLogList((res)=> {
            if (!res) {return;}
            let buf = 'List of logs (ID):\r\n';
            for (let i of res) {
              let ts = i.split(':')[1];
              buf += ts + '\t' + ToLocalDate(parseInt(ts)) + '\r\n';
            }
            buf += '\r\n-----> ' + res.length + ' entries.\r\n'
            socket.emit('logview', buf);
          });
      } else {
        let ts = parseInt(opts);
        if (ts) {
          log_db.getLogEntry(ts, (res) => {
            if (!res) {socket.emit('logview', '[!] Error! No such entry!');return;}
            socket.emit('buildinfo', {start: res.startTime, id: res.id, stop: res.stop});
            fs.readFile(res.fn, 'utf-8', (err, data)=>{
              console.log(res.fn);
              if (err) {console.error('Log-DB: Unable to read log file: ' + err);return;}
              socket.emit('renderfile', data);
            });
            return;
          });
        } else {
          socket.emit('logview', '[!] Invaild input!\r\n');
        }
      }
      });
    });

    return io;
}

module.exports.broadcast = (sig, msg) => {
  if (!api) {return;}
  api.emit(sig, msg);
}
})();
