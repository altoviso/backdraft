(function(factory){
	const isAmd = typeof define === 'function' && define.amd;
	const isNode = typeof window === "undefined";
	if(isAmd){
		define(["smoke"], smoke => factory(smoke, false, true, true))
	}else if(isNode){
		factory(require("bd-smoke"), true, false, false)
	}else{
		factory(window.smoke, false, true, false)
	}
}((smoke, isNode, isBrowser, isAmd) => {
	'use strict';

	// recall: all file names are relative to the root directory of the project by default

	// config that's applicable to all environments
	let config = {
		load: [
			"./test/test.css" // will be ignored by smoke on node
		],
		remoteUrl: 'http://localhost:8080/altoviso/backdraft/node_modules/bd-smoke/browser-runner.html',
	};

	// each of the tests below is written using es6 imports, and, c2018, will not load on node without transforming
	// we don't want to make that a requirement to test remotely, therefore we note the root of each test that is interesting
	// to run remotely (and therefore, be loaded by smoke on node) and use smoke.defBrowserTestRef to inform smoke about
	// such tests
	let tests = [
		[["element"], "./test/element.es6.js"]
	];

	if(isNode){
		tests.map(item => item[0].forEach(testId => smoke.defBrowserTestRef(testId)));
		config.capabilities = isNode ? require("./test/capabilities") : []
	}else if(isAmd){
		// TODO
	}else{
		// browser, not AMD
		config.load = config.load.concat(tests.map(item => item[1]));
	}

	smoke.configure(config);
}));



