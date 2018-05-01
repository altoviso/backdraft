const ppEvents = Symbol("EventHub-ppEvents");

export default function EventHub(){
	// a class that registers listeners and fires events at those listeners
	Object.defineProperty(this, ppEvents, {value: {}});
};
EventHub.ppEvents = ppEvents;

Object.assign(EventHub.prototype, {
	// protected interface...
	_applyHandlers(e){
		if(!e.name){
			e = {name: e, target: this};
		}
		let handlers = this[ppEvents][e.name];
		if(handlers){
			handlers.slice().forEach(handler => handler.handler(e));
		}
	},

	// public interface...
	advise(eventName, handler){
		if(!handler){
			let hash = eventName;
			Reflect.ownKeys(hash).map(key => this.advise(key, hash[key]));
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
			}
		}
	},

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
});
