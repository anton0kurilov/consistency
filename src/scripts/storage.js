import {STORAGE_KEY, SYNC_EVENT, SYNC_UPDATED_AT_KEY} from './constants.js'
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
    saveHabitsWithMeta(habits)
}

export function getLocalUpdatedAt() {
    const raw = localStorage.getItem(SYNC_UPDATED_AT_KEY)
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : 0
}

export function setLocalUpdatedAt(timestamp) {
    if (!Number.isFinite(timestamp)) return
    localStorage.setItem(SYNC_UPDATED_AT_KEY, String(timestamp))
}

export function ensureLocalUpdatedAt(habits) {
    const current = getLocalUpdatedAt()
    if (current) return current
    if (Array.isArray(habits) && habits.length > 0) {
        const now = Date.now()
        setLocalUpdatedAt(now)
        return now
    }
    return 0
}

export function saveHabitsWithMeta(habits, options = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
    const updatedAt = Number.isFinite(options.updatedAt)
        ? options.updatedAt
        : Date.now()
    setLocalUpdatedAt(updatedAt)
    if (options.silent) return
    if (typeof window === 'undefined') return
    window.dispatchEvent(
        new CustomEvent(SYNC_EVENT, {
            detail: {updatedAt},
        }),
    )
}
