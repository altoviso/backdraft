import { connect, createHtml } from './dom.js';
import { EventHub } from './eventHub.js';
import { adviseGlobal } from './global.js';
import { withWatchables, watchHub } from './watchUtils.js';

// design of resizing
//
// The key purpose of ViewportWatcher is to provide a single place for applications to get advice upon browser viewport
// size mutations. the viewportWatcher singleton offers this capability through a resize event and vh and vw (viewport
// height and width) watchables.
//
// Often an application would like to throttle resize and scroll events:
//   * since these events come in fast when the user is dragging a window's resize border
//   * the browser often sends multiple resize events consequent to the same impetus (e.g., phone flip, maximize, restore)
// By default, viewportWatcher throttles to a max of 1 every 300 ms. This can be set by clients via
// viewportWatcher.throttle, which dictates the max throttle frequency in ms. Setting the throttle to zero will cause
// events to be processed immediately.
//
// viewportWatcher always immediately signals a resize if none have occurred in the last throttle frequency time period.
// This feature allows an immediate first signal (with no throttle) of a single resize (e.g., phone rotations or window
// restore/tile/maximize), yet allows the throttle to engage when lots of events come in quickly (e.g., window sizing
// bar drag).
//
// On the other hand, when the browser insists on sending a multiple resize events when the viewport size has not changed,
// viewportWatcher does not pass the redundant events onto it's connected clients, but rather no-ops such events.
//
// vh and vw give the visible viewport of the browser. This is trivially window.innerHeight/Width on the desktop.

// Most phone browsers typically do not report window.innerHeight/Width accurately when the document
// overflows the physical viewport, particularly in the horizontal direction. This is an intended and
// currently-not-overridable behavior of most phone-hosted browsers. It is an attempt by the vendors to present documents
// intended for a desktop viewport class to be consumable in a small viewport. When and how these browsers size the
// "virtual" viewport seems to change over time. c09-2024,  the viewport is usually scaled to allow for the logical width
// of the dom when that logical width is wider than the physical viewport. That said, there seems to be other cases where
// scaling occurs, particularly when considering older browsers.
//
// So long as the dom is styled to allow a narrow presentation with scrollable overflow in the vertical direction, this
// problem does not occur on modern browsers (older browsers' behavior may behave otherwise). On the other hand, the
// problem is particularly befuddling when attempting a fixed layout that takes exactly the space of the physical viewport.
// In this case, the CSS vh and vw measurements don't work on some cases because the browser makes incorrect calcs as the
// browser chrome appears/is hidden (at least, historically). Further, once a particular layout is set, rotating the device
// from landscape to portrait guarantees an overflow, and, therefore, as subsequent "virtual" viewport resize. Lastly, all
// of these behaviors have slight variations across (platform browser-vendor) combinations.
//
// ViewportWatcher solves these problems by adding a mode of operation, namely "fixedMobileSizing". When fixedMobileSizing
// is enabled by setting viewportWatcher.fixedMobileSizing = true, an additional node is added to the dom...
//
// <div style="display:none; position:fixed; margin:0; border:0; padding:0; top:0; bottom:0; left:0; right:0;"></div>
//
// Then upon application of resize processing, viewportWatcher sets display=none to all body children except the
// above, which it sets to display=block. At this point, the browser should contain exactly one visible element which
// occupies exactly the visible viewport. Said viewport is measured via window.innerHeight/Width, and then the body
// children's display style restored to its original value. This seems to give an accurate measurement
// on all devices except for safari on iOS 15.0 - 15.3 and chrome on android.
//
// For some reason, safari on iOS 15.0 - 15.3 (at least) refuses to yield to our desires and returns incorrect window
// innerHeight/Width dimensions. To solve this problem the resize processing is scheduled to run again after some delay
// since the last time it was run owing to an actual resize event. This seems to allow the device to settle and report
// accurate measurements.
//
// Chrome and android has another problem: it seems that setting the body children to display=none and then back to their
// original display style causes overflowing nodes with scrolling to reset their scroll position to the top. To compensate for
// this behavior, the scroll position is also read, saved, and restored on all body children during the measurement process.
//
// Obviously, all of this is nontrivial. There are two concerns:
//
// 1. Will this cause any screen flash?
//    After testing on many browsers, we have seen no screen flash.
//
// 2. Is the time complexity too high for a resize event?
//    Algorithm timing was checked with a high-resolution timer on multiple devices. The typical times are
//    around .5ms, and rarely 1ms.
//
// Lastly, note carefully: this mode, fixedMobileSizing, is only required/desired under the particular circumstance where:
//   * the application wishes to fill the physical viewport, exactly, no matter the existence or not of browser chrome
//   * on phone-like devices that report window.innerHeight/Width different than the actual physical width of the viewport
//   * the CSS vh and vw don't work correctly for the design for all supported browsers
//
// If one of these conditions does not exist, then fixedMobileSizing should not be used and other CSS designs considered.


