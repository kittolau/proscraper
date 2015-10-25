# node-promise-scraper
A versatile, hackable nodejs PROmise web SCRAPER framework
- support parallel and multi-process on same machine using cluster
- support running on multiple machine using beanstalkd
- check visited url using BloomFilter
- check crawling depth for each seed url request
- built-in support loading in Cheerio or Jquery via jsdom
- built-in support scraping via agent, http proxy, sock5 or tor
- cron scraping job
- scrap with unique settings for each domain, scrap each at your prefered pace
