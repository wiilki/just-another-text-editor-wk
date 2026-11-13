/* JATE Studio's app shell is precached by Workbox at build time.
 * Document contents are stored locally using IndexedDB, not in Cache Storage.
 */
const { precacheAndRoute, createHandlerBoundToURL } = require('workbox-precaching');
const { registerRoute, NavigationRoute } = require('workbox-routing');

precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
