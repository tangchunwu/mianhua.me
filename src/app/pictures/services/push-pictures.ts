import type { ImageItem } from '../../projects/components/image-upload-dialog'
import type { Picture } from '../page'
import { createHashedUpload, diffRemovedUrls, saveFormContent, type UploadEntry } from '@/lib/content-client'

export type PushPicturesParams = {
	pictures: Picture[]
	originalPictures: Picture[]
	imageItems?: Map<string, ImageItem>
}

function collectPictureUrls(pictures: Picture[]): string[] {
	const urls: string[] = []
	for (const picture of pictures) {
		if (picture.image?.startsWith('/images/pictures/')) {
			urls.push(picture.image)
		}
		if (Array.isArray(picture.images)) {
			for (const image of picture.images) {
				if (typeof image === 'string' && image.startsWith('/images/pictures/')) {
					urls.push(image)
				}
			}
		}
	}
	return urls
}

export async function pushPictures(params: PushPicturesParams): Promise<Picture[]> {
	const { pictures, originalPictures, imageItems } = params
	const uploads: UploadEntry[] = []
	let updatedPictures = [...pictures]
	let uploadIndex = 0

	if (imageItems && imageItems.size > 0) {
		for (const [key, imageItem] of imageItems.entries()) {
			if (imageItem.type !== 'file') continue
			const upload = await createHashedUpload(imageItem.file, '/images/pictures', `upload:${uploadIndex++}`)
			uploads.push(upload)

			const [groupId, indexStr] = key.split('::')
			const imageIndex = Number(indexStr) || 0
			updatedPictures = updatedPictures.map(picture => {
				if (picture.id !== groupId) return picture
				const currentImages = picture.images && picture.images.length > 0 ? picture.images : picture.image ? [picture.image] : []
				const nextImages = currentImages.map((image, index) => (index === imageIndex ? upload.url : image))
				return {
					...picture,
					image: undefined,
					images: nextImages
				}
			})
		}
	}

	const removedUrls = diffRemovedUrls(collectPictureUrls(originalPictures), collectPictureUrls(updatedPictures))
	return saveFormContent<Picture[]>('pictures', updatedPictures, uploads, removedUrls)
}
