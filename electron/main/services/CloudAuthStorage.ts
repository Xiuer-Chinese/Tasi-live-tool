/**
 * 云鉴权 Token 存储：主进程读写，优先安全存储。
 * 当前实现：加密文件（AES 简单封装）。可选接入 keytar（系统凭据库），见文档说明。
 * 风险：加密文件仍可能被提取后离线破解，生产建议接入 keytar 或系统钥匙串。
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const ALG = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 16
const SALT_LEN = 32
const TAG_LEN = 16

function getStoragePath(): string {
  const userData = app.getPath('userData')
  const dir = path.join(userData, 'auth')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return path.join(dir, 'tokens.enc')
}

function getSecretKey(): Buffer {
  const base = process.env.AUTH_STORAGE_SECRET ?? 'tashi-cloud-auth-storage-change-in-production'
  return scryptSync(base, 'salt', KEY_LEN)
}

export interface StoredTokens {
  access_token: string | null
  refresh_token: string | null
}

export function getStoredTokens(): StoredTokens {
  const filePath = getStoragePath()
  if (!existsSync(filePath)) return { access_token: null, refresh_token: null }
  try {
    const raw = readFileSync(filePath)
    const key = getSecretKey()
    const salt = raw.subarray(0, SALT_LEN)
    const iv = raw.subarray(SALT_LEN, SALT_LEN + IV_LEN)
    const tag = raw.subarray(raw.length - TAG_LEN)
    const enc = raw.subarray(SALT_LEN + IV_LEN, raw.length - TAG_LEN)
    const keyDerived = scryptSync(key.toString('hex'), salt, KEY_LEN)
    const dec = createDecipheriv(ALG, keyDerived, iv)
    dec.setAuthTag(tag)
    const text = Buffer.concat([dec.update(enc), dec.final()]).toString('utf8')
    const data = JSON.parse(text) as StoredTokens
    return {
      access_token: data.access_token ?? null,
      refresh_token: data.refresh_token ?? null,
    }
  } catch {
    return { access_token: null, refresh_token: null }
  }
}

export function setStoredTokens(tokens: StoredTokens): void {
  const filePath = getStoragePath()
  const key = getSecretKey()
  const salt = randomBytes(SALT_LEN)
  const keyDerived = scryptSync(key.toString('hex'), salt, KEY_LEN)
  const iv = randomBytes(IV_LEN)
  const enc = createCipheriv(ALG, keyDerived, iv)
  const plain = JSON.stringify(tokens)
  const encBuf = Buffer.concat([enc.update(plain, 'utf8'), enc.final()])
  const tag = enc.getAuthTag()
  writeFileSync(filePath, Buffer.concat([salt, iv, encBuf, tag]))
}

export function clearStoredTokens(): void {
  const filePath = getStoragePath()
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
    } catch {
      // ignore
    }
  }
}
