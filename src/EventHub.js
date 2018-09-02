const ppEvents = Symbol("EventHub-ppEvents");

export default function EventHub(superClass){
	if(!superClass){
		superClass = class {
		};
	}
	return class extends superClass {
		constructor(){
			super();
			Object.defineProperty(this, ppEvents, {value: {}});
		}

		// protected interface...
		_applyHandlers(e){
			let handlers;
			if(e instanceof Event){
				handlers = this[ppEvents][e.type];
			}else{
				if(!e.name){
					e = {name: e, target: this};
				}else{
					e.target = this;
				}
				handlers = this[ppEvents][e.name];
			}
			if(handlers){
				handlers.slice().forEach(handler => handler.handler(e));
			}
		}

		// public interface...
		advise(eventName, handler){
			if(!handler){
				let hash = eventName;
				Reflect.ownKeys(hash).map(key => this.advise(key, hash[key]));
			}else if(Array.isArray(eventName)){
				return eventName.map(name => this.advise(name, handler));
			}else{
				let handlers = this[ppEvents][eventName] || (this[ppEvents][eventName] = []),
					wrappedHandler = {handler: handler};
				handlers.push(wrappedHandler);
				return {
					destroy: () =>{
						let handlers = this[ppEvents][eventName];
						let index = handlers ? handlers.indexOf(wrappedHandler) : -1;
						if(index !== -1){
							handlers.splice(index, 1);
						}
					}
				};
			}
		}

		destroyAdvise(eventName){
			if(eventName){
				delete this[ppEvents][eventName];
			}else{
				let events = this[ppEvents];
				Reflect.ownKeys(events).forEach((key) =>{
					delete events[key];
				});
			}
		}
	};
}
EventHub.ppEvents = ppEvents;