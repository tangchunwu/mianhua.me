import path from 'node:path'
import fs from 'node:fs/promises'

type RateLimitEntry = {
	failedAttempts: number
	firstFailedAt: number
	lockedUntil: number
}

type RateLimitStore = Record<string, RateLimitEntry>

const dataDir = path.join(process.cwd(), 'data')
const rateLimitFilePath = path.join(dataDir, 'admin-login-rate-limit.json')

const MAX_FAILED_ATTEMPTS = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 5)
const WINDOW_MS = Number(process.env.ADMIN_LOGIN_WINDOW_MS || 15 * 60 * 1000)
const LOCK_MS = Number(process.env.ADMIN_LOGIN_LOCK_MS || 30 * 60 * 1000)

function now(): number {
	return Date.now()
}

async function ensureDataDir(): Promise<void> {
	await fs.mkdir(dataDir, { recursive: true })
}

async function readStore(): Promise<RateLimitStore> {
	await ensureDataDir()
	try {
		const raw = await fs.readFile(rateLimitFilePath, 'utf8')
		return JSON.parse(raw) as RateLimitStore
	} catch {
		return {}
	}
}

async function writeStore(store: RateLimitStore): Promise<void> {
	await ensureDataDir()
	await fs.writeFile(rateLimitFilePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

function pruneExpiredEntry(entry: RateLimitEntry | undefined): RateLimitEntry | null {
	if (!entry) return null
	const current = now()
	if (entry.lockedUntil > 0 && entry.lockedUntil <= current) return null
	if (entry.lockedUntil === 0 && current - entry.firstFailedAt > WINDOW_MS) return null
	return entry
}

export function getClientIp(req: Request): string {
	const forwardedFor = req.headers.get('x-forwarded-for')
	if (forwardedFor) return forwardedFor.split(',')[0].trim()
	return req.headers.get('x-real-ip') || 'unknown'
}

export async function getLoginRateLimitState(key: string): Promise<{ limited: boolean; retryAfterMs: number }> {
	const store = await readStore()
	const entry = pruneExpiredEntry(store[key])
	if (!entry) {
		if (store[key]) {
			delete store[key]
			await writeStore(store)
		}
		return { limited: false, retryAfterMs: 0 }
	}

	if (entry.lockedUntil > now()) {
		return {
			limited: true,
			retryAfterMs: entry.lockedUntil - now()
		}
	}

	return { limited: false, retryAfterMs: 0 }
}

export async function recordLoginFailure(key: string): Promise<{ limited: boolean; retryAfterMs: number }> {
	const store = await readStore()
	const current = now()
	const entry = pruneExpiredEntry(store[key])

	if (!entry) {
		store[key] = {
			failedAttempts: 1,
			firstFailedAt: current,
			lockedUntil: 0
		}
		await writeStore(store)
		return { limited: false, retryAfterMs: 0 }
	}

	if (current - entry.firstFailedAt > WINDOW_MS) {
		store[key] = {
			failedAttempts: 1,
			firstFailedAt: current,
			lockedUntil: 0
		}
		await writeStore(store)
		return { limited: false, retryAfterMs: 0 }
	}

	entry.failedAttempts += 1
	if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
		entry.lockedUntil = current + LOCK_MS
		store[key] = entry
		await writeStore(store)
		return { limited: true, retryAfterMs: LOCK_MS }
	}

	store[key] = entry
	await writeStore(store)
	return { limited: false, retryAfterMs: 0 }
}

export async function clearLoginFailures(key: string): Promise<void> {
	const store = await readStore()
	if (store[key]) {
		delete store[key]
		await writeStore(store)
	}
}
