import type { Share } from '../components/share-card'
import type { LogoItem } from '../components/logo-upload-dialog'
import { createHashedUpload, diffRemovedUrls, saveFormContent, type UploadEntry } from '@/lib/content-client'

export type PushSharesParams = {
	shares: Share[]
	originalShares: Share[]
	logoItems?: Map<string, LogoItem>
}

function collectLogoUrls(shares: Share[]): string[] {
	return shares
		.map(share => share.logo)
		.filter((logo): logo is string => typeof logo === 'string' && logo.startsWith('/images/share/'))
}

export async function pushShares(params: PushSharesParams): Promise<Share[]> {
	const { shares, originalShares, logoItems } = params
	const uploads: UploadEntry[] = []
	let updatedShares = [...shares]
	let uploadIndex = 0

	if (logoItems && logoItems.size > 0) {
		for (const [url, logoItem] of logoItems.entries()) {
			if (logoItem.type !== 'file') continue
			const upload = await createHashedUpload(logoItem.file, '/images/share', `upload:${uploadIndex++}`)
			uploads.push(upload)
			updatedShares = updatedShares.map(share => (share.url === url ? { ...share, logo: upload.url } : share))
		}
	}

	const removedUrls = diffRemovedUrls(collectLogoUrls(originalShares), collectLogoUrls(updatedShares))
	return saveFormContent<Share[]>('share', updatedShares, uploads, removedUrls)
}
