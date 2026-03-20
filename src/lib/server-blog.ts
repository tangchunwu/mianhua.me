import path from 'node:path'
import fs from 'node:fs/promises'
import defaultBlogIndex from '@/../public/blogs/index.json'
import defaultCategories from '@/../public/blogs/categories.json'
import type { BlogConfig, BlogIndexItem } from '@/app/blog/types'
import { storeImageFile } from '@/lib/server-image-host'
import { normalizeExternalUrl } from '@/lib/url-utils'

const publicDir = path.join(process.cwd(), 'public')
const blogsDir = path.join(publicDir, 'blogs')
const blogsIndexPath = path.join(blogsDir, 'index.json')
const blogCategoriesPath = path.join(blogsDir, 'categories.json')

async function ensureBlogsDir(): Promise<void> {
	await fs.mkdir(blogsDir, { recursive: true })
}

async function readJsonOrDefault<T>(filePath: string, fallback: T): Promise<T> {
	try {
		const raw = await fs.readFile(filePath, 'utf8')
		return JSON.parse(raw) as T
	} catch {
		return fallback
	}
}

function toLocalBlogUrl(slug: string, filename: string): string {
	return `/blogs/${slug}/${filename}`
}

function getBlogDir(slug: string): string {
	return path.join(blogsDir, slug)
}

function normalizeTags(tags?: string[]): string[] {
	return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean) : []
}

function parseBlogLocalUrls(markdown: string, slug: string): string[] {
	const localPrefix = `/blogs/${slug}/`
	const urls = new Set<string>()
	const regex = /!\[[^\]]*\]\((.*?)\)/g
	let match: RegExpExecArray | null
	while ((match = regex.exec(markdown)) !== null) {
		const url = match[1]
		if (typeof url === 'string' && url.startsWith(localPrefix)) {
			urls.add(url)
		}
	}
	return Array.from(urls)
}

function getLocalCoverUrl(cover: string | undefined, slug: string): string | null {
	if (!cover) return null
	const localPrefix = `/blogs/${slug}/`
	return cover.startsWith(localPrefix) ? cover : null
}

