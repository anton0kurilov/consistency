// Consistency — Simple habits tracker (vanilla JS)
// Data model stored in localStorage

const STORAGE_KEY = 'consistency:habits'
const TAB_KEY = 'consistency:lastTab'
const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_PAST_DAYS = 5

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

let selectedDayKey = todayKey()

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

const formatDayTitle = (date) =>
    new Intl.DateTimeFormat('ru-RU', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
    }).format(date)

const formatDayTitleByKey = (key) => {
    const parsed = parseDateKeyToDate(key)
    if (!parsed) return key
    return formatDayTitle(parsed)
}

const getRecentDayOptions = () => {
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

// Swipe-to-delete (mobile)
let swipeState = null
let openSwipeItem = null

const SWIPE_ACTIONS_WIDTH_FALLBACK = 200
const SWIPE_THRESHOLD_RATIO = 0.4

function isSwipeEnabledEnvironment() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false
    }
    const mq = window.matchMedia?.('(max-width: 600px)')
    const coarse = window.matchMedia?.('(pointer: coarse)')
    return Boolean(mq?.matches && coarse?.matches)
}

function getSwipeElements(item) {
    const main = item.querySelector('.task-main')
    const actions = item.querySelector('.task-actions')
    if (!main || !actions) return null
    return {main, actions}
}

function getSwipeWidth(item, actions) {
    const rect = actions.getBoundingClientRect()
    if (rect.width) return rect.width
    const style = getComputedStyle(item)
    const cssVar = style.getPropertyValue('--swipe-actions-width')
    const parsed = parseFloat(cssVar)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
    return SWIPE_ACTIONS_WIDTH_FALLBACK
}

function applySwipeTranslate(state, translate) {
    state.currentTranslate = translate
    state.main.style.transform = `translateX(${translate}px)`
    const progress = 1 + translate / state.maxReveal
    const clamped = Math.min(1, Math.max(0, progress))
    state.actions.style.transform = `translate(${clamped * 100}%, -50%)`
}

function finishSwipe(open) {
    if (!swipeState) return
    const {item, main, actions} = swipeState
    item.classList.remove('is-dragging')
    main.style.transition = ''
    actions.style.transition = ''
    main.style.transform = ''
    actions.style.transform = ''

    if (open) {
        if (openSwipeItem && openSwipeItem !== item) {
            closeSwipe(openSwipeItem)
        }
        item.classList.add('is-swipe-open')
        openSwipeItem = item
    } else {
        item.classList.remove('is-swipe-open')
        if (openSwipeItem === item) openSwipeItem = null
    }

    swipeState = null
}

function closeSwipe(item) {
    if (!item) return
    item.classList.remove('is-swipe-open')
    if (openSwipeItem === item) openSwipeItem = null
}

function handleSwipePointerDown(e) {
    if (!isSwipeEnabledEnvironment()) return
    if (e.pointerType !== 'touch') return
    if (!(e.target instanceof HTMLElement)) return
    const item = e.target.closest('.task-item')
    if (!item) {
        if (openSwipeItem) closeSwipe(openSwipeItem)
        return
    }
    if (e.target.closest('.task-actions')) return

    const elements = getSwipeElements(item)
    if (!elements) return

    const {main, actions} = elements
    const maxReveal = getSwipeWidth(item, actions)

    if (openSwipeItem && openSwipeItem !== item) {
        closeSwipe(openSwipeItem)
    }

    swipeState = {
        pointerId: e.pointerId,
        item,
        main,
        actions,
        startX: e.clientX,
        startY: e.clientY,
        startTranslate: item.classList.contains('is-swipe-open')
            ? -maxReveal
            : 0,
        currentTranslate: 0,
        maxReveal,
        active: false,
    }
}

