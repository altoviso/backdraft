import {create, insert} from  "./dom.js"
import Component from "./Component.js"
Component.createNode = create;
Component.insertNode = insert;

export * from "./dom.js"
export {default as e, Element} from "./element.js"
export {default as EventHub} from "./EventHub.js"
export {default as WatchHub} from "./WatchHub.js"
export {default as Component, render} from "./Component.js"

export function version(){
	return "2.0.0-beta1.0";
}

