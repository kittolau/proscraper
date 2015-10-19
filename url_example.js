var url = require('url')
var urlParse = url.parse('http://user:pass@www.host.com:8080/p/a/t/h?query=string#hash')
console.log(urlParse.host)
console.log(urlParse.auth)
console.log(urlParse.hostname)
console.log(urlParse.port)
console.log(urlParse.pathname)
console.log(urlParse.search)
console.log(urlParse.query)
console.log(urlParse.hash)

console.log(url.resolve('http://user:pass@www.host.com:8080/p/a/t/h?query=string#hash', '/path/to/go'))

