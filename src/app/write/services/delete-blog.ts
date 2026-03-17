export async function deleteBlog(slug: string): Promise<void> {
	if (!slug) throw new Error('缺少 slug')

	const res = await fetch('/api/blog/delete', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ slug })
	})

	if (!res.ok) {
		const data = await res.json().catch(() => ({}))
		throw new Error(data?.message || '删除失败')
	}
}
