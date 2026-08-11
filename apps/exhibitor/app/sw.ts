/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Never cache API responses. Authenticated exports and visitor PII must
    // not remain readable from Cache Storage after logout. Offline visitor
    // re-viewing is provided by the explicitly managed IndexedDB cache.
    {
      matcher: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // Everything else is served from the build-time precache or the network.
    // Avoid broad runtime strategies that can turn visitor identifiers,
    // authenticated RSC payloads, redirects, or profile pages into cache keys.
  ],
});

serwist.addEventListeners();
