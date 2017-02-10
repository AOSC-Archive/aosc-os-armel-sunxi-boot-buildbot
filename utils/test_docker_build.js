const Docker = require('dockerode');
const through= require('through2');
const imgName= 'aosc-insomnia-sunxi';
let log      = require('./log.js');
docker = new Docker({
    host: '127.0.0.1',
    port: 8777
});
docker.buildImage('../dot/Dockerfile.tar', {t: imgName}, (err, res) => {
  if (err) {
    log.error('Docker API: Image building > errored.');
    throw err;
  }
  log.info('Docker API: Image building > started.');
  res.pipe(through.obj((chunk, enc, callback) => {
    let payload = JSON.parse(chunk.toString());
    if (payload.stream) {process.stdout.write(payload.stream);}
    callback();
  }));
});
