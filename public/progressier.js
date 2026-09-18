// KILL SWITCH for the old Progressier service worker.
//
// The site once registered a PWA service worker at this URL. The registration
// was later removed from index.html, but browsers that visited back then still
// hold it, and it keeps answering requests from its cache — so those visitors
// were served old builds of the site long after they were replaced: old
// headline copy, and a sponsor page stuck on "Loading teams…".
//
// A registered worker re-fetches its own script to check for updates. This is
// that script now. It takes over immediately, empties every cache it can see,
// unregisters itself, and reloads any open page so it fetches fresh from the
// network. After that there is no worker at all.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const pages = await self.clients.matchAll({ type: "window" });
      for (const page of pages) page.navigate(page.url);
    })(),
  );
});
