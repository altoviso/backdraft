import EventHub from './EventHub.js'
import WatchHub from './WatchHub.js'
import Component from './Component.js'
import element from './element.js'

function getAttributeValueFromEvent(e, attributeName, stopNode){
	let node = e.target;
	while(node && node !== stopNode){
		if(node.getAttributeNode(attributeName)){
			return node.getAttribute(attributeName);
		}
		node = node.parentNode;
	}
	return undefined;
}

function setAttr(node, name, value){
	if(arguments.length === 2){
		let hash = name;
		Object.keys(hash).forEach(name =>{
			setAttr(node, name, hash[name]);
		});
	}else{
		if(name === "className"){
			if(Array.isArray(value)){
				node.className = value.reduce((item) => item ? result + " " + item : result, "").replace(/\s{2,}/g, " ").trim();
			}else{
				node.className = value.replace(/\s{2,}/g, " ").trim();
			}
		}else if(name === "style"){
			setStyle(node, value);
		}else if(name in node){
			node[name] = value;
		}else{
			node.setAttribute(name, value);
		}
	}
}

let lastComputedStyleNode = 0;
let lastComputedStyle = 0;

function getStyle(node, property){
	if(lastComputedStyleNode !== node){
		lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
	}
	let result = lastComputedStyle[property];
	return (typeof result === "string" && /px$/.test(result)) ? parseFloat(result) : result;
}

function getStyles(node, properties){
	if(lastComputedStyleNode !== node){
		lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
	}

	let result = {};
	Object.keys(properties).forEach((property) =>{
		let result = lastComputedStyle[property];
		result[property] = (typeof result === "string" && /px$/.test(result)) ? parseFloat(result) : result;
	});
	return result;
}

function setStyle(node, property, value){
	if(arguments.length === 2){
		if(typeof property === "string"){
			node.style = property;
		}else{
			let hash = property;
			Object.keys(hash).forEach(property =>{
				node.style[property] = hash[property];
				setStyle(node, property, hash[property]);
			});
		}
	}else{
		node.style[property] = value;
	}
}

function setPosit(node, posit){
	for(let p in posit){
		switch(p){
			case "t":
				node.style.top = posit.t + "px";
				break;
			case "b":
				node.style.bottom = posit.b + "px";
				break;
			case "l":
				node.style.left = posit.l + "px";
				break;
			case "r":
				node.style.right = posit.r + "px";
				break;
			case "h":
				node.style.height = posit.h + "px";
				break;
			case "w":
				node.style.width = posit.w + "px";
				break;
			default:
		}
	}
}

function create(tag, props, refNode){
	let result = document.createElement(tag);
	if(props){
		setAttr(result, props);
	}
	if(refNode){
		refNode.appendChild(result);
	}
	return result;
}

function normalizeNodeArg(arg){
	return (arg._dom && arg._dom.root) || (typeof arg === "string" && document.getElementById(arg)) || arg;
}

const DATA_BD_HIDE_SAVED_VALUE = "data-bd-hide-saved-value";

function hide(...nodes){
	nodes.forEach((node) =>{
		node = normalizeNodeArg(node);
		if(node){
			if(!node.hasAttribute(DATA_BD_HIDE_SAVED_VALUE)){
				node.setAttribute(DATA_BD_HIDE_SAVED_VALUE, node.style.display);
				node.style.display = "none"
			}//else, ignore, multiple calls to hide
		}
	});
}

function show(...nodes){
	nodes.forEach((node) =>{
		node = normalizeNodeArg(node);
		if(node){
			let displayValue = "";
			if(node.hasAttribute(DATA_BD_HIDE_SAVED_VALUE)){
				displayValue = node.getAttribute(DATA_BD_HIDE_SAVED_VALUE);
				node.removeAttribute(DATA_BD_HIDE_SAVED_VALUE);
			}
			node.style.display = displayValue;
		}
	});
}

function getClientRect(target){
	let result = normalizeNodeArg(target).getBoundingClientRect();
	result.t = result.top;
	result.b = result.bottom;
	result.l = result.left;
	result.r = result.right;
	result.h = result.height;
	result.w = result.width;
	return result;
}

function getMaxZIndex(parent){
	let node, cs, max = 0, children = parent.childNodes, i = 0, end = children.length;
	while(i < end){
		node = children[i++];
		cs = node && node.nodeType === 1 && getComputedStyle_(node);
		max = Math.max(max, (cs && cs.zIndex && Number(cs.zIndex)) || 0);
	}
	return max;
}

function destroyDomChildren(node){
	let childNode;
	while((childNode = node.lastChild)){
		node.removeChild(childNode);
	}
}

function destroyDomNode(node){
	node && node.parentNode && node.parentNode.removeChild(node);
}

let hasTouchEvents = "ontouchstart" in document,
	touchMap = {
		mousedown: "touchstart",
		mousemove: "touchmove",
		mouseup: "touchend"
	};

