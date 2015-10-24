/* jshint node: true, esnext:true */
'use strict';
var URLRequest        = rootRequire('web_scraper/url_request');
var logger            = rootRequire('service/logger_manager');
var BeanstalkdManager = rootRequire("service/beanstalkd_manager");
var config            = rootRequire('config');

function URLRequestSeeder(config,domainId,urls) {
  this.beanstalkdClient = new BeanstalkdManager(config,domainId);
  this.urls = urls;
}

URLRequestSeeder.prototype.seed = function(){
  var self = this;

  var urls = self.urls;

  if(typeof urls == 'string'){
    self.beanstalkdClient.putURLRequest(new URLRequest(urls));
  }

  if(Array.isArray(urls)){
    for (var i = urls.length - 1; i >= 0; i--) {
      var url = urls[i];
      self.beanstalkdClient.putURLRequest(new URLRequest(url));
    }
  }
};

URLRequestSeeder.prototype.onError = function(err){
  logger.warn(err);
  logger.warn(err.stack);
};

module.exports = URLRequestSeeder;
