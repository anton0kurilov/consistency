import {
    SYNC_ANON_KEY,
    SYNC_ENDPOINT,
    SYNC_SEED_KEY,
    SYNC_TABLE,
} from './constants.js'
import {
    ensureLocalUpdatedAt,
    getLocalUpdatedAt,
    loadHabits,
    saveHabitsWithMeta,
} from './storage.js'

const ADJECTIVES = [
    'amber',
    'brisk',
    'calm',
    'coral',
    'crisp',
    'dusk',
    'ember',
    'frosty',
    'golden',
    'ivory',
    'lucid',
    'misty',
    'north',
    'quiet',
    'royal',
    'vivid',
]

const NOUNS = [
    'anchor',
    'atlas',
    'canyon',
    'delta',
    'falcon',
    'forest',
    'galaxy',
    'harbor',
    'island',
    'jungle',
    'meadow',
    'ocean',
    'prism',
    'ridge',
    'summit',
    'timber',
]

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const baseEndpoint = SYNC_ENDPOINT.replace(/\/$/, '')

const bytesToBase64 = (bytes) => {
    let binary = ''
    bytes.forEach((b) => {
        binary += String.fromCharCode(b)
    })
    return btoa(binary)
}

const base64ToBytes = (base64) =>
    Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

const buildWord = (byte) => `${ADJECTIVES[byte >> 4]}-${NOUNS[byte & 15]}`

export const normalizeSeed = (seed) =>
    String(seed || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()

export const isSyncConfigured = () => Boolean(SYNC_ENDPOINT && SYNC_ANON_KEY)

export const generateSeedPhrase = (wordsCount = 12) => {
    const count = Math.max(6, Math.min(24, wordsCount))
    const bytes = new Uint8Array(count)
    if (crypto?.getRandomValues) {
        crypto.getRandomValues(bytes)
    } else {
        for (let i = 0; i < count; i++) {
            bytes[i] = Math.floor(Math.random() * 256)
        }
    }
    return Array.from(bytes, buildWord).join(' ')
}

export const getStoredSeed = () => localStorage.getItem(SYNC_SEED_KEY)

export const setStoredSeed = (seed) =>
    localStorage.setItem(SYNC_SEED_KEY, normalizeSeed(seed))

export const clearStoredSeed = () => localStorage.removeItem(SYNC_SEED_KEY)

const sha256Hex = async (text) => {
    const data = encoder.encode(text)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

const formatAccountId = (hex) => {
    if (!hex) return ''
    const head = hex.slice(0, 12)
    const number = Number.parseInt(head, 16) % 1000000
    const padded = String(number).padStart(6, '0')
    return `${padded.slice(0, 3)}•${padded.slice(3)}`
}

export const getAccountIdFragment = async (seed) => {
    if (!crypto?.subtle) return ''
    const normalized = normalizeSeed(seed)
    if (!normalized) return ''
    const id = await sha256Hex(normalized)
    return formatAccountId(id)
}

const deriveKey = async (seed) => {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(seed),
        {name: 'PBKDF2'},
        false,
        ['deriveKey'],
    )
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('consistency-sync'),
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        {name: 'AES-GCM', length: 256},
        false,
        ['encrypt', 'decrypt'],
    )
}

const encryptPayload = async (seed, data) => {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(seed)
    const encoded = encoder.encode(JSON.stringify(data))
    const cipher = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv},
        key,
        encoded,
    )
    return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`
}

const decryptPayload = async (seed, payload) => {
    if (typeof payload !== 'string') return null
    const [version, ivBase64, dataBase64] = payload.split('.')
    if (version !== 'v1' || !ivBase64 || !dataBase64) return null
    try {
        const key = await deriveKey(seed)
        const iv = base64ToBytes(ivBase64)
        const data = base64ToBytes(dataBase64)
        const plain = await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv},
            key,
            data,
        )
        return JSON.parse(decoder.decode(plain))
    } catch {
        return null
    }
}

const getHeaders = () => ({
    'Content-Type': 'application/json',
    apikey: SYNC_ANON_KEY,
    Authorization: `Bearer ${SYNC_ANON_KEY}`,
})

const fetchRemote = async (id) => {
    const url = new URL(`${baseEndpoint}/rest/v1/${SYNC_TABLE}`)
    url.searchParams.set('id', `eq.${id}`)
    url.searchParams.set('select', 'payload,updated_at')
    const res = await fetch(url.toString(), {headers: getHeaders()})
    if (!res.ok) {
        throw new Error('sync_fetch_failed')
    }
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const row = data[0] || {}
    return {
        payload: row.payload,
        updatedAt: Number(row.updated_at) || 0,
    }
}

const upsertRemote = async (id, payload, updatedAt) => {
    const url = `${baseEndpoint}/rest/v1/${SYNC_TABLE}?on_conflict=id`
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            ...getHeaders(),
            Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify([
            {
                id,
                payload,
                updated_at: updatedAt,
            },
        ]),
    })
    if (!res.ok) {
        throw new Error('sync_upsert_failed')
    }
}

export const syncOnce = async (seed) => {
    if (!isSyncConfigured()) return {status: 'not-configured'}
    if (!crypto?.subtle) return {status: 'crypto-unavailable'}
    const normalized = normalizeSeed(seed)
    if (!normalized) return {status: 'no-seed'}

    const localHabits = loadHabits()
    const localUpdatedAt = ensureLocalUpdatedAt(localHabits)
    const id = await sha256Hex(normalized)

    const remote = await fetchRemote(id)
    if (!remote || !remote.payload) {
        const payload = await encryptPayload(normalized, {habits: localHabits})
        const updatedAt = localUpdatedAt || Date.now()
        await upsertRemote(id, payload, updatedAt)
        return {status: 'pushed'}
    }

    const remoteData = await decryptPayload(normalized, remote.payload)
    if (!remoteData) return {status: 'seed-mismatch'}

    const remoteUpdatedAt = remote.updatedAt || 0
    if (remoteUpdatedAt > localUpdatedAt) {
        const habits = Array.isArray(remoteData.habits) ? remoteData.habits : []
        saveHabitsWithMeta(habits, {
            updatedAt: remoteUpdatedAt,
            silent: true,
        })
        return {status: 'pulled', appliedRemote: true}
    }

    if (remoteUpdatedAt < localUpdatedAt) {
        const payload = await encryptPayload(normalized, {habits: localHabits})
        await upsertRemote(id, payload, localUpdatedAt)
        return {status: 'pushed'}
    }

    return {status: 'up-to-date'}
}
