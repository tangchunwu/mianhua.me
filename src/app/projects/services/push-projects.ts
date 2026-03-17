import type { Project } from '../components/project-card'
import type { ImageItem } from '../components/image-upload-dialog'
import { createHashedUpload, diffRemovedUrls, saveFormContent, type UploadEntry } from '@/lib/content-client'

export type PushProjectsParams = {
	projects: Project[]
	originalProjects: Project[]
	imageItems?: Map<string, ImageItem>
}

function collectProjectImageUrls(projects: Project[]): string[] {
	return projects
		.map(project => project.image)
		.filter((image): image is string => typeof image === 'string' && image.startsWith('/images/project/'))
}

export async function pushProjects(params: PushProjectsParams): Promise<Project[]> {
	const { projects, originalProjects, imageItems } = params
	const uploads: UploadEntry[] = []
	let updatedProjects = [...projects]
	let uploadIndex = 0

	if (imageItems && imageItems.size > 0) {
		for (const [url, imageItem] of imageItems.entries()) {
			if (imageItem.type !== 'file') continue
			const upload = await createHashedUpload(imageItem.file, '/images/project', `upload:${uploadIndex++}`)
			uploads.push(upload)
			updatedProjects = updatedProjects.map(project => (project.url === url ? { ...project, image: upload.url } : project))
		}
	}

	const removedUrls = diffRemovedUrls(collectProjectImageUrls(originalProjects), collectProjectImageUrls(updatedProjects))
	return saveFormContent<Project[]>('projects', updatedProjects, uploads, removedUrls)
}
