import path from 'node:path'
import fs from 'node:fs/promises'
import defaultSiteContent from '@/config/site-content.json'
import defaultCardStyles from '@/config/card-styles.json'
import defaultAbout from '@/app/about/list.json'
import defaultProjects from '@/app/projects/list.json'
import defaultPictures from '@/app/pictures/list.json'
import defaultSnippets from '@/app/snippets/list.json'
import defaultBloggers from '@/app/bloggers/list.json'
import defaultShares from '@/app/share/list.json'

const dataDir = path.join(process.cwd(), 'data')
const siteContentPath = path.join(dataDir, 'site-content.json')
const cardStylesPath = path.join(dataDir, 'card-styles.json')
const contentFileMap = {
	about: 'about.json',
	projects: 'projects.json',
	pictures: 'pictures.json',
	snippets: 'snippets.json',
	bloggers: 'bloggers.json',
	share: 'share.json'
} as const
const contentDefaults = {
	about: defaultAbout,
	projects: defaultProjects,
	pictures: defaultPictures,
	snippets: defaultSnippets,
	bloggers: defaultBloggers,
	share: defaultShares
} as const

export type ServerContentKey = keyof typeof contentFileMap

async function ensureDataDir(): Promise<void> {
	await fs.mkdir(dataDir, { recursive: true })
}

async function readJsonOrDefault<T>(filePath: string, defaultValue: T): Promise<T> {
	try {
		const raw = await fs.readFile(filePath, 'utf8')
		return JSON.parse(raw) as T
	} catch {
		return defaultValue
	}
}

export async function readServerConfig() {
	await ensureDataDir()
	const siteContent = await readJsonOrDefault(siteContentPath, defaultSiteContent)
	const cardStyles = await readJsonOrDefault(cardStylesPath, defaultCardStyles)
	return { siteContent, cardStyles }
}

export async function writeServerConfig(siteContent: unknown, cardStyles: unknown): Promise<void> {
	await ensureDataDir()
	await fs.writeFile(siteContentPath, `${JSON.stringify(siteContent, null, '\t')}\n`, 'utf8')
	await fs.writeFile(cardStylesPath, `${JSON.stringify(cardStyles, null, '\t')}\n`, 'utf8')
}

function getContentFilePath(key: ServerContentKey): string {
	return path.join(dataDir, contentFileMap[key])
}

export function isServerContentKey(value: string): value is ServerContentKey {
	return value in contentFileMap
}

export async function readServerContent<T>(key: ServerContentKey): Promise<T> {
	await ensureDataDir()
	return readJsonOrDefault(getContentFilePath(key), contentDefaults[key] as T)
}

export async function writeServerContent(key: ServerContentKey, value: unknown): Promise<void> {
	await ensureDataDir()
	await fs.writeFile(getContentFilePath(key), `${JSON.stringify(value, null, '\t')}\n`, 'utf8')
}

export function resolvePublicPathFromUrl(urlPath: string): string | null {
	if (!urlPath || !urlPath.startsWith('/')) return null
	if (urlPath.includes('..')) return null
	return path.join(process.cwd(), 'public', urlPath.slice(1))
}

export async function writePublicFileFromBlob(urlPath: string, file: File): Promise<void> {
	const dest = resolvePublicPathFromUrl(urlPath)
	if (!dest) return
	await fs.mkdir(path.dirname(dest), { recursive: true })
	const buf = Buffer.from(await file.arrayBuffer())
	await fs.writeFile(dest, buf)
}

export async function removePublicFileByUrl(urlPath: string): Promise<void> {
	const dest = resolvePublicPathFromUrl(urlPath)
	if (!dest) return
	try {
		await fs.unlink(dest)
	} catch {
		// ignore missing files
	}
}
