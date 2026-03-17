import type { Blogger } from '../grid-view'
import type { AvatarItem } from '../components/avatar-upload-dialog'
import { createHashedUpload, diffRemovedUrls, saveFormContent, type UploadEntry } from '@/lib/content-client'

export type PushBloggersParams = {
	bloggers: Blogger[]
	originalBloggers: Blogger[]
	avatarItems?: Map<string, AvatarItem>
}

function collectAvatarUrls(bloggers: Blogger[]): string[] {
	return bloggers
		.map(blogger => blogger.avatar)
		.filter((avatar): avatar is string => typeof avatar === 'string' && avatar.startsWith('/images/blogger/'))
}

export async function pushBloggers(params: PushBloggersParams): Promise<Blogger[]> {
	const { bloggers, originalBloggers, avatarItems } = params
	const uploads: UploadEntry[] = []
	let updatedBloggers = [...bloggers]
	let uploadIndex = 0

	if (avatarItems && avatarItems.size > 0) {
		for (const [url, avatarItem] of avatarItems.entries()) {
			if (avatarItem.type !== 'file') continue
			const upload = await createHashedUpload(avatarItem.file, '/images/blogger', `upload:${uploadIndex++}`)
			uploads.push(upload)
			updatedBloggers = updatedBloggers.map(blogger => (blogger.url === url ? { ...blogger, avatar: upload.url } : blogger))
		}
	}

	const removedUrls = diffRemovedUrls(collectAvatarUrls(originalBloggers), collectAvatarUrls(updatedBloggers))
	return saveFormContent<Blogger[]>('bloggers', updatedBloggers, uploads, removedUrls)
}
