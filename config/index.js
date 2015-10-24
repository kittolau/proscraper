var jsyaml = require('js-yaml');
var fs   = require('fs');
var path = require('path');

try {
	var NPS_ENV = typeof(process.env.NPS_ENV) == 'undefined' ? 'development' : process.env.NPS_ENV;
	var pathToConfig = path.join(__dirname,'config.yml');
	var config = jsyaml.safeLoad(fs.readFileSync(pathToConfig));

	if(!config.hasOwnProperty(NPS_ENV)){
		throw new Error('"'+ NPS_ENV + '" does not exist in config');
	}

	var scoped_config = config[NPS_ENV];
	if(!scoped_config.hasOwnProperty('root')){
		scoped_config['root'] = path.join(__dirname,'..');
	}

	module.exports = scoped_config;

} catch (e) {
	console.log(e);
}
