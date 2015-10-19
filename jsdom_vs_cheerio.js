var Promise     = require('bluebird');
var path        = require("path");
var fs          = Promise.promisifyAll(require("fs"));
var co          = require('co');
var request     = Promise.promisify(require('request'));
var url         = require('url');
var cheerio     = require('cheerio');
var jquery      = fs.readFileSync(require.resolve('jquery'), "utf-8");
var jsdom       = Promise.promisifyAll(require("jsdom"));
var BloomFilter = require('bloomfilter').BloomFilter;

console.time("jsdom+jquery")
jsdom.envAsync('<p><a class="the-link" href="https://github.com/tmpvar/jsdom">jsdom!</a></p>',null,{src:[jquery]})
.then(function(window){
  //console.log("contents of a.the-link:", window.$("a.the-link").prop('href'));
  console.timeEnd("jsdom+jquery")
})
.catch(console.log)

console.time("cheerio")
var $ = cheerio.load('<p><a class="the-link" href="https://github.com/tmpvar/jsdom">jsdom!</a></p>')
console.timeEnd("cheerio")