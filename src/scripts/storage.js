import {STORAGE_KEY} from './constants.js'
import {uid} from './utils.js'

export function loadHabits() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
            .map((h, i) => ({
                id: h.id || uid(),
                name: String(h.name || 'Без названия'),
                createdAt: h.createdAt || new Date().toISOString(),
                completions: Array.isArray(h.completions) ? h.completions : [],
                order: typeof h.order === 'number' ? h.order : i,
            }))
            .sort((a, b) => a.order - b.order)
    } catch {
        return []
    }
}

export function saveHabits(habits) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
}
