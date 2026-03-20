import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { saveBlogContent } from '@/lib/server-blog'

export const runtime = 'nodejs'

function parseJsonField<T>(raw: FormDataEntryValue | null, fallback: T): T {
	if (!raw || typeof raw !== 'string') return fallback
	try {
		return JSON.parse(raw) as T
	} catch {
		return fallback
	}
}

export async function POST(req: Request) {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
	}

	try {
		const formData = await req.formData()
		const form = parseJsonField<any>(formData.get('form'), null)
		if (!form?.slug) {
			return NextResponse.json({ message: 'Missing slug' }, { status: 400 })
		}

		const mode = parseJsonField<'create' | 'edit'>(formData.get('mode'), 'create')
		const originalSlug = parseJsonField<string | null>(formData.get('originalSlug'), null)
		const coverUrl = parseJsonField<string | null>(formData.get('coverUrl'), null)
		const imageIds = parseJsonField<string[]>(formData.get('imageIds'), [])
		const coverFile = formData.get('cover')
		const images = []

		for (const id of imageIds) {
			const file = formData.get(`image:${id}`)
			if (file instanceof File) {
				images.push({ id, file })
			}
		}

		await saveBlogContent({
			form,
			mode,
			originalSlug,
			cover: coverFile instanceof File ? coverFile : null,
			coverUrl,
			images
		})

		return NextResponse.json({ ok: true, slug: form.slug })
	} catch (error: any) {
		return NextResponse.json({ message: error?.message || 'Failed to save blog' }, { status: 500 })
	}
}
