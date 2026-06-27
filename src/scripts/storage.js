import {STORAGE_KEY, SYNC_EVENT, SYNC_UPDATED_AT_KEY} from './constants.js'
import {normalizeHabitStatsResetDates} from './domain.js'
import {uid} from './utils.js'

export function loadHabits() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        const habits = parsed
            .map((h, i) => {
                const habit = {
                    id: h.id || uid(),
                    name: String(h.name || 'Без названия'),
                    createdAt: h.createdAt || new Date().toISOString(),
                    completions: Array.isArray(h.completions)
                        ? h.completions
                        : [],
                    order: typeof h.order === 'number' ? h.order : i,
                }
                if (typeof h.statsStartedAt === 'string') {
                    habit.statsStartedAt = h.statsStartedAt
                }
                return habit
            })
            .sort((a, b) => a.order - b.order)
        const normalized = normalizeHabitStatsResetDates(habits)
        if (normalized.changed) {
            persistMigratedHabits(normalized.habits)
        }
        return normalized.habits
    } catch {
        return []
    }
}

export function saveHabits(habits, options = {}) {
    saveHabitsWithMeta(habits, options)
}

function persistMigratedHabits(habits) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
    const updatedAt = Math.max(Date.now(), getLocalUpdatedAt() + 1)
    setLocalUpdatedAt(updatedAt)
    if (typeof window === 'undefined') return
    window.dispatchEvent(
        new CustomEvent(SYNC_EVENT, {
            detail: {updatedAt, syncMode: 'push'},
        }),
    )
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
        : Math.max(Date.now(), getLocalUpdatedAt() + 1)
    setLocalUpdatedAt(updatedAt)
    if (options.silent) return
    if (typeof window === 'undefined') return
    const detail = {updatedAt}
    if (options.syncMode) detail.syncMode = options.syncMode
    window.dispatchEvent(
        new CustomEvent(SYNC_EVENT, {
            detail,
        }),
    )
}
