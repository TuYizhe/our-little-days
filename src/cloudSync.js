import { syncConfig } from './syncConfig'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const TABLE = 'couple_spaces'
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/[\s-]+/g, '')
}

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, '0')).join('')
}

async function deriveRoom(code) {
  const normalized = normalizeCode(code)
  if (normalized.length < 12) throw new Error('同步码至少需要 12 个字符')

  const roomHash = await crypto.subtle.digest('SHA-256', encoder.encode(`our-little-days:room:${normalized}`))
  const roomId = toHex(roomHash)
  const material = await crypto.subtle.importKey('raw', encoder.encode(normalized), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({
    name: 'PBKDF2',
    salt: encoder.encode(`our-little-days:encryption:v1:${roomId}`),
    iterations: 250000,
    hash: 'SHA-256',
  }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

  return { roomId, key, normalized }
}

async function encryptSnapshot(snapshot, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = encoder.encode(JSON.stringify({ version: 1, snapshot }))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return JSON.stringify({ version: 1, iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) })
}

async function decryptSnapshot(payload, key) {
  try {
    const parsed = JSON.parse(payload)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(parsed.iv) },
      key,
      base64ToBytes(parsed.data),
    )
    const decoded = JSON.parse(decoder.decode(plaintext))
    if (decoded.version !== 1 || !decoded.snapshot) throw new Error('unsupported payload')
    return decoded.snapshot
  } catch {
    throw new Error('同步码不正确，或云端数据已经损坏')
  }
}

function assertConfigured() {
  if (!syncConfig.url || !syncConfig.publishableKey) {
    throw new Error('云同步服务尚未完成配置')
  }
}

async function request(path, options = {}) {
  assertConfigured()
  const response = await fetch(`${syncConfig.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: syncConfig.publishableKey,
      ...options.headers,
    },
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(response.status === 401 || response.status === 403
      ? '云同步连接被拒绝，请检查公开密钥和数据权限'
      : `云同步暂时不可用（${response.status}）${detail ? `：${detail.slice(0, 80)}` : ''}`)
  }
  return response
}

export function isCloudConfigured() {
  return Boolean(syncConfig.url && syncConfig.publishableKey)
}

export function generateSyncCode() {
  const values = crypto.getRandomValues(new Uint8Array(20))
  const raw = [...values].map(value => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('')
  return raw.match(/.{1,5}/g).join('-')
}

export async function pullSnapshot(code) {
  const { roomId, key, normalized } = await deriveRoom(code)
  const response = await request(`${TABLE}?space_id=eq.${roomId}&select=payload,updated_at&limit=1`)
  const rows = await response.json()
  if (!rows.length) return { exists: false, normalized, roomId, snapshot: null, updatedAt: null }
  return {
    exists: true,
    normalized,
    roomId,
    snapshot: await decryptSnapshot(rows[0].payload, key),
    updatedAt: rows[0].updated_at,
  }
}

export async function pushSnapshot(code, snapshot) {
  const { roomId, key, normalized } = await deriveRoom(code)
  const payload = await encryptSnapshot(snapshot, key)
  const updatedAt = new Date().toISOString()
  const response = await request(`${TABLE}?on_conflict=space_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({ space_id: roomId, payload, updated_at: updatedAt }),
  })
  await response.json()
  return { normalized, roomId, updatedAt }
}