let measureNode = 0;

function getMeasureNode() {
    if (!measureNode) {
        measureNode = createHtml('<div style="display:none; position:fixed; margin:0; border:0; padding:0; top:0; bottom:0; left:0; right:0;"></div>');
        document.body.appendChild(measureNode);
    }
    return measureNode;
}

class ViewportWatcher extends withWatchables(watchHub(EventHub), 'vh', 'vw', 'resizeEvent', 'scrollEvent') {
    constructor(throttle) {
        super({});
        this.vh = this.vw = 0;
        this.throttle = throttle || 300;
        this._pause = true;
        this._scrollTimeoutHandle = 0;
        this._lastScrollEvent = {};
        this._resizeTimeoutHandle = 0;
        this._lastResizeEvent = {};
        this._recheckSizeTimeoutHandle = 0;
        this._lastResizeTs = 0;
        this._fixedMobileSizing = false;
    }

    get pause() {
        return this._pause;
    }

    set pause(value) {
        if (value && !this._pause) {
            this._pause = true;
        } else if (!value && this._pause) {
            this._pause = false;
            this.onResize(this._lastResizeEvent);
        }
    }

    get fixedMobileSizing() {
        return this._fixedMobileSizing;
    }

    set fixedMobileSizing(value) {
        this._fixedMobileSizing = !!value;
        // must recompute if a change; if no actual change, recompute will result in a no-op
        this.onResize(this._lastResizeEvent);
    }

    onScroll(e) {
        if (this._pause) {
            return;
        }

        // this should result in a no-op; but, at least in the distant past, we've seen a scroll event precede a resize event
        this._notifyResize(window.innerHeight, window.innerWidth, 'scroll');

        this.bdMutate('scrollEvent', '_scrollEvent', e);
        this.bdNotify({ type: 'scroll', domEvent: e });
    }

    onResize(e) {
        if (this._pause) {
            return;
        }

        if (!this._fixedMobileSizing) {
            this._lastResizeTs = Date.now();
            this._notifyResize(window.innerHeight, window.innerWidth);
            return;
        }

        // executing fixedMobileSizing mode...

        // When the extra onResize application is schedule at the end of this routine, we schedule it to be applied to
        // "recheck" rather than the dom resize event object so we can know when this routine is being applied because
        // of a recheck
        const rechecking = e === 'recheck';
        if (rechecking) {
            if (this._resizeTimeoutHandle) {
                // recheck timeout beat the throttled timeout on an actual resize event
                // just let that event handle it
                this._recheckSizeTimeoutHandle = 0;
                return;
            }
        } else if (this._recheckSizeTimeoutHandle) {
            // an actual resize event beat a scheduled recheck; cancel the scheduled recheck
            clearTimeout(this._recheckSizeTimeoutHandle);
        }
        this._recheckSizeTimeoutHandle = 0;

        this.bdNotify({ type: 'fix-mobile-resizing-start', domEvent: e });

        // remember the current state of the document element scroll posit and the body's children, then display=none them all
        // document.body.scrollX is for old safari
        const docElement = document.documentElement;
        const scrollTop = docElement.scrollHeight > docElement.clientHeight ? (docElement.scrollTop || document.body.scrollTop) : 0;
        const scrollLeft = docElement.scrollWidth > docElement.clientWidth ? (docElement.scrollLeft || document.body.scrollLeft) : 0;
        const currentState = [];
        const bodyChildren = document.body.children;
        const bodyChildrenCount = bodyChildren.length;
        for (let i = 0; i < bodyChildrenCount; i++) {
            const child = bodyChildren.item(i);
            // a bit pedantic here, but this simply Can. Not. Fail.
            if (child.tagName !== 'SCRIPT' && child.style) {
                try {
                    currentState[i] = {
                        display: child.style.display,
                        scrollTop: child.scrollTop,
                        scrollLeft: child.scrollLeft
                    };
                    child.style.display = 'none';
                } catch (e) {
                    cl && cl.unexpected && cl.unexpected(e);
                }
            }
        }

        // measure...
        const measureNode = getMeasureNode();
        measureNode.style.display = 'block';
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        measureNode.style.display = 'none';

        // restore...
        for (let i = 0; i < bodyChildrenCount; i++) {
            try {
                const state = currentState[i];
                if (state !== undefined) {
                    const node = bodyChildren.item(i);
                    node.style.display = state.display;
                    node.scrollTop = state.scrollTop;
                    node.scrollLeft = state.scrollLeft;
                }
            } catch (e) {
                cl && cl.unexpected && cl.unexpected(e);
            }
        }
        window.scrollTo(scrollLeft, scrollTop);

        this.bdNotify({ type: 'fix-mobile-resizing-end', domEvent: e });
        this._notifyResize(vh, vw, rechecking ? 'rechecking' : 'event');
        this._lastResizeTs = Date.now();
        if (!rechecking) {
            this._recheckSizeTimeoutHandle = setTimeout(this.onResize.bind(this, 'recheck'), Math.max(this.throttle, 200));
        }
    }

