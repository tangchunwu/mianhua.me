import type { ImageItem } from '../types'

export type PushBlogParams = {
	form: {
		slug: string
		title: string
		md: string
		tags: string[]
		date?: string
		summary?: string
		hidden?: boolean
		category?: string
	}
	cover?: ImageItem | null
	images?: ImageItem[]
	mode?: 'create' | 'edit'
	originalSlug?: string | null
}

export async function pushBlog(params: PushBlogParams): Promise<void> {
	const { form, cover, images, mode = 'create', originalSlug } = params
	if (!form?.slug) throw new Error('缺少 slug')

	const payload = new FormData()
	payload.append('form', JSON.stringify(form))
	payload.append('mode', JSON.stringify(mode))
	payload.append('originalSlug', JSON.stringify(originalSlug ?? null))

	if (cover?.type === 'file') {
		payload.append('cover', cover.file)
		payload.append('coverUrl', JSON.stringify(null))
	} else {
		payload.append('coverUrl', JSON.stringify(cover?.type === 'url' ? cover.url : null))
	}

	const localImages = (images || []).filter((image): image is Extract<ImageItem, { type: 'file' }> => image.type === 'file')
	payload.append('imageIds', JSON.stringify(localImages.map(image => image.id)))
	for (const image of localImages) {
		payload.append(`image:${image.id}`, image.file)
	}

	const res = await fetch('/api/blog/save', {
		method: 'POST',
		body: payload
	})

	if (!res.ok) {
		const data = await res.json().catch(() => ({}))
		throw new Error(data?.message || '保存失败')
	}
}
