import {initApp} from './ui.js'

document.addEventListener('DOMContentLoaded', () => {
    initApp()
})

if ('serviceWorker' in navigator) {
    if (process.env.NODE_ENV === 'production') {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register(new URL('../sw.js', import.meta.url))
                .catch((error) => {
                    console.warn('Service worker registration failed', error)
                })
        })
    } else {
        window.addEventListener('load', async () => {
            try {
                const registrations =
                    await navigator.serviceWorker.getRegistrations()
                await Promise.all(
                    registrations.map((registration) =>
                        registration.unregister(),
                    ),
                )
                if ('caches' in window) {
                    const keys = await caches.keys()
                    await Promise.all(
                        keys
                            .filter((key) => key.startsWith('consistency-'))
                            .map((key) => caches.delete(key)),
                    )
                }
            } catch (error) {
                console.warn('Service worker cleanup failed', error)
            }
        })
    }
}