    _notifyResize(vh, vw, impetus) {
        if (vh !== this.vh || vw !== this.vw) {
            this.bdMutate('vh', '_vh', vh, 'vw', '_vw', vw, 'resizeEvent', '_resizeEvent', this._lastResizeEvent);
            this.bdNotify({ type: 'resize', vh, vw, domEvent: this._lastResizeEvent, impetus });
        }
    }

    scheduleScroll(e) {
        this._lastScrollEvent = e || this._lastScrollEvent;
        if (this.throttle === 0) {
            this.onScroll(this._lastScrollEvent);
            return;
        }
        if (this._scrollTimeoutHandle) {
            return;
        }
        this._scrollTimeoutHandle = setTimeout(() => {
            this._scrollTimeoutHandle = 0;
            this.onScroll(this._lastScrollEvent);
        }, this.throttle);
    }

    scheduleResize(e) {
        this._lastResizeEvent = e || this._lastResizeEvent;
        if (this.throttle === 0) {
            this.onResize(this._lastResizeEvent);
            return;
        }
        if (this._resizeTimeoutHandle) {
            return;
        }
        if (Date.now() - this._lastResizeTs > this.throttle) {
            // don't throttle the first one since it could be a phone rotation/maximize/restore etc.,
            // in these cases, the rotation (or whatever) will cause several events that all have the same
            // viewport size. In these cases, we'd like to consume the event immediately so there is no
            // delay and the ux "snaps" into the new viewport
            this.onResize(this._lastResizeEvent);
        } else {
            // getting a bunch of events...one of two things
            // either multiple events with no substantive change (e.g., the phone sends a bunch of resizes upon rotation)
            // or the user is dynamically resizing by dragging a sizing handle
            this._resizeTimeoutHandle = setTimeout(() => {
                this._resizeTimeoutHandle = 0;
                this.onResize(this._lastResizeEvent);
            }, this.throttle);
        }
    }
}

export const viewportWatcher = new ViewportWatcher();

adviseGlobal(window => {
    // get initial values
    viewportWatcher.onResize();

    connect(window, 'scroll', viewportWatcher.scheduleScroll.bind(viewportWatcher));
    connect(window, 'resize', viewportWatcher.scheduleResize.bind(viewportWatcher));

    // we've seen some browsers in browserstack fail to send a resize event upon rotation
    // though the orientationchange event on window is deprecated, window.screen.orientation is not available on
    // all supported browsers; therefore, connect them both
    connect(window, 'orientationchange', viewportWatcher.scheduleResize.bind(viewportWatcher));
    if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) {
        connect(window.screen.orientation, 'change', viewportWatcher.scheduleResize.bind(viewportWatcher));
    }
});
