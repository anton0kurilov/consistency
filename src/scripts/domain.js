import {MS_PER_DAY} from './constants.js'
import {addDays, dateKey, parseDateKeyToDate, todayKey, toStartOfDay} from './utils.js'

export function getCompletionsSet(habit) {
    return new Set(habit.completions || [])
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
    const set = getCompletionsSet(habit)
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
    if (created) return created
    const completions = Array.isArray(habit.completions)
        ? habit.completions.slice().sort()
        : []
    if (completions.length === 0) return null
    return parseDateKeyToDate(completions[0])
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
    const totalCompletions = getCompletionsSet(habit).size
    const daysSinceStart = getHabitActiveDays(habit)
    const totalDays = Math.max(daysSinceStart, totalCompletions)
    const percent =
        totalDays > 0 ? Math.round((totalCompletions / totalDays) * 100) : 0
    return {totalCompletions, totalDays, completionPercent: percent}
}
