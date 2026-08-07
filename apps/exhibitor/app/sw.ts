/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

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
    // The public visitor-lookup call has its own on-device cache
    // (visitorCache in IndexedDB, see lib/offline/idb.ts) which is what
    // actually powers instant/offline re-viewing -- this network-first
    // entry just keeps the app shell from erroring outright if the SW
    // intercepts the request while fully offline before that layer runs.
    {
      matcher: /\/api\/visitors\/lookup\//,
      handler: new NetworkFirst({
        cacheName: "visitor-lookup",
        networkTimeoutSeconds: 3,
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
