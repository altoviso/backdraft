import {setGlobal} from "./src/global.js";

setGlobal(window);

import {element} from "./src/element.js";

export {element as e};

export * from "./src/global.js";
export * from "./src/symbols.js";
export * from "./src/destroyable.js";
export * from "./src/postProcessingCatalog.js";
export * from "./src/element.js";
export * from "./src/eventHub.js";
export * from "./src/watchUtils.js";
export * from "./src/dom.js";
export * from "./src/focusManager.js";
export * from "./src/viewportWatcher.js";
export * from "./src/Component.js";
export * from "./src/Collection.js";
export * from "./src/postProcessingFunctions.js";

export const version = "3.0.0";
