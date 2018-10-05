import {create, insert} from  "./src/dom.js";
import Component from "./src/Component.js";
Component.createNode = create;
Component.insertNode = insert;

export * from "./src/dom.js";
export {default as e, svg, Element} from "./src/element.js";
export {default as EventHub} from "./src/EventHub.js";
export * from "./src/destroyable.js";
export * from "./src/watchUtils.js";
export {render} from "./src/Component.js";
export {Component};
export {default as Collection} from "./src/Collection.js";

export function version(){
	return "2.2.1";
}
