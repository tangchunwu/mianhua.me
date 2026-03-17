import { writePublicFileFromBlob } from '@/lib/server-config'
import { isLocalUrl } from '@/lib/url-utils'

type StoreImageOptions = {
	localUrlPath: string
	folder?: string
}

function getImageHostConfig() {
	const baseUrl = process.env.IMAGE_HOST_BASE_URL?.trim()
	const authCode = process.env.IMAGE_HOST_AUTH_CODE?.trim()
	const enabled = process.env.IMAGE_HOST_ENABLED?.trim() === 'true'
	return { baseUrl, authCode, enabled }
}

export function isImageHostConfigured(): boolean {
	const { baseUrl, authCode, enabled } = getImageHostConfig()
	return !!(enabled && baseUrl && authCode)
}

function resolveFolder(localUrlPath: string, folder?: string): string | undefined {
	if (folder) return folder.replace(/^\/+|\/+$/g, '')
	const trimmed = localUrlPath.replace(/^\/+/, '')
	if (!trimmed) return undefined
	const parts = trimmed.split('/').filter(Boolean)
	if (parts.length <= 1) return 'site'
	parts.pop()
	return parts.join('/')
}

function resolveHostedUrl(baseUrl: string, src: string): string {
	return new URL(src, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
}

export async function uploadImageToHost(file: File, options: StoreImageOptions): Promise<string> {
	const { baseUrl, authCode } = getImageHostConfig()
	if (!baseUrl || !authCode) {
		throw new Error('Image host is not configured')
	}

	const endpoint = new URL('/upload', baseUrl)
	const folder = resolveFolder(options.localUrlPath, options.folder)
	if (folder) {
		endpoint.searchParams.set('uploadFolder', folder)
	}

	const form = new FormData()
	form.append('file', file, file.name)

	const res = await fetch(endpoint, {
		method: 'POST',
		headers: {
			authCode
		},
		body: form,
		signal: AbortSignal.timeout(45_000)
	})

	const payload = await res.json().catch(() => null)
	if (!res.ok) {
		const message = payload?.message || payload?.msg || payload?.error || `Image host upload failed (${res.status})`
		throw new Error(message)
	}

	const src = Array.isArray(payload) ? payload[0]?.src : payload?.data?.[0]?.src || payload?.data?.src || payload?.src
	if (typeof src !== 'string' || !src.trim()) {
		throw new Error('Image host did not return a file URL')
	}

	return resolveHostedUrl(baseUrl, src.trim())
}

export async function storeImageFile(file: File, options: StoreImageOptions): Promise<string> {
	if (isImageHostConfigured()) {
		return uploadImageToHost(file, options)
	}

	if (!isLocalUrl(options.localUrlPath)) {
		throw new Error('Local image path is invalid')
	}

	await writePublicFileFromBlob(options.localUrlPath, file)
	return options.localUrlPath
}
