import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type ChatRequestBody = {
	message?: string
	session_id?: string
}

function getConfig() {
	const url = process.env.LIVE2D_CHAT_API_URL
	const apiKey = process.env.LIVE2D_CHAT_API_KEY

	if (!url) {
		throw new Error('Missing LIVE2D_CHAT_API_URL')
	}

	if (!apiKey) {
		throw new Error('Missing LIVE2D_CHAT_API_KEY')
	}

	return { url, apiKey }
}

export async function POST(request: Request) {
	let body: ChatRequestBody

	try {
		body = (await request.json()) as ChatRequestBody
	} catch {
		return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
	}

	const message = body.message?.trim()
	if (!message) {
		return NextResponse.json({ ok: false, error: 'Message is required' }, { status: 400 })
	}

	let config: ReturnType<typeof getConfig>
	try {
		config = getConfig()
	} catch (error) {
		return NextResponse.json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Live2D chat is not configured'
			},
			{ status: 503 }
		)
	}

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), Number(process.env.LIVE2D_CHAT_TIMEOUT_MS || 15000))

	try {
		const upstreamResponse = await fetch(config.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': config.apiKey
			},
			body: JSON.stringify({
				message,
				session_id: body.session_id || `visitor-${Date.now()}`
			}),
			cache: 'no-store',
			signal: controller.signal
		})

		const text = await upstreamResponse.text()
		let data: unknown = null

		try {
			data = text ? JSON.parse(text) : null
		} catch {
			data = { raw: text }
		}

		if (!upstreamResponse.ok) {
			return NextResponse.json(
				{
					ok: false,
					error: 'Upstream live2d chat request failed',
					status: upstreamResponse.status,
					data
				},
				{ status: 502 }
			)
		}

		return NextResponse.json({ ok: true, data })
	} catch (error) {
		return NextResponse.json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Unknown live2d chat error'
			},
			{ status: 502 }
		)
	} finally {
		clearTimeout(timeout)
	}
}
