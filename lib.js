import {create, insert} from  "./src/dom.js"
import Component from "./src/Component.js"
Component.createNode = create;
Component.insertNode = insert;

export * from "./src/dom.js"
export {default as e, Element} from "./src/element.js"
export {default as EventHub} from "./src/EventHub.js"
export {default as WatchHub} from "./src/WatchHub.js"
export {render} from "./src/Component.js"
export {Component}

export function version(){
	return "2.2.1";
}
