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
		["Element", "./test/Element.es6.js"],
		["watchHub", "./test/watchHub.es6.js"],
		["eventHub", "./test/eventHub.es6.js"],
		["Component", "./test/Component.es6.js"],
		["post-processing", "./test/post-processing.es6.js"],
		["render", "./test/render.es6.js"],
		["watchable", "./test/watchable.es6.js"],
		["log-assert-count", "./test/log-assert-count.js"]
	];

	if(isNode){
		tests.map(item => smoke.defBrowserTestRef(item[0]));
		config.capabilities = isNode ? require("./test/capabilities") : []
	}else if(isAmd){
		// TODO
	}else{
		// browser, not AMD
		config.load = config.load.concat(tests.map(item => item[1]));
	}

	smoke.configure(config).then(() => {
		// order the tests as given in tests above; mainly so we can have log-assert-count last without having to
		// put order attributes in the actual test definitions.
		let smokeTests = smoke.tests;
		let ordered = [];
		tests.forEach((item, order) => {
			let id = item[0];
			smokeTests.some(test => {
				if(test.id === id){
					test.order = order;
					ordered.push(test);
					return true;
				}
			});
		});
		ordered.forEach((test, i) => smokeTests[i] = test);
	});
}));



