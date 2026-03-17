import { saveJsonContent } from '@/lib/content-client'

export type AboutData = {
	title: string
	description: string
	content: string
}

export async function pushAbout(data: AboutData): Promise<void> {
	await saveJsonContent('about', data)
}