function connect(target, type, listener, useCapture){
	// if you don't want to register touch events, set useCapture to either true or false
	let touchEvent = touchMap[type],
		destroyed = false;
	if(touchEvent && hasTouchEvents && useCapture === undefined){
		target.addEventListener(type, listener);
		target.addEventListener(touchEvent, listener);
		return {
			destroy: function(){
				if(!destroyed){
					destroyed = true;
					target.removeEventListener(type, listener);
					target.removeEventListener(touchEvent, listener);
				}
			}
		};
	}else{
		useCapture = !!useCapture;
		target.addEventListener(type, listener, useCapture);
		return {
			destroy: function(){
				if(!destroyed){
					destroyed = true;
					target.removeEventListener(type, listener, useCapture);
				}
			}
		};
	}
}

function stopEvent(event){
	if(event && event.preventDefault){
		event.preventDefault();
		event.stopPropagation();
	}
}

element.insPostProcessingFunction(element, "advise", Symbol("post-process-function-advise"),
	function(target, source, resultIsDomNode, listeners){
		Reflect.ownKeys(listeners).forEach((name) =>{
			let listener = listeners[name];
			target.ownWhileRendered(resultIsDomNode ? connect(source, name, listener) : source.advise(name, listener));
		});
	}
);

let focusedComponent = null,
	focusedNode = null,
	focusedStack = [],
	previousFocusedComponent = null,
	previousFocusedNode = null;

class FocusManager extends EventHub{
	get focusedComponent(){
		return focusedComponent;
	}

	get focusedNode(){
		return focusedNode;
	}

	get focusedStack(){
		return focusedStack;
	}

	get previousFocusedComponent(){
		return previousFocusedComponent;
	}

	get previousFocusedNode(){
		return previousFocusedNode;
	}
}

let focusManager = new FocusManager();
let focusWatcher = 0;
const ppOnFocus = Component.ppOnFocus;
const ppOnBlur = Component.ppOnBlur;

function processNode(node){
	if(focusWatcher){
		clearTimeout(focusWatcher);
		focusWatcher = 0;
	}

	previousFocusedNode = focusedNode;
	focusedNode = node;
	if(previousFocusedNode === focusedNode){
		return;
	}

	// find the focused component, if any
	let catalog = Component.catalog;
	while(node && (!catalog.has(node))){
		node = node.parentNode;
	}
	let focusedComponent_ = node && catalog.get(node),
		stack = [];
	if(focusedComponent_){
		let p = focusedComponent_;
		while(p){
			stack.unshift(p);
			p = p.parent;
		}
	}

	let focusStack = focusedStack,
		newStackLength = stack.length,
		oldStackLength = focusStack.length,
		i = 0,
		j, component;
	while(i < newStackLength && i < oldStackLength && stack[i] === focusStack[i]){
		i++;
	}
	// [0..i-1] are identical in each stack


	// signal blur from the path end to the first identical component (not including the first identical component)
	for(j = i; j < oldStackLength; j++){
		component = focusStack.pop();
		component[ppOnBlur];
		focusManager._applyHandlers({name: "blurComponent", component: component});
	}

	// signal focus for all new components that just gained the focus
	for(j = i; j < newStackLength; j++){
		focusStack.push(component = stack[j]);
		component[ppOnFocus];
		focusManager._applyHandlers({name: "focusComponent", component: component});
	}

	previousFocusedComponent = focusedComponent;
	focusedComponent = focusedComponent_;
	focusManager._applyHandlers({name: "focusedComponent", component: focusedComponent_});
}

connect(document.body, "focusin", function(e){
	let node = e.target;
	if(!node || node.parentNode == null || node === self[focusedNode]){
		return;
	}
	processNode(node);
});

connect(document.body, "focusout", function(e){
	// If the blur event isn't followed by a focus event, it means the user clicked on something unfocusable,
	// so clear focus.
	if(focusWatcher){
		clearTimeout(focusWatcher);
	}

	focusWatcher = setTimeout(function(){
		processNode(null);
	}, 5);
});

let viewportWatcher = new EventHub();

let scrollTimeoutHandle = 0;
connect(document.body, "scroll", function(e){
	if(scrollTimeoutHandle){
		clearTimeout(scrollTimeoutHandle)
	}
	scrollTimeoutHandle = setTimeout(function(){
		scrollTimeoutHandle = 0;
		viewportWatcher._applyHandlers({name: "scroll"});
	}, 10);
}, true);


let resizeTimeoutHandle = 0;
connect(document.body, "resize", function(e){
	if(resizeTimeoutHandle){
		clearTimeout(resizeTimeoutHandle)
	}
	resizeTimeoutHandle = setTimeout(function(){
		resizeTimeoutHandle = 0;
		viewportWatcher._applyHandlers({name: "resize"});
	}, 10);
}, true);


export {
	getAttributeValueFromEvent,
	setAttr,
	getStyle,
	getStyles,
	setStyle,
	setPosit,
	create,
	hide,
	show,
	getClientRect,
	getMaxZIndex,
	destroyDomChildren,
	destroyDomNode,
	connect,
	stopEvent,
	focusManager,
	viewportWatcher
};

