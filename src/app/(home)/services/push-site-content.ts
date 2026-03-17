import { toast } from 'sonner'
import type { SiteContent, CardStyles } from '../stores/config-store'
import type { FileItem, ArtImageUploads, SocialButtonImageUploads, BackgroundImageUploads } from '../config-dialog/site-settings'

type ArtImageConfig = SiteContent['artImages'][number]
type BackgroundImageConfig = SiteContent['backgroundImages'][number]

export async function pushSiteContent(
	siteContent: SiteContent,
	cardStyles: CardStyles,
	faviconItem?: FileItem | null,
	avatarItem?: FileItem | null,
	artImageUploads?: ArtImageUploads,
	removedArtImages?: ArtImageConfig[],
	backgroundImageUploads?: BackgroundImageUploads,
	removedBackgroundImages?: BackgroundImageConfig[],
	socialButtonImageUploads?: SocialButtonImageUploads
): Promise<{ siteContent: SiteContent; cardStyles: CardStyles }> {
	const form = new FormData()
	form.append('siteContent', JSON.stringify(siteContent))
	form.append('cardStyles', JSON.stringify(cardStyles))
	form.append('removedArtImages', JSON.stringify(removedArtImages ?? []))
	form.append('removedBackgroundImages', JSON.stringify(removedBackgroundImages ?? []))

	if (faviconItem?.type === 'file') {
		form.append('favicon', faviconItem.file)
	}
	if (avatarItem?.type === 'file') {
		form.append('avatar', avatarItem.file)
	}

	if (artImageUploads) {
		for (const [id, item] of Object.entries(artImageUploads)) {
			if (item.type === 'file') {
				form.append(`art:${id}`, item.file)
			}
		}
	}

	if (backgroundImageUploads) {
		for (const [id, item] of Object.entries(backgroundImageUploads)) {
			if (item.type === 'file') {
				form.append(`background:${id}`, item.file)
			}
		}
	}

	if (socialButtonImageUploads) {
		for (const [id, item] of Object.entries(socialButtonImageUploads)) {
			if (item.type === 'file') {
				form.append(`social:${id}`, item.file)
			}
		}
	}

	toast.info('正在保存...')
	const res = await fetch('/api/config', {
		method: 'POST',
		body: form
	})

	if (!res.ok) {
		let message = '保存失败'
		try {
			const data = await res.json()
			message = data?.message || message
		} catch {
			// ignore parse failures
		}
		throw new Error(message)
	}

	const data = await res.json().catch(() => ({}))
	toast.success('保存成功')
	return {
		siteContent: (data?.siteContent ?? siteContent) as SiteContent,
		cardStyles: (data?.cardStyles ?? cardStyles) as CardStyles
	}
}

