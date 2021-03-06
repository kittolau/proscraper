/* jshint node: true, esnext:true */
'use strict';
var inherits             = require('util').inherits;
var AbstractDomainConfig = rootRequire('web_scraper/abstract_domain_config');
var DomainConfigDetail = rootRequire('web_scraper/domain_config_detail');

function DomainConfig() {
  AbstractDomainConfig.call(this);
  var self = this;
  var domainConfigDetailList = [];
  var aProxyConfigDetail = null;


  //copy and edit
  aProxyConfigDetail = new DomainConfigDetail(
      'whatever-you-want-to-crawl.com', //domainNameIdentifier
      4, //requiredControllerCount
      null, //maximunDepthLevel
      //self.createAgentSet("HTTP_AGENT"), //agentSet
      self.createAgentSet("DEFAULT_HTTP_PROXY_AGENT"), //agentSet
      { //requestConfig
        followRedirect : true,
        timeout : 15000
      },
      [ //handleableDomainNamePatterns
        /whatever-you-want-to-crawl\.com/g
      ],
      [ //seedURLs
        "http://www.whatever-you-want-to-crawl.com/",
      ]
    );
    domainConfigDetailList.push(aProxyConfigDetail);



  self.setDomainDetialArray(domainConfigDetailList);
}
inherits(DomainConfig, AbstractDomainConfig);

module.exports = DomainConfig;
