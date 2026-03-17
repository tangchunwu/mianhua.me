import { NextResponse } from 'next/server'
import { createAuthedResponse, verifyAdminPassword } from '@/lib/admin-auth'
import { clearLoginFailures, getClientIp, getLoginRateLimitState, recordLoginFailure } from '@/lib/admin-rate-limit'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	try {
		const clientIp = getClientIp(req)
		const limitState = await getLoginRateLimitState(clientIp)
		if (limitState.limited) {
			return NextResponse.json(
				{
					ok: false,
					message: `Too many attempts. Retry in ${Math.ceil(limitState.retryAfterMs / 60000)} minutes`
				},
				{
					status: 429,
					headers: {
						'Retry-After': String(Math.ceil(limitState.retryAfterMs / 1000))
					}
				}
			)
		}

		const body = await req.json()
		const password = String(body?.password || '')
		if (!verifyAdminPassword(password)) {
			await recordLoginFailure(clientIp)
			return NextResponse.json({ ok: false, message: 'Invalid password' }, { status: 401 })
		}
		await clearLoginFailures(clientIp)
		return createAuthedResponse()
	} catch (error: any) {
		return NextResponse.json({ ok: false, message: error?.message || 'Login failed' }, { status: 500 })
	}
}
