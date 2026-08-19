import { destroyable } from './destroyable.js';
import { STAR } from './symbols.js';

const listenerCatalog = new WeakMap();

function eventHub(superClass) {
    return class extends (superClass || class {
    }) {
        // protected interface...
        bdNotify(e) {
            const events = listenerCatalog.get(this);
            if (!events) {
                return;
            }

            let handlers;
            if (e instanceof Event) {
                handlers = events[e.type];
            } else {
                // eslint-disable-next-line no-lonely-if
                if (e.type) {
                    handlers = events[e.type];
                    e.target = this;
                } else if (!e.name) {
                    handlers = events[e];
                    e = { type: e, name: e, target: this };
                } else {
                    // eslint-disable-next-line no-console
                    console.warn('event.name is deprecated; use event.type');
                    handlers = events[e.name];
                    e.type = e.name;
                    e.target = this;
                }
            }

            if (handlers) {
                handlers.slice().forEach(destroyable => destroyable.proc(e));
            }
            if ((handlers = events[STAR])) {
                handlers.slice().forEach(destroyable => destroyable.proc(e));
            }
        }

        // public interface...
        get isBdEventHub() {
            return true;
        }

        advise(eventName, handler) {
            if (!handler) {
                const hash = eventName;
                return Reflect.ownKeys(hash).map(key => this.advise(key, hash[key]));
            } else if (Array.isArray(eventName)) {
                return eventName.map(name => this.advise(name, handler));
            }
            if (eventName === '_eventHubAdviseNoEvents') {
                throw new Error('cannot advise on reserved event name');
            }
            if (this._notifyingNoEvents) {
                throw new Error('cannot create advise in all listeners destroyed handler');
            }
            let events = listenerCatalog.get(this);
            if (!events) {
                listenerCatalog.set(this, (events = {}));
            }
            let eventHandlerList = events[eventName];
            if (!eventHandlerList) {
                eventHandlerList = events[eventName] = [];
                eventHandlerList.onEmpty = () => {
                    delete events[eventName];
                    if (Object.keys(events).length === 1 && events._eventHubAdviseNoEvents) {
                        // the only listeners left are the "special" listeners waiting to be advised when all other
                        // listeners have been destroyed
                        try {
                            this._notifyingNoEvents = true;
                            const e = { type: 'all-listeners-destroyed', target: this };
                            events._eventHubAdviseNoEvents.slice().forEach(destroyable => destroyable.proc(e));
                        } catch (e) {
                            // squelch
                            // eslint-disable-next-line no-console
                            console.error(e);
                        }
                        this._notifyingNoEvents = false;
                    }
                };
            }
            const result = destroyable(handler, eventHandlerList);
            this.own && this.own(result);
            return result;
        }

        adviseAllListenersDestroyed(handler) {
            if (this._notifyingNoEvents) {
                throw new Error('cannot create all listeners destroyed advice in all listeners destroyed handler');
            }
            let events = listenerCatalog.get(this);
            if (!events) {
                listenerCatalog.set(this, (events = {}));
            }
            const result = destroyable(handler, events._eventHubAdviseNoEvents || (events._eventHubAdviseNoEvents = []));
            this.own && this.own(result);
            return result;
        }

        adviseOnce(eventName, handler) {
            const h = this.advise(eventName, () => {
                h.destroy();
                handler();
            });
            return h;
        }

        destroyAdvise(eventName) {
            const events = listenerCatalog.get(this);
            if (!events) {
                return;
            }
            if (eventName) {
                const handlers = events[eventName];
                if (handlers) {
                    handlers.forEach(h => h.destroy());
                    delete events[eventName];
                }
            } else {
                Reflect.ownKeys(events).forEach(eventName => {
                    if (eventName !== '_eventHubAdviseNoEvents') {
                        events[eventName].forEach(h => h.destroy());
                    }
                });
                listenerCatalog.delete(this);
            }
        }

        get hasListeners() {
            const events = listenerCatalog.get(this);
            return Boolean(events && Object.keys(events).find(key => key !== '_eventHubAdviseNoEvents' && events[key].length));
        }
    };
}

const EventHub = eventHub();

export {
    eventHub,
    EventHub
};
