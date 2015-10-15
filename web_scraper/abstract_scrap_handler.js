/* jshint node: true, esnext:true */
'use strict';
var Promise    = require('bluebird');
var path       = require("path");
var fs         = Promise.promisifyAll(require("fs"));
var co         = require('co');
var request    = Promise.promisify(require('request'));
var config     = rootRequire('config');
var URLRequest = rootRequire('web_scraper/url_request');

function AbstractScrapHandler(services) {
  this.queueClient = services.queueClient;
  this.dbClient    = services.dbClient;
}

AbstractScrapHandler.getHandleableURLPattern = function (){
    throw new Error('getHandleableURLPattern() is not implemented in ' + this.constructor.name);
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
  yield this.queueClient.putURLRequest(urlRequest);
});


AbstractScrapHandler.prototype.writeFile = co.wrap(function*(path,content){
  yield fs.writeFileAsync(path, content);
});

AbstractScrapHandler.prototype.saveText = co.wrap(function*(filename,content){
  var filepath = path.join(config.root,"scraped_content",filename);
  yield this.writeFile(filepath, content);
});

AbstractScrapHandler.prototype.getPageSource = co.wrap(function*(url){
        var result = yield request({
          url : url,
          method : "GET",
          followRedirect : true,
          timeout : 10000
        }).catch(function(err){
          if(err.code === 'ETIMEDOUT'){
            if(err.connect === true){
              //connection timeout
              return Promise.reject("Connection timtout: " + url);
            }else{
              //read timout Or others
              return Promise.reject("Read timtout: " + url);
            }
          }else if(err.code === 'ECONNRESET'){
            //Connection reset by peer
            return Promise.reject("Connection reset by peer: " + url);
          }else if(err.code === 'ECONNREFUSED'){
            //Connection refused by target machine actively
            return Promise.reject("Connection refused: " + url);
          }else{
            return Promise.reject("Unknown error: " + err);
          }
        });
        return result[1];
});

module.exports = Promise.promisifyAll(AbstractScrapHandler);
