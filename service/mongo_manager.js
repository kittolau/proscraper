/* jshint node: true */
'use strict';
var Promise   = require('bluebird');
var mongoskin = require("mongoskin");
Object.keys(mongoskin).forEach(function(key) {
  var value = mongoskin[key];
  if (typeof value === "function") {
    Promise.promisifyAll(value);
    Promise.promisifyAll(value.prototype);
  }
});
Promise.promisifyAll(mongoskin);
var logger = rootRequire('service/logger_manager');
var config = rootRequire('config');

function MongeManager() {
  this.dbObject = null;
}

MongeManager.prototype.getDB = function (){
	if(this.dbObject === null){
		this.dbObject = this.__buildDBObject();
	}
	return this.dbObject;
};

MongeManager.prototype.upsert = function(collection, key, data){
  var self = this;

  logger.debug("Upsert: ");
  logger.debug(arguments);

  return this
  .getPromisifiedCollection(collection)
  .updateAsync(
    key,
    {
      $currentDate :{
        update_at: true,
        "scraper_update_at": { $type: "timestamp" }
      },
      $set: data
    },
    {upsert:true}
  );
};

MongeManager.prototype.getPromisifiedCollection = function(collection_name){
	var db = this.getDB();
	var collection = db.collection(collection_name, {strict: true});
	Promise.promisifyAll(collection);
	return collection;
};

MongeManager.prototype.close = function (){
	if(this.dbObject === null){
		return;
	}else{
		this.dbObject.close();
	}
};

MongeManager.prototype.__buildDBObject = function(){
	try {
		var DB_URL = config.mongo.host;
		var DB_PORT = config.mongo.port;
		var DB_NAME = config.mongo.database;
		var db = mongoskin.db('mongodb://'+DB_URL+':'+DB_PORT+'/'+DB_NAME);
		return db;
 	} catch (err) {
 		logger.debug(err);
 	}
};

module.exports = MongeManager;
