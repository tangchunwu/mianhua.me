import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_COOKIE = 'admin_session'

async function hashString(value: string): Promise<string> {
	const encoded = new TextEncoder().encode(value)
	const digest = await crypto.subtle.digest('SHA-256', encoded)
	return Array.from(new Uint8Array(digest))
		.map(byte => byte.toString(16).padStart(2, '0'))
		.join('')
}

async function expectedAdminToken(): Promise<string | null> {
	const password = process.env.ADMIN_PASSWORD
	if (!password) return null
	const salt = process.env.ADMIN_SESSION_SALT || '2025-blog-admin'
	return hashString(`${password}:${salt}`)
}

export async function proxy(req: NextRequest) {
	const expected = await expectedAdminToken()
	if (!expected) {
		return NextResponse.redirect(new URL('/', req.url))
	}

	const token = req.cookies.get(ADMIN_COOKIE)?.value
	if (token === expected) {
		return NextResponse.next()
	}

	return NextResponse.redirect(new URL('/', req.url))
}

export const config = {
	matcher: ['/write/:path*']
}

