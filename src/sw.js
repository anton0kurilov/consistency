const CACHE_VERSION = 'v1'
const CACHE_NAME = `consistency-${CACHE_VERSION}`
const SHELL_URL = new URL('./', self.location).toString()

const cacheResponse = async (request, response) => {
    if (!response || response.status !== 200 || response.type === 'opaque') {
        return response
    }

    const cache = await caches.open(CACHE_NAME)
    cache.put(request, response.clone())
    return response
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll([SHELL_URL]))
            .then(() => self.skipWaiting()),
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    )
})

self.addEventListener('fetch', (event) => {
    const {request} = event

    if (request.method !== 'GET') {
        return
    }

    const url = new URL(request.url)

    if (url.origin !== self.location.origin) {
        return
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => cacheResponse(request, response))
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME)
                    return cache.match(request) || cache.match(SHELL_URL)
                }),
        )
        return
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                event.waitUntil(
                    fetch(request).then((response) =>
                        cacheResponse(request, response),
                    ),
                )
                return cached
            }

            return fetch(request).then((response) =>
                cacheResponse(request, response),
            )
        }),
    )
})
