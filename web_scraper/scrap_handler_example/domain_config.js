/* jshint node: true, esnext:true */
'use strict';
var inherits             = require('util').inherits;
var AbstractDomainConfig = rootRequire('web_scraper/abstract_domain_config');
var DomainConfigDetail = rootRequire('web_scraper/domain_config_detail');

var co = require('co');

function ExampleDomainConfig() {
  AbstractDomainConfig.call(this);
  var self = this;

  var domainConfigDetailList = [];

  var getProxyConfigDetail = new DomainConfigDetail(
    'getproxy.jp', //domainNameIdentifier
    1, //requiredControllerCount
    self.createAgentSet("HTTP_AGENT"), //agentSet
    { //requestConfig
      followRedirect : true,
      timeout : 15000
    },
    [ //handleableDomainNamePatterns
      /getproxy\.jp/g
    ]
  );
  domainConfigDetailList.push(getProxyConfigDetail);


  self.setDomainDetialArray(domainConfigDetailList);
}
inherits(ExampleDomainConfig, AbstractDomainConfig);

module.exports = ExampleDomainConfig;
