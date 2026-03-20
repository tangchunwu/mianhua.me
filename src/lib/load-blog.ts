import type { BlogConfig } from '@/app/blog/types'

export type { BlogConfig } from '@/app/blog/types'

export type LoadedBlog = {
	slug: string
	config: BlogConfig
	markdown: string
	cover?: string
}

/**
 * Load blog data from public/blogs/{slug}
 * Used by both view page and edit page
 */
export async function loadBlog(slug: string): Promise<LoadedBlog> {
	if (!slug) {
		throw new Error('Slug is required')
	}

	const res = await fetch(`/api/blog/read/${encodeURIComponent(slug)}`, {
		cache: 'no-store'
	})
	if (!res.ok) {
		const data = await res.json().catch(() => ({}))
		throw new Error(data?.message || 'Blog not found')
	}

	return res.json()
}
