/* jshint node: true, esnext:true */
'use strict';
var inherits             = require('util').inherits;
var AbstractDomainConfig = rootRequire('web_scraper/abstract_domain_config');
var co = require('co');

function ExampleDomainConfig() {
  AbstractDomainConfig.call(this);

  // normal agent
  var http                   = require('http');
  this.httpAgent             = new http.Agent();
  this.httpAgent.maxSockets  = 20;

  var https                  = require('https');
  this.httpsAgent            = new https.Agent();
  this.httpsAgent.maxSockets = 20;

  // http proxy
  var HttpProxyAgent         = require('http-proxy-agent');
  this.httpAgent             = new HttpProxyAgent('http://127.0.0.1:3128');
  this.httpAgent.maxSockets  = 20;

  var HttpsProxyAgent        = require('https-proxy-agent');
  this.httpsAgent            = new HttpsProxyAgent('http://127.0.0.1:3128');
  this.httpsAgent.maxSockets = 20;

  // tor proxy
  var socksConfig = {
    proxyHost: 'localhost',
    proxyPort: 9050,
    auths: [ socks.auth.None() ]
  };

  var socks = require('socksv5');
  this.httpAgent = new socks.HttpAgent(socksConfig);
  this.httpAgent.maxSockets = 20;

  this.httpsAgent = new socks.HttpsAgent(socksConfig);
  this.httpsAgent.maxSockets = 20;
}
inherits(ExampleDomainConfig, AbstractDomainConfig);

ExampleDomainConfig.prototype.getHandleableHostnamePatternArray = function(){
  return [
  /what-ever-site-you-want\.com/g
  ];
};

ExampleDomainConfig.prototype.getRequestConfig = co.wrap(function* (uri){

  var agent = null;
  if(this.isHTTPS(uri)){
    agent = this.httpsAgent;
  }else{
    agent = this.httpAgent;
  }

  return {
    followRedirect : true,
    timeout : 15000,
    agent: agent
  };
});

module.exports = ExampleDomainConfig;
