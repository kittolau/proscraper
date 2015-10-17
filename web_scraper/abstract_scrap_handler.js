/* jshint node: true, esnext:true */
'use strict';
var Promise    = require('bluebird');
var path       = require("path");
var fs         = Promise.promisifyAll(require("fs"));
var co         = require('co');
var request    = Promise.promisify(require('request'));
var config     = rootRequire('config');
var URLRequest = rootRequire('web_scraper/url_request');

function AbstractScrapHandler(services, agent) {
  this.beanstalkdClient = services.beanstalkdClient;
  this.mongodbClient    = services.mongodbClient;

  this.agent            = agent;
}

AbstractScrapHandler.prototype.getHandleableURLPattern = function (){
    throw new Error('getHandleableURLPattern() is not implemented in ' + this.constructor.name);
};

AbstractScrapHandler.prototype.getHostname = function (){
  throw new Error('getHostname() is not implemented in ' + this.constructor.name);
};

AbstractScrapHandler.prototype.maxConnection = function (){
  throw new Error('maxConnection() is not implemented in ' + this.constructor.name);
};

AbstractScrapHandler.prototype.handle = function (urlRequest){
    throw new Error('handle() is not implemented in ' + this.constructor.name);
};

AbstractScrapHandler.prototype.putURLRequest = co.wrap(function*(nextPageUrl,payload){

  var isURLBlank = !nextPageUrl || /^\s*$/.test(nextPageUrl);
  if(isURLBlank){
    throw new Error("cannot put empty URL in to job queue");
  }

  var urlRequest = new URLRequest(nextPageUrl,payload);
  yield this.beanstalkdClient.putURLRequest(urlRequest);
});


AbstractScrapHandler.prototype.writeFile = co.wrap(function*(path,content){
  yield fs.writeFileAsync(path, content);
});

AbstractScrapHandler.prototype.saveText = co.wrap(function*(filename,content){
  var filepath = path.join(config.root,"scraped_content",filename);
  yield this.writeFile(filepath, content);
});

AbstractScrapHandler.prototype.getPageSource = co.wrap(function*(url){
  var requestConfig = {
    url : url,
    method : "GET",
    followRedirect : true,
    timeout : 10000,
    agent: false
  };

  if(this.agent !== undefined){
    requestConfig.agent = this.agent;
  }

  var result = yield request(requestConfig)
  .catch(function(err){
    if(err.code === 'ETIMEDOUT'){
      if(err.connect === true){
        //connection timeout
        throw new Error("Connection timtout: " + url);
      }else{
        //read timout Or others
        throw new Error("Read timtout: " + url);
      }
    }else if(err.code === 'ECONNRESET'){
      //Connection reset by peer
      throw new Error("Connection reset by peer: " + url);
    }else if(err.code === 'ECONNREFUSED'){
      //Connection refused by target machine actively
      throw new Error("Connection refused: " + url);
    }else{
      throw new Error("Unknown error: " + err);
    }
  });

  return result[1];
});

module.exports = Promise.promisifyAll(AbstractScrapHandler);
