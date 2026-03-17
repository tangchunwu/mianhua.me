import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { isImageHostConfigured, storeImageFile } from '@/lib/server-image-host'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
	}

	try {
		const form = await req.formData()
		const folder = typeof form.get('folder') === 'string' ? String(form.get('folder')).trim() : undefined
		const files = form
			.getAll('file')
			.concat(form.getAll('files'))
			.filter((entry): entry is File => entry instanceof File)

		if (files.length === 0) {
			return NextResponse.json({ message: 'No files uploaded' }, { status: 400 })
		}

		const uploads = await Promise.all(
			files.map(async file => ({
				name: file.name,
				url: await storeImageFile(file, {
					localUrlPath: `/images/uploads/${Date.now()}-${Math.random().toString(16).slice(2)}-${file.name}`,
					folder
				})
			}))
		)

		return NextResponse.json({ ok: true, data: uploads, hosted: isImageHostConfigured() })
	} catch (error: any) {
		return NextResponse.json({ message: error?.message || 'Failed to upload image' }, { status: 500 })
	}
}
