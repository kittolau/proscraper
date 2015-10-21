/* jshint node: true, esnext:true */
'use strict';
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
};
var URLRequest = rootRequire('web_scraper/url_request');
var url = require('url')

console.time("urlParse")
var urlParse = url.parse('http://user:pass@www.host.com:8080/p/a/t/h?query=string#hash')
console.timeEnd("urlParse")

console.time("others")
console.log(urlParse.protocol)
console.timeEnd("others")

console.log(urlParse.host)
console.log(urlParse.auth)
console.log(urlParse.hostname)
console.log(urlParse.port)
console.log(urlParse.pathname)
console.log(urlParse.search)
console.log(urlParse.query)
console.log(urlParse.hash)

console.time("resolveURL")
var resolvedUrl = url.resolve('http://www.host.com:8080/p/a/t/h?query=string#hash', 'https://www.google.com/path/to/go')
console.timeEnd("resolveURL")
console.log(resolvedUrl)
console.log(url.resolve('http://www.host.com:8080/p/a/t/h?query=string#hash', '#'))
console.log(url.resolve('http://www.host.com:8080/p/a/t/h?query=string#hash', ''))

console.time("protocol")
var res = /^http[s]?\:\/\//g.test(resolvedUrl);
console.timeEnd("protocol")
if (res) {
  console.log("validURL")
}else{
  console.log("not validURL")
}

