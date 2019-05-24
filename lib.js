import {create, insert} from  "./src/dom.js";
import {initialize} from "./src/Component.js";
initialize(document, create, insert);

import {element} from "./src/element.js";
export {element as e};

export * from "./src/symbols.js";
export * from "./src/postProcessingCatalog.js";
export * from "./src/element.js";
export * from "./src/destroyable.js";
export * from "./src/eventHub.js";
export * from "./src/watchUtils.js";
export * from "./src/Component.js";
export * from "./src/Collection.js";
export * from "./src/dom.js";

export const version = "2.3.1";
