import {initApp} from './ui.js'

document.addEventListener('DOMContentLoaded', () => {
    initApp()
})

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register(new URL('../sw.js', import.meta.url))
            .catch((error) => {
                console.warn('Service worker registration failed', error)
            })
    })
}
