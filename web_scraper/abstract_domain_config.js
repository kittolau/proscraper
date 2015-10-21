/* jshint node: true, esnext:true */
'use strict';
var co = require('co');
var config = rootRequire('config');
var http   = require('http');
var https  = require('https');
var HttpProxyAgent         = require('http-proxy-agent');
var HttpsProxyAgent        = require('https-proxy-agent');
var socks = require('socksv5');

function AbstractDomainConfig() {
  this.domainDetailArray = [];
}

AbstractDomainConfig.prototype.setDomainDetialArray = function(array){
  this.domainDetailArray = array;
};

AbstractDomainConfig.prototype.createAgentSet = function(agentType,maxSockets,httpAgentAugments,httpsAgentAugments){
  maxSockets = maxSockets || config.scraper.globalMaxSockets;
  agentType  = agentType || "HTTP_AGENT";
  agentType  = agentType.toUpperCase();

  var agentSet = {};

  if(agentType == "HTTP_AGENT"){

    agentSet.httpAgent  = new http.Agent();
    agentSet.httpsAgent = new https.Agent();
  }else if(agentType == "DEFAULT_HTTP_PROXY_AGENT"){

    agentSet.httpAgent  = new HttpProxyAgent('http://127.0.0.1:3128');
    agentSet.httpsAgent = new HttpsProxyAgent('https://127.0.0.1:3128');
  }else if(agentType == "HTTP_PROXY_AGENT"){

    if(httpAgentAugments){
      throw new Error("httpAgentAugments is not given to " + agentType);
    }
    if(httpsAgentAugments){
      throw new Error("httpsAgentAugments is not given to " + agentType);
    }
    agentSet.httpAgent  = new HttpProxyAgent(httpAgentAugments);
    agentSet.httpsAgent = new HttpsProxyAgent(httpsAgentAugments);
  }else if(agentType == "DEFAULT_TOR_PROXY_AGENT"){

    var socksConfig = {
      proxyHost: '127.0.0.1',
      proxyPort: 9050,
      auths: [ socks.auth.None() ]
    };

    agentSet.httpAgent  = new socks.HttpAgent(socksConfig);
    agentSet.httpsAgent = new socks.HttpsAgent(socksConfig);
  }else if(agentType == "DEFAULT_SOCKS5_PROXY_AGENT"){

    var socksConfig = {
      proxyHost: '127.0.0.1',
      proxyPort: 1080,
      auths: [ socks.auth.None() ]
    };
    agentSet.httpAgent  = new socks.HttpAgent(socksConfig);
    agentSet.httpsAgent = new socks.HttpsAgent(socksConfig);
  }else if(agentType == "SOCKS5_PROXY_AGENT"){

    if(httpAgentAugments){
      throw new Error("httpAgentAugments is not given to " + agentType);
    }
    if(httpsAgentAugments){
      throw new Error("httpsAgentAugments is not given to " + agentType);
    }
    agentSet.httpAgent = new socks.HttpAgent(httpAgentAugments);
    agentSet.httpsAgent = new socks.HttpsAgent(httpsAgentAugments);
  }else if(agentType == "GLOBAL"){

    agentSet.httpAgent = false;
    agentSet.httpsAgent = false;
  }else{

    throw new Error(agentType + "does not match any agentType");
  }

  agentSet.httpAgent.maxSockets  = maxSockets;
  agentSet.httpsAgent.maxSockets = maxSockets;

  return agentSet;
};

AbstractDomainConfig.prototype.canHandleURL = function(url){
  for (var i = this.domainDetailArray.length - 1; i >= 0; i--) {
    var domainDetail = this.domainDetailArray[i];
    if(domainDetail.canHandleURL(url)){
      return true;
    }
  }
  return false;
};

AbstractDomainConfig.prototype.getControllerAllocationList = function(){
  var res=[];
  for (var i = this.domainDetailArray.length - 1; i >= 0; i--) {
    var domainDetail = this.domainDetailArray[i];
    res.push({
      domainNameIdentifier : domainDetail.domainNameIdentifier,
      requiredControllerCount : domainDetail.requiredControllerCount,
    });
  }
  return res;
};

// AbstractDomainConfig.prototype.getHandleableDomainNamePatternArray = function(){
//     var allPattern = [];
//     for (var i = this.domainDetailArray.length - 1; i >= 0; i--) {
//       var domainDetail = this.domainDetailArray[i];
//       allPattern.push(domainDetail.handleableDomainNamePatterns);
//     }
//     var merged = [].concat.apply([], allPattern);
//     return merged;
// };

AbstractDomainConfig.prototype.getRequestConfig = co.wrap(function* (url){
    for (var i = this.domainDetailArray.length - 1; i >= 0; i--) {
      var domainDetail = this.domainDetailArray[i];
      if(domainDetail.canHandleURL(url)){
        return domainDetail.getRequestConfig(url);
      }
    }
    return undefined;
});

module.exports = AbstractDomainConfig;
