/*
 * MyHealthData offline shell.
 *
 * The vault is local-first, so the app must open and work without a network.
 * Same-origin GET responses for the application shell, its static assets and
 * the immutable anatomy model files (/models/) are cached: Hub API traffic
 * (which carries ciphertext and pairing codes) is never stored by the
 * service worker.
 */

const CACHE_NAME = 'myhealthdata-shell-v4'
const MODEL_CACHE = 'myhealthdata-models-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(['/', '/index.html', '/site.webmanifest']))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME && key !== MODEL_CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isModelRequest(url) {
  return url.pathname.startsWith('/models/')
}

function isCacheableRequest(request) {
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return false
  }
  if (request.method !== 'GET') {
    return false
  }
  // Never cache Hub API traffic: it carries ciphertext, pairing codes and device state.
  return !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/v1/') && url.pathname !== '/healthz'
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (!isCacheableRequest(request)) {
    return
  }
  const url = new URL(request.url)

  // Anatomy files are immutable and large: serve them cache-first so the model
  // downloads once and the app keeps working fully offline.
  if (isModelRequest(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok && response.type === 'basic') {
              const copy = response.clone()
              event.waitUntil(caches.open(MODEL_CACHE).then((cache) => cache.put(request, copy)))
            }
            return response
          }),
      ),
    )
    return
  }

  const isNavigation = request.mode === 'navigate'
  const cacheKey = isNavigation ? '/index.html' : request

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy))
        }
        return response
      })
      .catch(() => caches.match(cacheKey).then((cached) => cached ?? Response.error())),
  )
})
