import {MS_PER_DAY} from './constants.js'
import {
    addDays,
    dateKey,
    parseDateKeyToDate,
    todayKey,
    toStartOfDay,
} from './utils.js'

export function getCompletionsSet(habit) {
    return new Set(habit.completions || [])
}

function getStatsStartedAtDate(habit) {
    const fromKey = parseDateKeyToDate(habit.statsStartedAt)
    if (fromKey) return fromKey
    return toStartOfDay(new Date(habit.statsStartedAt))
}

export function getStatsCompletionsSet(habit) {
    const start = getHabitStartDate(habit)
    const set = new Set()
    const completions = Array.isArray(habit.completions)
        ? habit.completions
        : []

    completions.forEach((key) => {
        if (typeof key !== 'string') return
        const date = parseDateKeyToDate(key)
        if (!date) return
        if (start && date.getTime() < start.getTime()) return
        set.add(key)
    })

    return set
}

export function setCompletion(habit, dateKeyStr, done) {
    const set = getCompletionsSet(habit)
    if (done) set.add(dateKeyStr)
    else set.delete(dateKeyStr)
    habit.completions = Array.from(set).sort()
}

export function isCompletedOn(habit, dateKeyStr) {
    return getCompletionsSet(habit).has(dateKeyStr)
}

export function calcStreak(habit) {
    // Count consecutive days ending at today (or yesterday if today not done)
    const set = getStatsCompletionsSet(habit)
    let count = 0
    let cursor = new Date()
    // If today is not completed but yesterday is, streak counts back from yesterday
    const today = todayKey()
    const hasToday = set.has(today)
    if (!hasToday) {
        cursor = addDays(cursor, -1)
    }
    while (true) {
        const key = dateKey(cursor)
        if (set.has(key)) {
            count += 1
            cursor = addDays(cursor, -1)
        } else {
            break
        }
    }
    return count
}

export function getHabitStartDate(habit) {
    const created = toStartOfDay(new Date(habit.createdAt))
    const statsStartedAt = getStatsStartedAtDate(habit)
    if (statsStartedAt && created) {
        return statsStartedAt.getTime() > created.getTime()
            ? statsStartedAt
            : created
    }
    if (statsStartedAt) return statsStartedAt

    const completions = Array.isArray(habit.completions)
        ? habit.completions.slice().sort()
        : []
    const firstCompletion =
        completions.length > 0 ? parseDateKeyToDate(completions[0]) : null
    if (created && firstCompletion) {
        return created.getTime() <= firstCompletion.getTime()
            ? created
            : firstCompletion
    }
    return created || firstCompletion || null
}

export function getHabitActiveDays(habit) {
    const start = getHabitStartDate(habit)
    if (!start) return 0
    const today = toStartOfDay(new Date())
    if (!today) return 0
    const diff = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY)
    if (diff < 0) return 0
    return diff + 1
}

export function calcCompletionStats(habit) {
    const today = toStartOfDay(new Date())
    const start = getHabitStartDate(habit)
    let totalCompletions = 0
    if (today) {
        const set = new Set()
        const completions = Array.isArray(habit.completions)
            ? habit.completions
            : []
        completions.forEach((key) => {
            if (typeof key !== 'string') return
            const date = parseDateKeyToDate(key)
            if (!date) return
            if (start && date.getTime() < start.getTime()) return
            if (date.getTime() > today.getTime()) return
            set.add(key)
        })
        totalCompletions = set.size
    } else {
        totalCompletions = getStatsCompletionsSet(habit).size
    }
    const totalDays = getHabitActiveDays(habit)
    const percent =
        totalDays > 0 ? Math.round((totalCompletions / totalDays) * 100) : 0
    return {totalCompletions, totalDays, completionPercent: percent}
}

export function getResetCreatedAt(statsStartedAt) {
    return `${statsStartedAt}T12:00:00`
}

export function normalizeHabitStatsResetDates(habits) {
    let changed = false
    const nextHabits = habits.map((habit) => {
        if (typeof habit.statsStartedAt !== 'string') return habit
        const statsStart = parseDateKeyToDate(habit.statsStartedAt)
        if (!statsStart) return habit
        const created = toStartOfDay(new Date(habit.createdAt))
        if (created && created.getTime() >= statsStart.getTime()) return habit

        changed = true
        return {
            ...habit,
            createdAt: getResetCreatedAt(habit.statsStartedAt),
        }
    })

    return {habits: nextHabits, changed}
}

export function resetHabitStats(habits, statsStartedAt) {
    const resetCreatedAt = getResetCreatedAt(statsStartedAt)
    return habits.map((habit) => ({
        ...habit,
        createdAt: resetCreatedAt,
        completions: [],
        statsStartedAt,
    }))
}