function publicUrlToFilePath(url: string): string {
	return path.join(publicDir, url.replace(/^\//, ''))
}

export async function readBlogIndex(): Promise<BlogIndexItem[]> {
	await ensureBlogsDir()
	return readJsonOrDefault(blogsIndexPath, defaultBlogIndex as BlogIndexItem[])
}

export async function writeBlogIndex(items: BlogIndexItem[]): Promise<void> {
	await ensureBlogsDir()
	const sorted = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
	await fs.writeFile(blogsIndexPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
}

export async function readBlogCategories(): Promise<string[]> {
	await ensureBlogsDir()
	const data = await readJsonOrDefault(blogCategoriesPath, defaultCategories as { categories: string[] })
	return Array.isArray(data?.categories) ? data.categories : []
}

export async function writeBlogCategories(categories: string[]): Promise<void> {
	await ensureBlogsDir()
	const normalized = Array.from(new Set(categories.map(item => item.trim()).filter(Boolean)))
	await fs.writeFile(blogCategoriesPath, `${JSON.stringify({ categories: normalized }, null, 2)}\n`, 'utf8')
}

export async function deleteBlogDirectory(slug: string): Promise<void> {
	if (!slug) return
	await fs.rm(getBlogDir(slug), { recursive: true, force: true })
}

type SaveBlogInput = {
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
	mode?: 'create' | 'edit'
	originalSlug?: string | null
	cover?: File | null
	coverUrl?: string | null
	images?: Array<{ id: string; file: File }>
}

export async function saveBlogContent(input: SaveBlogInput): Promise<void> {
	const { form, mode = 'create', originalSlug, cover, coverUrl, images = [] } = input
	if (!form.slug) throw new Error('Missing slug')
	if (mode === 'edit' && originalSlug && originalSlug !== form.slug) {
		throw new Error('Editing does not support changing slug yet')
	}

	await ensureBlogsDir()
	const slug = form.slug
	const blogDir = getBlogDir(slug)
	await fs.mkdir(blogDir, { recursive: true })

	const existingConfig = await readJsonOrDefault<BlogConfig>(path.join(blogDir, 'config.json'), {})
	const existingMarkdown = await fs.readFile(path.join(blogDir, 'index.md'), 'utf8').catch(() => '')
	const previousLocalUrls = new Set<string>([
		...parseBlogLocalUrls(existingMarkdown, slug),
		...([getLocalCoverUrl(existingConfig.cover, slug)].filter(Boolean) as string[])
	])

	let markdownToSave = form.md
	let nextCover = normalizeExternalUrl(coverUrl || '')

	for (const image of images) {
		const extension = path.extname(image.file.name) || '.png'
		const filename = `${image.id}${extension}`
		const localUrl = toLocalBlogUrl(slug, filename)
		const url = await storeImageFile(image.file, { localUrlPath: localUrl, folder: `blogs/${slug}` })
		markdownToSave = markdownToSave.split(`(local-image:${image.id})`).join(`(${url})`)
	}

	if (cover) {
		const extension = path.extname(cover.name) || '.png'
		const filename = `cover-${Date.now()}${extension}`
		const localUrl = toLocalBlogUrl(slug, filename)
		nextCover = await storeImageFile(cover, { localUrlPath: localUrl, folder: `blogs/${slug}` })
	}

	const config: BlogConfig = {
		title: form.title,
		tags: normalizeTags(form.tags),
		date: form.date,
		summary: form.summary,
		cover: nextCover || undefined,
		hidden: !!form.hidden,
		category: form.category?.trim() || undefined
	}

	await fs.writeFile(path.join(blogDir, 'index.md'), markdownToSave, 'utf8')
	await fs.writeFile(path.join(blogDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8')

	const currentLocalUrls = new Set<string>([
		...parseBlogLocalUrls(markdownToSave, slug),
		...([getLocalCoverUrl(config.cover, slug)].filter(Boolean) as string[])
	])

	for (const url of previousLocalUrls) {
		if (currentLocalUrls.has(url)) continue
		const filePath = publicUrlToFilePath(url)
		await fs.unlink(filePath).catch(() => void 0)
	}

	const index = await readBlogIndex()
	const item: BlogIndexItem = {
		slug,
		title: form.title,
		tags: normalizeTags(form.tags),
		date: form.date || new Date().toISOString(),
		summary: form.summary,
		cover: config.cover,
		hidden: !!form.hidden,
		category: config.category
	}

	const nextIndex = index.filter(entry => entry.slug !== slug)
	nextIndex.push(item)
	await writeBlogIndex(nextIndex)

	const categories = await readBlogCategories()
	const nextCategories = [...categories]
	if (config.category && !nextCategories.includes(config.category)) {
		nextCategories.push(config.category)
	}
	await writeBlogCategories(nextCategories)
}

export async function removeBlog(slug: string): Promise<void> {
	if (!slug) throw new Error('Missing slug')
	await deleteBlogDirectory(slug)
	const index = await readBlogIndex()
	const nextIndex = index.filter(item => item.slug !== slug)
	await writeBlogIndex(nextIndex)
	const categories = await readBlogCategories()
	const usedCategories = new Set(nextIndex.map(item => item.category).filter((item): item is string => !!item))
	await writeBlogCategories(categories.filter(category => usedCategories.has(category)))
}

export async function readPublishedBlog(slug: string): Promise<{ slug: string; config: BlogConfig; markdown: string; cover?: string }> {
	if (!slug) {
		throw new Error('Missing slug')
	}

	await ensureBlogsDir()
	const blogDir = getBlogDir(slug)
	const config = await readJsonOrDefault<BlogConfig>(path.join(blogDir, 'config.json'), {})
	const markdown = await fs.readFile(path.join(blogDir, 'index.md'), 'utf8').catch(() => {
		throw new Error('Blog not found')
	})

	return {
		slug,
		config,
		markdown,
		cover: config.cover
	}
}

export async function saveBlogListing(nextItems: BlogIndexItem[], categories: string[]): Promise<void> {
	const previousItems = await readBlogIndex()
	const previousSlugs = new Set(previousItems.map(item => item.slug))
	const nextSlugs = new Set(nextItems.map(item => item.slug))

	for (const slug of previousSlugs) {
		if (!nextSlugs.has(slug)) {
			await deleteBlogDirectory(slug)
		}
	}

	await writeBlogIndex(nextItems)
	await writeBlogCategories(categories)
}

