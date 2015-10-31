/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var Promise   = require('bluebird');
var config            = rootRequire('config');
var mongoskin = require("mongoskin");
Object.keys(mongoskin).forEach(function(key) {
  var value = mongoskin[key];
  if (typeof value === "function") {
    Promise.promisifyAll(value);
    Promise.promisifyAll(value.prototype);
  }
});
Promise.promisifyAll(mongoskin);


var DB_URL = config.mongo.host;
var DB_PORT = config.mongo.port;
var DB_NAME = config.mongo.database;
var db = mongoskin.db('mongodb://'+DB_URL+':'+DB_PORT+'/'+DB_NAME);
db.createCollectionAsync('web_proxys').then(function(){
  db.close();
});
