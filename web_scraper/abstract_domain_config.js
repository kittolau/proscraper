/* jshint node: true, esnext:true */
'use strict';

function AbstractDomainConfig() {}

AbstractDomainConfig.prototype.getAgentMappingsList = function (url){
    throw new Error('getAgentMappingList() is not implemented in ' + this.constructor.name);
};

module.exports = AbstractDomainConfig;
