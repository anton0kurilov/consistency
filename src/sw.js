const CACHE_VERSION = 'v2'
const CACHE_NAME = `consistency-${CACHE_VERSION}`
const SHELL_URL = new URL('./', self.location).toString()

const hasContentType = (response, contentType) =>
    response.headers.get('content-type')?.includes(contentType)

const isCacheableResponse = (request, response) => {
    if (!response || response.status !== 200 || response.type === 'opaque') {
        return false
    }

    if (request.destination === 'style') {
        return hasContentType(response, 'text/css')
    }
    if (request.destination === 'script') {
        return (
            hasContentType(response, 'javascript') ||
            hasContentType(response, 'ecmascript')
        )
    }
    if (request.destination === 'manifest') {
        return (
            hasContentType(response, 'manifest+json') ||
            hasContentType(response, 'application/json')
        )
    }
    if (request.mode === 'navigate') {
        return hasContentType(response, 'text/html')
    }

    return true
}

const cacheResponse = async (request, response) => {
    if (!isCacheableResponse(request, response)) {
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
