// Consistency — Simple habits tracker (vanilla JS)
// Data model stored in localStorage

const STORAGE_KEY = 'consistency:habits'
const TAB_KEY = 'consistency:lastTab'

// Utilities
const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
const cloneTemplate = (id) => {
    const t = document.getElementById(id)
    if (!(t instanceof HTMLTemplateElement)) {
        throw new Error(`Template not found: ${id}`)
    }
    return t.content.firstElementChild.cloneNode(true)
}

const todayKey = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}` // YYYY-MM-DD in local time
}

const dateKey = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

const startOfWeek = (d, weekStartsOn = 1) => {
    // weekStartsOn: 1 = Monday, 0 = Sunday
    const date = new Date(d)
    const day = date.getDay()
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn
    date.setDate(date.getDate() - diff)
    date.setHours(0, 0, 0, 0)
    return date
}

const addDays = (d, n) => {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// Storage
function loadHabits() {
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

function saveHabits(habits) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
}

// Domain
function getCompletionsSet(habit) {
    return new Set(habit.completions || [])
}

function setCompletion(habit, dateKeyStr, done) {
    const set = getCompletionsSet(habit)
    if (done) set.add(dateKeyStr)
    else set.delete(dateKeyStr)
    habit.completions = Array.from(set).sort()
}

function isCompletedOn(habit, dateKeyStr) {
    return getCompletionsSet(habit).has(dateKeyStr)
}

function calcStreak(habit) {
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

// Views
function renderTabs(active) {
    const listBtn = document.querySelector('button.tab[data-tab="list"]')
    const statsBtn = document.querySelector('button.tab[data-tab="stats"]')
    const views = {
        list: document.getElementById('view-list'),
        stats: document.getElementById('view-stats'),
    }
    if (!listBtn || !statsBtn || !views.list || !views.stats) return
    listBtn.setAttribute('aria-selected', String(active === 'list'))
    statsBtn.setAttribute('aria-selected', String(active === 'stats'))
    views.list.hidden = active !== 'list'
    views.stats.hidden = active !== 'stats'
    localStorage.setItem(TAB_KEY, active)
}

function renderListView(habits) {
    const container = document.getElementById('view-list')
    if (!container) return
    const today = todayKey()

    const list = document.createElement('ul')
    list.className = 'task-list'

    if (habits.length === 0) list.append('Привычек пока нет')
    habits.forEach((h) => {
        const li = cloneTemplate('tmpl-habit-item')
        li.classList.toggle('is-completed', isCompletedOn(h, today))
        li.dataset.id = h.id
        const checkbox = li.querySelector('.task-checkbox')
        const name = li.querySelector('.task-name')
        const streak = li.querySelector('.task-streak')
        if (checkbox) {
            checkbox.checked = isCompletedOn(h, today)
            checkbox.title = 'Отметить выполнение за сегодня'
            checkbox.setAttribute('aria-label', `Выполнено сегодня: ${h.name}`)
        }
        if (name) name.textContent = h.name
        if (streak) {
            streak.textContent = `${calcStreak(h)} 🔥`
            streak.title = 'Текущий стрик'
        }
        list.append(li)
    })

    container.replaceChildren(list)

    renderAddBar()
}

function renderAddBar(showForm = false) {
    const bar = document.getElementById('add-bar')
    if (!bar) return
    bar.innerHTML = ''

    if (!showForm) {
        const addBtn = cloneTemplate('tmpl-add-button')
        addBtn.addEventListener('click', () => renderAddBar(true))
        bar.append(addBtn)
        return
    }

    const form = cloneTemplate('tmpl-add-form')
    const input = form.querySelector('input[name="name"]')
    const cancel = form.querySelector('.cancel')
    cancel?.addEventListener('click', () => renderAddBar(false))

    form.addEventListener('submit', (e) => {
        e.preventDefault()
        const name = input.value.trim()
        if (!name) return
        const habits = loadHabits()
        const maxOrder = habits.reduce((m, h) => Math.max(m, h.order ?? 0), -1)
        habits.push({
            id: uid(),
            name,
            createdAt: new Date().toISOString(),
            completions: [],
            order: maxOrder + 1,
        })
        saveHabits(habits)
        input.value = ''
        render(habits, 'list')
        renderAddBar(false)
    })

    bar.append(form)
    input.focus()
}

function renderStatsView(habits) {
    const container = document.getElementById('view-stats')
    if (!container) return
    const wrap = document.createElement('div')
    wrap.className = 'stats'

    const end = new Date()
    const endWeek = startOfWeek(end, 1) // Monday
    const weeks = 53 // roughly 1 year
    const start = addDays(endWeek, -(weeks - 1) * 7)

    habits.forEach((h) => {
        const card = cloneTemplate('tmpl-stats-card')
        const title = card.querySelector('.title')
        const streak = card.querySelector('.streak')
        if (title) title.textContent = h.name
        if (streak) streak.textContent = `${calcStreak(h)} 🔥`
        const grid = card.querySelector('.heatmap')

        const set = getCompletionsSet(h)

        // Build columns per week
        for (let w = 0; w < weeks; w++) {
            const col = cloneTemplate('tmpl-heatmap-week-col')

            const weekStart = addDays(start, w * 7)
            for (let d = 0; d < 7; d++) {
                const day = addDays(weekStart, d)
                const k = dateKey(day)
                const cell = cloneTemplate('tmpl-heatmap-day-cell')
                const done = set.has(k)
                if (done) cell.classList.add('is-done')
                cell.title = `${k} • ${done ? 'выполнено' : 'нет'}`
                cell.setAttribute(
                    'aria-label',
                    `${k}: ${done ? 'выполнено' : 'не выполнено'}`
                )
                col.append(cell)
            }
            grid.append(col)
        }

        wrap.append(card)
    })

    container.replaceChildren(wrap)
}

function render(habits, activeTab) {
    if (!activeTab) activeTab = localStorage.getItem(TAB_KEY) || 'list'
    renderTabs(activeTab)
    if (activeTab === 'list') {
        renderListView(habits)
    } else {
        renderStatsView(habits)
    }
    const addBar = document.getElementById('add-bar')
    if (addBar) addBar.hidden = activeTab !== 'list'
}

// Events
function bindEvents() {
    // Tab switching
    $$('button.tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab
            const habits = loadHabits()
            render(habits, tab)
        })
    })

    // Delegated events for list view
    const listView = document.getElementById('view-list')
    listView.addEventListener('change', (e) => {
        const t = e.target
        if (!(t instanceof HTMLInputElement)) return
        if (!t.classList.contains('task-checkbox')) return
        const li = t.closest('.task-item')
        if (!li) return
        const id = li.dataset.id
        const habits = loadHabits()
        const idx = habits.findIndex((x) => x.id === id)
        if (idx === -1) return
        setCompletion(habits[idx], todayKey(), t.checked)
        saveHabits(habits)
        render(habits, 'list')
    })

    listView.addEventListener('click', (e) => {
        const t = e.target
        if (!(t instanceof HTMLElement)) return
        const li = t.closest('.task-item')
        if (!li) return
        const id = li.dataset.id
        const habits = loadHabits()
        const idx = habits.findIndex((x) => x.id === id)
        if (idx === -1) return

        if (t.classList.contains('delete')) {
            if (confirm('Удалить привычку?')) {
                habits.splice(idx, 1)
                // Re-number orders
                habits.forEach((h, i) => (h.order = i))
                saveHabits(habits)
                render(habits, 'list')
            }
            return
        }
    })
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    const habits = loadHabits()
    // Default to list on first load
    const tab = localStorage.getItem(TAB_KEY) || 'list'
    render(habits, tab)
    bindEvents()
})
