import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const ADMIN_COOKIE = 'admin_session'

function getPasswordOrThrow(): string {
	const password = process.env.ADMIN_PASSWORD
	if (!password) {
		throw new Error('Missing ADMIN_PASSWORD environment variable')
	}
	return password
}

function sessionSignature(password: string): string {
	const salt = process.env.ADMIN_SESSION_SALT || '2025-blog-admin'
	return crypto.createHash('sha256').update(`${password}:${salt}`).digest('hex')
}

function sessionMaxAgeSeconds(): number {
	return Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS || 60 * 60 * 8)
}

function createSessionToken(password: string): string {
	const expiresAt = Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds()
	const signature = sessionSignature(`${password}:${expiresAt}`)
	return `${expiresAt}.${signature}`
}

function verifySessionToken(password: string, token: string | undefined): boolean {
	if (!token) return false
	const [expiresAtRaw, signature] = token.split('.')
	const expiresAt = Number(expiresAtRaw)
	if (!expiresAt || !signature) return false
	if (expiresAt <= Math.floor(Date.now() / 1000)) return false
	return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sessionSignature(`${password}:${expiresAt}`)))
}

function shouldUseSecureCookie(): boolean {
	return process.env.ADMIN_COOKIE_SECURE === 'true'
}

export function createAuthedResponse(): NextResponse {
	const password = getPasswordOrThrow()
	const res = NextResponse.json({ ok: true })
	res.cookies.set(ADMIN_COOKIE, createSessionToken(password), {
		httpOnly: true,
		sameSite: 'strict',
		secure: shouldUseSecureCookie(),
		path: '/',
		maxAge: sessionMaxAgeSeconds()
	})
	return res
}

export function clearAuthedResponse(): NextResponse {
	const res = NextResponse.json({ ok: true })
	res.cookies.set(ADMIN_COOKIE, '', {
		httpOnly: true,
		sameSite: 'strict',
		secure: shouldUseSecureCookie(),
		path: '/',
		maxAge: 0
	})
	return res
}

export async function isAdminAuthed(): Promise<boolean> {
	try {
		const password = getPasswordOrThrow()
		const cookieStore = await cookies()
		const token = cookieStore.get(ADMIN_COOKIE)?.value
		return verifySessionToken(password, token)
	} catch {
		return false
	}
}

export function verifyAdminPassword(password: string): boolean {
	try {
		return password === getPasswordOrThrow()
	} catch {
		return false
	}
}
