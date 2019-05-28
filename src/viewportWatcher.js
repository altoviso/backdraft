import {adviseGlobal} from './global.js';
import {connect} from "./dom.js";
import {EventHub} from "./eventHub.js";
import {watchHub, withWatchables} from "./watchUtils.js";

let vh = 0;
let vw = 0;

class ViewportWatcher extends watchHub(EventHub) {
    constructor(throttle) {
        super({});
        this.throttle = throttle || 300;
    }

    get vh() {
        return vh;
    }

    get vw() {
        return vw;
    }
}

export const viewportWatcher = new ViewportWatcher();

adviseGlobal(window => {
    const document = window.document;

    vh = document.documentElement.clientHeight;
    vw = document.documentElement.clientWidth;

    let scrollTimeoutHandle = 0;

    connect(window, 'scroll', () => {
        if (scrollTimeoutHandle) {
            return;
        }
        scrollTimeoutHandle = setTimeout(() => {
            scrollTimeoutHandle = 0;
            viewportWatcher.bdNotify({type: 'scroll'});
        }, viewportWatcher.throttle);
    }, true);


    let resizeTimeoutHandle = 0;

    connect(window, 'resize', () => {
        if (resizeTimeoutHandle) {
            return;
        }
        resizeTimeoutHandle = setTimeout(() => {
            resizeTimeoutHandle = 0;
            const vhOld = vh;
            const vwOld = vw;
            vh = document.documentElement.clientHeight;
            vw = document.documentElement.clientWidth;
            viewportWatcher.bdMutateNotify([['vh', vh, vhOld], ['vw', vw, vwOld]]);
            viewportWatcher.bdNotify({type: 'resize', vh, vw});
        }, viewportWatcher.throttle);
    }, true);
});