function handleSwipePointerMove(e) {
    if (!swipeState) return
    if (e.pointerId !== swipeState.pointerId) return

    const deltaX = e.clientX - swipeState.startX
    const deltaY = e.clientY - swipeState.startY

    if (!swipeState.active) {
        if (Math.abs(deltaX) < 8) return
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            swipeState = null
            return
        }
        swipeState.active = true
        swipeState.item.classList.add('is-dragging')
        swipeState.main.style.transition = 'none'
        swipeState.actions.style.transition = 'none'
        try {
            swipeState.item.setPointerCapture(e.pointerId)
        } catch {}
    }

    const next = Math.max(
        -swipeState.maxReveal,
        Math.min(0, swipeState.startTranslate + deltaX)
    )
    applySwipeTranslate(swipeState, next)
    e.preventDefault()
}

function handleSwipePointerEnd(e) {
    if (!swipeState) return
    if (e.pointerId !== swipeState.pointerId) return

    if (!swipeState.active) {
        finishSwipe(false)
        return
    }

    const shouldOpen =
        swipeState.currentTranslate <=
        -swipeState.maxReveal * SWIPE_THRESHOLD_RATIO

    finishSwipe(shouldOpen)
}

function handleGlobalPointerDown(e) {
    if (!openSwipeItem) return
    if (e.pointerType !== 'touch') return
    if (!(e.target instanceof HTMLElement)) return
    const item = e.target.closest('.task-item')
    if (item === openSwipeItem) return
    closeSwipe(openSwipeItem)
}

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

function toStartOfDay(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return null
    }
    const copy = new Date(date)
    copy.setHours(0, 0, 0, 0)
    return copy
}

function parseDateKeyToDate(key) {
    if (typeof key !== 'string') return null
    const parts = key.split('-').map((p) => Number.parseInt(p, 10))
    if (parts.length !== 3) return null
    const [year, month, day] = parts
    if (!year || !month || !day) return null
    const date = new Date(year, month - 1, day)
    return toStartOfDay(date)
}

function getHabitStartDate(habit) {
    const created = toStartOfDay(new Date(habit.createdAt))
    if (created) return created
    const completions = Array.isArray(habit.completions)
        ? habit.completions.slice().sort()
        : []
    if (completions.length === 0) return null
    return parseDateKeyToDate(completions[0])
}

function getHabitActiveDays(habit) {
    const start = getHabitStartDate(habit)
    if (!start) return 0
    const today = toStartOfDay(new Date())
    if (!today) return 0
    const diff = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY)
    if (diff < 0) return 0
    return diff + 1
}

function calcCompletionStats(habit) {
    const totalCompletions = getCompletionsSet(habit).size
    const daysSinceStart = getHabitActiveDays(habit)
    const totalDays = Math.max(daysSinceStart, totalCompletions)
    const percent =
        totalDays > 0 ? Math.round((totalCompletions / totalDays) * 100) : 0
    return {totalCompletions, totalDays, completionPercent: percent}
}

