import { NextResponse } from 'next/server'
import { readPublishedBlog } from '@/lib/server-blog'

export const runtime = 'nodejs'

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
	try {
		const { slug } = await context.params
		const blog = await readPublishedBlog(slug)
		return NextResponse.json(blog)
	} catch (error: any) {
		const message = error?.message || 'Failed to load blog'
		const status = message === 'Blog not found' ? 404 : 500
		return NextResponse.json({ message }, { status })
	}
}
