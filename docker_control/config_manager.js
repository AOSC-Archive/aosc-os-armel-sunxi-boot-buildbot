(() => {
  'use strict';
  const fs = require('fs');
  const log = require('../utils/log.js');
  var config = null;
  try {
    config = require('../config.json');
  } catch (e) {
    log.error('Config: Can\'t load config from file!');
  }

exports.getConfig = (key) => {
  return (config == null) ? null : config[key];
}

})();
