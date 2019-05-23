import {destroyable} from "./destroyable.js";
import {STAR} from "./symbols.js";

const listenerCatalog = new WeakMap();

function eventHub(superClass){
	return class extends (superClass || class{
	}){
		// protected interface...
		bdNotify(e){
			let events = listenerCatalog.get(this);
			if(!events){
				return;
			}

			let handlers;
			if(e instanceof Event){
				handlers = events[e.type];
			}else{
				if(e.type){
					handlers = events[e.type];
					e.target = this;
				}else if(!e.name){
					handlers = events[e];
					e = {type: e, name: e, target: this};
				}else{
					// eslint-disable-next-line no-console
					console.warn("event.name is deprecated; use event.type");
					handlers = events[e.name];
					e.type = e.name;
					e.target = this;
				}
			}

			if(handlers){
				handlers.slice().forEach(destroyable => destroyable.proc(e));
			}
			if((handlers = events[STAR])){
				handlers.slice().forEach(destroyable => destroyable.proc(e));
			}
		}

		// public interface...
		get isBdEventHub(){
			return true;
		}

		advise(eventName, handler){
			if(!handler){
				let hash = eventName;
				return Reflect.ownKeys(hash).map(key => this.advise(key, hash[key]));
			}else if(Array.isArray(eventName)){
				return eventName.map(name => this.advise(name, handler));
			}else{
				let events = listenerCatalog.get(this);
				if(!events){
					listenerCatalog.set(this, (events = {}));
				}
				let result = destroyable(handler, events[eventName] || (events[eventName] = []));
				this.own && this.own(result);
				return result;
			}
		}

		destroyAdvise(eventName){
			let events = listenerCatalog.get(this);
			if(!events){
				return;
			}
			if(eventName){
				let handlers = events[eventName];
				if(handlers){
					handlers.forEach(h => h.destroy());
					delete events[eventName];
				}
			}else{
				Reflect.ownKeys(events).forEach(eventName => {
					events[eventName].forEach(h => h.destroy());
				});
				listenerCatalog.delete(this);
			}
		}
	};
}

const EventHub = eventHub();

export {
	eventHub,
	EventHub
}
