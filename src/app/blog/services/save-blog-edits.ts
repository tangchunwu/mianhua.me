import type { BlogIndexItem } from '@/lib/blog-index'

export async function saveBlogEdits(_originalItems: BlogIndexItem[], nextItems: BlogIndexItem[], categories: string[]): Promise<void> {
	const res = await fetch('/api/blog/listing', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			items: nextItems,
			categories
		})
	})

	if (!res.ok) {
		const data = await res.json().catch(() => ({}))
		throw new Error(data?.message || '保存失败')
	}
}
