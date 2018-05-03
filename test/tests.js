import {default as test_render} from "./test_render.js"
import {default as test_Component} from "./test_Component.js"

let smoke = window.smoke;

smoke.defTest(test_render);
smoke.defTest(test_Component);

smoke.configureBrowser().then(function(){
	smoke.runDefault().then(function(logger){
	});
});