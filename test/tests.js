import {default as test_render} from "./test_render.js"
import {default as test_Component} from "./test_Component.js"
import {default as test_postProcessing} from "./test_postProcessing.js"

let smoke = window.smoke;

smoke.defTest(test_render);
smoke.defTest(test_Component);
smoke.defTest(test_postProcessing);
