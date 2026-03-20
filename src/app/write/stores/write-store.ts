import { create } from 'zustand'
import { toast } from 'sonner'
import { hashFileSHA256 } from '@/lib/file-utils'
import { loadBlog } from '@/lib/load-blog'
import { normalizeExternalUrl } from '@/lib/url-utils'
import type { PublishForm, ImageItem } from '../types'

export const formatDateTimeLocal = (date: Date = new Date()): string => {
	const pad = (n: number) => String(n).padStart(2, '0')
	const year = date.getFullYear()
	const month = pad(date.getMonth() + 1)
	const day = pad(date.getDate())
	const hours = pad(date.getHours())
	const minutes = pad(date.getMinutes())
	return `${year}-${month}-${day}T${hours}:${minutes}`
}

type WriteStore = {
	mode: 'create' | 'edit'
	originalSlug: string | null
	setMode: (mode: 'create' | 'edit', originalSlug?: string) => void

	form: PublishForm
	updateForm: (updates: Partial<PublishForm>) => void
	setForm: (form: PublishForm) => void

	images: ImageItem[]
	addUrlImage: (url: string) => ImageItem | null
	addFiles: (files: FileList | File[]) => Promise<ImageItem[]>
	deleteImage: (id: string) => void

	cover: ImageItem | null
	setCover: (cover: ImageItem | null) => void

	loading: boolean
	setLoading: (loading: boolean) => void

	loadBlogForEdit: (slug: string) => Promise<void>
	reset: () => void
}

const initialForm: PublishForm = {
	slug: '',
	title: '',
	md: '',
	tags: [],
	date: formatDateTimeLocal(),
	summary: '',
	hidden: false,
	category: ''
}

export const useWriteStore = create<WriteStore>((set, get) => ({
	mode: 'create',
	originalSlug: null,
	setMode: (mode, originalSlug) => set({ mode, originalSlug: originalSlug || null }),

	form: { ...initialForm },
	updateForm: updates => set(state => ({ form: { ...state.form, ...updates } })),
	setForm: form => set({ form }),

	images: [],
	addUrlImage: url => {
		const normalizedUrl = normalizeExternalUrl(url)
		if (!normalizedUrl) {
			toast.error('请输入有效的图片地址')
			return null
		}

		const { images } = get()
		const existingItem = images.find(it => it.type === 'url' && it.url === normalizedUrl) || null
		if (existingItem) {
			toast.info('该图片已在列表中')
			return existingItem
		}

		const item: ImageItem = {
			id: Math.random().toString(36).slice(2, 10),
			type: 'url',
			url: normalizedUrl
		}

		set(state => ({ images: [item, ...state.images] }))
		return item
	},
	addFiles: async (files: FileList | File[]) => {
		const { images } = get()
		const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
		if (arr.length === 0) return []

		const existingHashes = new Map<string, ImageItem>(
			images
				.filter((it): it is Extract<ImageItem, { type: 'file'; hash?: string }> => it.type === 'file' && 'hash' in it && !!it.hash)
				.map(it => [it.hash as string, it])
		)

		const computed = await Promise.all(
			arr.map(async file => {
				const hash = await hashFileSHA256(file)
				return { file, hash }
			})
		)

		const seen = new Set<string>()
		const unique = computed.filter(({ hash }) => {
			if (existingHashes.has(hash)) return false
			if (seen.has(hash)) return false
			seen.add(hash)
			return true
		})

		const resultImages: ImageItem[] = []

		for (const { hash } of computed) {
			if (existingHashes.has(hash)) {
				resultImages.push(existingHashes.get(hash)!)
			}
		}

		if (unique.length > 0) {
			const newItems: ImageItem[] = unique.map(({ file, hash }) => {
				const id = Math.random().toString(36).slice(2, 10)
				const previewUrl = URL.createObjectURL(file)
				return { id, type: 'file', file, previewUrl, filename: file.name, hash }
			})

			set(state => ({ images: [...newItems, ...state.images] }))
			resultImages.push(...newItems)
		} else if (resultImages.length === 0) {
			toast.info('图片已存在，不重复添加')
		}

		return resultImages
	},
	deleteImage: id =>
		set(state => {
			for (const it of state.images) {
				if (it.type === 'file' && it.id === id) {
					URL.revokeObjectURL(it.previewUrl)
					if (it.id === state.cover?.id) {
						set({ cover: null })
					}
				}
			}

			return { images: state.images.filter(it => it.id !== id) }
		}),

	cover: null,
	setCover: cover => set({ cover }),

	loading: false,
	setLoading: loading => set({ loading }),

	loadBlogForEdit: async (slug: string) => {
		try {
			set({ loading: true })
			const blog = await loadBlog(slug)

			const images: ImageItem[] = []
			const imageRegex = /!\[.*?\]\((.*?)\)/g
			let match: RegExpExecArray | null
			while ((match = imageRegex.exec(blog.markdown)) !== null) {
				const url = match[1]
				if (url && url !== blog.cover && !url.startsWith('local-image:')) {
					if (!images.some(img => img.type === 'url' && img.url === url)) {
						images.push({
							id: Math.random().toString(36).slice(2, 10),
							type: 'url',
							url
						})
					}
				}
			}

			let cover: ImageItem | null = null
			if (blog.cover) {
				cover = {
					id: Math.random().toString(36).slice(2, 10),
					type: 'url',
					url: blog.cover
				}
			}

			set({
				mode: 'edit',
				originalSlug: slug,
				form: {
					slug,
					title: blog.config.title || '',
					md: blog.markdown,
					tags: blog.config.tags || [],
					date: blog.config.date ? formatDateTimeLocal(new Date(blog.config.date)) : formatDateTimeLocal(),
					summary: blog.config.summary || '',
					hidden: blog.config.hidden || false,
					category: blog.config.category || ''
				},
				images,
				cover,
				loading: false
			})

			toast.success('博客加载成功')
		} catch (err: any) {
			console.error('Failed to load blog:', err)
			toast.error(err?.message || '加载博客失败')
			set({ loading: false })
			throw err
		}
	},

	reset: () => {
		const { images, cover } = get()
		for (const img of images) {
			if (img.type === 'file') {
				URL.revokeObjectURL(img.previewUrl)
			}
		}
		if (cover?.type === 'file') {
			URL.revokeObjectURL(cover.previewUrl)
		}

		set({
			mode: 'create',
			originalSlug: null,
			form: { ...initialForm, date: formatDateTimeLocal() },
			images: [],
			cover: null
		})
	}
}))
