import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { readServerConfig, removePublicFileByUrl, writeServerConfig } from '@/lib/server-config'
import { storeImageFile } from '@/lib/server-image-host'
import { normalizeSiteContentPayload } from '@/lib/url-utils'

export const runtime = 'nodejs'

function parseJsonField<T>(raw: FormDataEntryValue | null, fallback: T): T {
	if (!raw || typeof raw !== 'string') return fallback
	try {
		return JSON.parse(raw) as T
	} catch {
		return fallback
	}
}

export async function GET() {
	try {
		const data = await readServerConfig()
		return NextResponse.json(data)
	} catch (error: any) {
		return NextResponse.json({ message: error?.message || 'Failed to read config' }, { status: 500 })
	}
}

export async function POST(req: Request) {
	if (!(await isAdminAuthed())) {
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
	}

	try {
		const form = await req.formData()
		const { siteContent: currentSiteContent, cardStyles: currentCardStyles } = await readServerConfig()

		const siteContent = normalizeSiteContentPayload(parseJsonField<any>(form.get('siteContent'), currentSiteContent))
		const cardStyles = parseJsonField<any>(form.get('cardStyles'), currentCardStyles)
		const removedArtImages = parseJsonField<Array<{ url?: string }>>(form.get('removedArtImages'), [])
		const removedBackgroundImages = parseJsonField<Array<{ url?: string }>>(form.get('removedBackgroundImages'), [])

		const favicon = form.get('favicon')
		if (favicon instanceof File) {
			siteContent.faviconUrl = await storeImageFile(favicon, { localUrlPath: '/favicon.png', folder: 'site' })
		}

		const avatar = form.get('avatar')
		if (avatar instanceof File) {
			siteContent.avatarUrl = await storeImageFile(avatar, { localUrlPath: '/images/avatar.png', folder: 'site' })
		}

		const artImages = Array.isArray(siteContent?.artImages) ? siteContent.artImages : []
		for (const art of artImages) {
			if (!art?.id || !art?.url) continue
			const artFile = form.get(`art:${art.id}`)
			if (artFile instanceof File) {
				art.url = await storeImageFile(artFile, { localUrlPath: art.url, folder: 'art' })
			}
		}

		const backgrounds = Array.isArray(siteContent?.backgroundImages) ? siteContent.backgroundImages : []
		for (const bg of backgrounds) {
			if (!bg?.id || !bg?.url) continue
			const bgFile = form.get(`background:${bg.id}`)
			if (bgFile instanceof File) {
				bg.url = await storeImageFile(bgFile, { localUrlPath: bg.url, folder: 'background' })
			}
		}

		const socialButtons = Array.isArray(siteContent?.socialButtons) ? siteContent.socialButtons : []
		for (const btn of socialButtons) {
			if (!btn?.id) continue
			const btnFile = form.get(`social:${btn.id}`)
			if (btnFile instanceof File) {
				const fallbackPath = `/images/social-buttons/${btn.id}.png`
				btn.value = await storeImageFile(btnFile, { localUrlPath: typeof btn.value === 'string' && btn.value ? btn.value : fallbackPath, folder: 'social-buttons' })
			}
		}

		for (const art of removedArtImages) {
			if (art?.url) await removePublicFileByUrl(art.url)
		}

		for (const bg of removedBackgroundImages) {
			if (bg?.url) {
				await removePublicFileByUrl(bg.url)
			}
		}

		await writeServerConfig(siteContent, cardStyles)
		return NextResponse.json({ ok: true, siteContent, cardStyles })
	} catch (error: any) {
		return NextResponse.json({ message: error?.message || 'Failed to save config' }, { status: 500 })
	}
}

