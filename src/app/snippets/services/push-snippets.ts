import { saveJsonContent } from '@/lib/content-client'

export type PushSnippetsParams = {
	snippets: string[]
}

export async function pushSnippets(params: PushSnippetsParams): Promise<void> {
	await saveJsonContent('snippets', params.snippets)
}
