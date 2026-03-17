import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { removeBlog } from '@/lib/server-blog'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
	}

	try {
		const { slug } = await req.json()
		if (!slug) {
			return NextResponse.json({ message: 'Missing slug' }, { status: 400 })
		}
		await removeBlog(slug)
		return NextResponse.json({ ok: true })
	} catch (error: any) {
		return NextResponse.json({ message: error?.message || 'Failed to delete blog' }, { status: 500 })
	}
}
