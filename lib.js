import {setGlobal} from './src/global.js';
import './src/postProcessingFunctions.js';

setGlobal(window);

export {element as e} from './src/element.js';
export * from './src/global.js';
export * from './src/symbols.js';
export * from './src/Destroyable.js';
export * from './src/postProcessingCatalog.js';
export * from './src/element.js';
export * from './src/eventHub.js';
export * from './src/watchUtils.js';
export * from './src/dom.js';
export * from './src/focusManager.js';
export * from './src/viewportWatcher.js';
export * from './src/Component.js';
export * from './src/Collection.js';

export const version = '3.1.1';
