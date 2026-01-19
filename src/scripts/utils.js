import {MAX_PAST_DAYS} from './constants.js'

export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) =>
    Array.from(root.querySelectorAll(sel))

export const cloneTemplate = (id) => {
    const t = document.getElementById(id)
    if (!(t instanceof HTMLTemplateElement)) {
        throw new Error(`Template not found: ${id}`)
    }
    return t.content.firstElementChild.cloneNode(true)
}

export const todayKey = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}` // YYYY-MM-DD in local time
}

export const dateKey = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export const startOfWeek = (d, weekStartsOn = 1) => {
    // weekStartsOn: 1 = Monday, 0 = Sunday
    const date = new Date(d)
    const day = date.getDay()
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn
    date.setDate(date.getDate() - diff)
    date.setHours(0, 0, 0, 0)
    return date
}

export const addDays = (d, n) => {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
}

export const uid = () =>
    Math.random().toString(36).slice(2) + Date.now().toString(36)

export const formatDayTitle = (date) =>
    new Intl.DateTimeFormat('ru-RU', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
    }).format(date)

export const formatDateKeyShort = (key) => {
    const parsed = parseDateKeyToDate(key)
    if (!parsed) return key
    const day = String(parsed.getDate()).padStart(2, '0')
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    return `${day}.${month}.${parsed.getFullYear()}`
}

export const formatDayTitleByKey = (key) => {
    const parsed = parseDateKeyToDate(key)
    if (!parsed) return key
    return formatDayTitle(parsed)
}

export const getRecentDayOptions = () => {
    const days = []
    for (let offset = 0; offset <= MAX_PAST_DAYS; offset++) {
        const date = addDays(new Date(), -offset)
        days.push({
            key: dateKey(date),
            date,
            dayNumber: String(date.getDate()),
            weekday: new Intl.DateTimeFormat('ru-RU', {
                weekday: 'short',
            })
                .format(date)
                .replace('.', '')
                .toUpperCase(),
            title: formatDayTitle(date),
            isToday: offset === 0,
            isYesterday: offset === 1,
        })
    }
    return days
}

export const toStartOfDay = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return null
    }
    const copy = new Date(date)
    copy.setHours(0, 0, 0, 0)
    return copy
}

export const parseDateKeyToDate = (key) => {
    if (typeof key !== 'string') return null
    const parts = key.split('-').map((p) => Number.parseInt(p, 10))
    if (parts.length !== 3) return null
    const [year, month, day] = parts
    if (!year || !month || !day) return null
    const date = new Date(year, month - 1, day)
    return toStartOfDay(date)
}

export const pluralize = (n, forms) => {
    const abs = Math.abs(n) % 100
    const last = abs % 10
    if (abs > 10 && abs < 20) return forms[2]
    if (last > 1 && last < 5) return forms[1]
    if (last === 1) return forms[0]
    return forms[2]
}
