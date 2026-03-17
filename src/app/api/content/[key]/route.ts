import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { isServerContentKey, readServerContent, removePublicFileByUrl, writeServerContent } from '@/lib/server-config'
import { storeImageFile } from '@/lib/server-image-host'
import { normalizeContentPayload, replaceStringValues } from '@/lib/url-utils'

export const runtime = 'nodejs'

function parseJsonField<T>(raw: FormDataEntryValue | null, fallback: T): T {
	if (!raw || typeof raw !== 'string') return fallback
	try {
		return JSON.parse(raw) as T
	} catch {
		return fallback
	}
}

export async function GET(_: Request, context: { params: Promise<{ key: string }> }) {
	const { key } = await context.params
	if (!isServerContentKey(key)) {
		return NextResponse.json({ message: 'Unknown content key' }, { status: 404 })
	}

	try {
		const data = await readServerContent(key)
		return NextResponse.json({ data })
	} catch (error: any) {
		return NextResponse.json({ message: error?.message || 'Failed to read content' }, { status: 500 })
	}
}

export async function POST(req: Request, context: { params: Promise<{ key: string }> }) {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
	}

	const { key } = await context.params
	if (!isServerContentKey(key)) {
		return NextResponse.json({ message: 'Unknown content key' }, { status: 404 })
	}

	try {
		const contentType = req.headers.get('content-type') || ''
		if (contentType.includes('application/json')) {
			const { data } = await req.json()
			const normalizedData = normalizeContentPayload(key, data)
			await writeServerContent(key, normalizedData)
			return NextResponse.json({ ok: true, data: normalizedData })
		}

		const form = await req.formData()
		const currentData = await readServerContent(key)
		const data = parseJsonField(form.get('data'), currentData)
		const uploads = parseJsonField<Array<{ field?: string; url?: string }>>(form.get('uploads'), [])
		const removedUrls = parseJsonField<string[]>(form.get('removedUrls'), [])
		const replacements = new Map<string, string>()

		for (const upload of uploads) {
			if (!upload?.field || !upload?.url) continue
			const file = form.get(upload.field)
			if (file instanceof File) {
				const finalUrl = await storeImageFile(file, { localUrlPath: upload.url })
				replacements.set(upload.url, finalUrl)
			}
		}

		for (const url of removedUrls) {
			await removePublicFileByUrl(url)
		}

		const nextData = normalizeContentPayload(key, replaceStringValues(data, replacements))
		await writeServerContent(key, nextData)
		return NextResponse.json({ ok: true, data: nextData })
	} catch (error: any) {
		return NextResponse.json({ message: error?.message || 'Failed to save content' }, { status: 500 })
	}
}

