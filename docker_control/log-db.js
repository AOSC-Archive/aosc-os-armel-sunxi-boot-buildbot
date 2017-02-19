(()=>{
  'use strict';
  let redis   = require('redis');
  let bluebird= require('bluebird');
  bluebird.promisifyAll(redis.RedisClient.prototype);
  bluebird.promisifyAll(redis.Multi.prototype);
  let redisAdapter = redis.createClient({prefix: 'logs:'});
  redisAdapter.select('0');

  exports.saveLogEntry = (logfn, infoObj, callback) => {
    if (!infoObj) {return;}
    let logEntry = infoObj;
    logEntry.fn = logfn;
    redisAdapter.set(infoObj.startTime * 1000, JSON.stringify(logEntry), (err, res) => {
      if (callback) {callback(res);}
    });
  }

  exports.getLogList = (callback) => {
    redisAdapter.keys('logs:*', (err, res) => {callback(res);});
  }

  exports.getLogEntry = (timestamp, callback) => {
    redisAdapter.exists(timestamp, (err, res) => {
      if (res === 1) {
        redisAdapter.get(timestamp, (err, res) => {
          if (err) {return;}
          if (callback) {callback(JSON.parse(res));}
        });
      } else {
        callback(null);
      }
    });
  }

})();
