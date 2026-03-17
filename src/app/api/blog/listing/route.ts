import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { saveBlogListing } from '@/lib/server-blog'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
	}

	try {
		const { items, categories } = await req.json()
		if (!Array.isArray(items) || !Array.isArray(categories)) {
			return NextResponse.json({ message: 'Invalid payload' }, { status: 400 })
		}
		await saveBlogListing(items, categories)
		return NextResponse.json({ ok: true })
	} catch (error: any) {
		return NextResponse.json({ message: error?.message || 'Failed to save listing' }, { status: 500 })
	}
}