function pluralize(n, forms) {
    const abs = Math.abs(n) % 100
    const last = abs % 10
    if (abs > 10 && abs < 20) return forms[2]
    if (last > 1 && last < 5) return forms[1]
    if (last === 1) return forms[0]
    return forms[2]
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

function renderDaySwitcher(activeTab) {
    const container = document.getElementById('day-switcher')
    if (!container) return

    if (activeTab !== 'list') {
        container.hidden = true
        container.replaceChildren()
        return
    }

    const options = getRecentDayOptions()
    if (!options.some((o) => o.key === selectedDayKey)) {
        selectedDayKey = options[0]?.key || todayKey()
    }

    const wrap = document.createElement('div')
    wrap.className = 'day-switcher'
    wrap.setAttribute('role', 'group')
    wrap.setAttribute('aria-label', 'Выбор дня')
    options.forEach(
        ({key, dayNumber, weekday, title, isToday, isYesterday}) => {
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.className = 'btn day-switcher__btn'
            btn.dataset.dateKey = key
            const ariaLabelSuffix =
                isToday || isYesterday
                    ? isToday
                        ? 'Сегодня'
                        : 'Вчера'
                    : ''
            btn.title = ariaLabelSuffix ? `${title} • ${ariaLabelSuffix}` : title
            btn.setAttribute('aria-label', btn.title)

            const dateEl = document.createElement('span')
            dateEl.className = 'day-switcher__date'
            dateEl.textContent = dayNumber

            const weekdayEl = document.createElement('span')
            weekdayEl.className = 'day-switcher__weekday'
            weekdayEl.textContent = weekday

            btn.append(dateEl, weekdayEl)
            btn.setAttribute('aria-pressed', String(key === selectedDayKey))
            if (key === selectedDayKey) btn.classList.add('is-active')
            btn.addEventListener('click', () => {
                selectedDayKey = key
                const habits = loadHabits()
                render(habits, 'list')
            })
            wrap.append(btn)
        }
    )

    container.hidden = false
    container.replaceChildren(wrap)
}

function renderListView(habits, dayKey) {
    const container = document.getElementById('view-list')
    if (!container) return
    const currentDay = dayKey || todayKey()

    const list = document.createElement('ul')
    list.className = 'task-list'

    if (habits.length === 0) list.append('Привычек пока нет')
    habits.forEach((h) => {
        const li = cloneTemplate('tmpl-habit-item')
        const isDone = isCompletedOn(h, currentDay)
        li.classList.toggle('is-completed', isDone)
        li.dataset.id = h.id
        const checkbox = li.querySelector('.task-checkbox')
        const name = li.querySelector('.task-name')
        const streak = li.querySelector('.task-streak')
        if (checkbox) {
            checkbox.checked = isDone
            const dayTitle = formatDayTitleByKey(currentDay)
            checkbox.title = `Отметить выполнение за ${dayTitle}`
            checkbox.setAttribute(
                'aria-label',
                `Выполнено за ${dayTitle}: ${h.name}`
            )
        }
        if (name) name.textContent = h.name
        if (streak) {
            streak.textContent = `${calcStreak(h)} 🔥`
            streak.title = 'Текущий стрик'
        }
        list.append(li)
    })

    container.replaceChildren(list)
    openSwipeItem = null

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
    const input = form.querySelector('input[name="task-name"]')
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

    if (habits.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'stats__empty'
        empty.textContent = 'Добавьте привычки, чтобы увидеть их статистику.'
        wrap.append(empty)
        container.replaceChildren(wrap)
        return
    }

    const today = toStartOfDay(new Date())
    const weeks = 4
    const endWeek = startOfWeek(today, 1)
    const rangeStart = addDays(endWeek, -(weeks - 1) * 7)

    habits.forEach((habit) => {
        const group = cloneTemplate('tmpl-habit-stats')
        const title = group.querySelector('.habit-stats__title')
        if (title) title.textContent = habit.name
        const cards = group.querySelector('.habit-stats__cards')
        if (!cards) {
            wrap.append(group)
            return
        }

        const streakCount = calcStreak(habit)
        const {totalCompletions, totalDays, completionPercent} =
            calcCompletionStats(habit)

        const streakCard = cloneTemplate('tmpl-stats-info-card')
        streakCard.classList.add('stat-card--streak')
        const streakTitle = streakCard.querySelector('.stat-card__title')
        if (streakTitle) streakTitle.textContent = 'Текущий стрик'
        const streakValue = streakCard.querySelector('.stat-card__value')
        if (streakValue) streakValue.textContent = `${streakCount} 🔥`
        const streakMeta = streakCard.querySelector('.stat-card__meta')
        if (streakMeta) {
            const word = pluralize(streakCount, ['день', 'дня', 'дней'])
            streakMeta.textContent = `${word} подряд`
        }
        cards.append(streakCard)

        const totalsCard = cloneTemplate('tmpl-stats-info-card')
        totalsCard.classList.add('stat-card--totals')
        const totalsTitle = totalsCard.querySelector('.stat-card__title')
        if (totalsTitle) totalsTitle.textContent = 'Выполненные дни'
        const totalsValue = totalsCard.querySelector('.stat-card__value')
        if (totalsValue) totalsValue.textContent = String(totalCompletions)
        const totalsMeta = totalsCard.querySelector('.stat-card__meta')
        if (totalsMeta) {
            const daysLabel = totalDays === 1 ? 'дня' : 'дней'
            totalsMeta.textContent = `из ${totalDays} ${daysLabel} • ${completionPercent}%`
        }
        cards.append(totalsCard)

        const heatmapCard = cloneTemplate('tmpl-stats-heatmap-card')
        const heatmapTitle = heatmapCard.querySelector('.stat-card__title')
        if (heatmapTitle) heatmapTitle.textContent = 'Последние 4 недели'
        const grid = heatmapCard.querySelector('.heatmap')
        if (grid) {
            const set = getCompletionsSet(habit)
            for (let w = 0; w < weeks; w++) {
                const col = cloneTemplate('tmpl-heatmap-week-col')
                const weekStart = addDays(rangeStart, w * 7)
                for (let d = 0; d < 7; d++) {
                    const day = addDays(weekStart, d)
                    const key = dateKey(day)
                    const cell = cloneTemplate('tmpl-heatmap-day-cell')
                    const done = set.has(key)
                    const isFuture = today && day.getTime() > today.getTime()
                    if (done) cell.classList.add('is-done')
                    if (isFuture) cell.classList.add('is-future')
                    const statusLabel = isFuture
                        ? 'день ещё не наступил'
                        : done
                        ? 'выполнено'
                        : 'не выполнено'
                    cell.title = `${key} • ${statusLabel}`
                    cell.setAttribute('aria-label', `${key}: ${statusLabel}`)
                    col.append(cell)
                }
                grid.append(col)
            }
        }
        cards.append(heatmapCard)

        wrap.append(group)
    })

    container.replaceChildren(wrap)
}

function render(habits, activeTab) {
    if (!activeTab) activeTab = localStorage.getItem(TAB_KEY) || 'list'
    renderTabs(activeTab)
    renderDaySwitcher(activeTab)
    if (activeTab === 'list') {
        renderListView(habits, selectedDayKey)
    } else {
        renderStatsView(habits)
    }
    const addBar = document.getElementById('add-bar')
    if (addBar) addBar.hidden = activeTab !== 'list'
    const footer = document.querySelector('.app-footer')
    if (footer) footer.hidden = activeTab === 'list'
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
    listView.addEventListener('pointerdown', handleSwipePointerDown)
    listView.addEventListener('pointermove', handleSwipePointerMove)
    listView.addEventListener('pointerup', handleSwipePointerEnd)
    listView.addEventListener('pointercancel', handleSwipePointerEnd)
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
        setCompletion(habits[idx], selectedDayKey, t.checked)
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
                if (li === openSwipeItem) {
                    openSwipeItem = null
                }
                habits.splice(idx, 1)
                // Re-number orders
                habits.forEach((h, i) => (h.order = i))
                saveHabits(habits)
                render(habits, 'list')
            }
            return
        } else if (t.classList.contains('edit')) {
            if (li === openSwipeItem) {
                closeSwipe(li)
            }
            const currentName = habits[idx].name
            const nextName = prompt(
                'Введите новое название привычки',
                currentName
            )
            if (nextName === null) return
            const trimmed = nextName.trim()
            if (!trimmed) {
                alert('Название не может быть пустым')
                return
            }
            if (trimmed.length > 100) {
                alert('Название не может быть длиннее 100 символов')
                return
            }
            if (trimmed === currentName) return
            habits[idx].name = trimmed
            saveHabits(habits)
            render(habits, 'list')
            return
        }
    })

    document.addEventListener('pointerdown', handleGlobalPointerDown)
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    const habits = loadHabits()
    // Default to list on first load
    const tab = localStorage.getItem(TAB_KEY) || 'list'
    render(habits, tab)
    bindEvents()
})
