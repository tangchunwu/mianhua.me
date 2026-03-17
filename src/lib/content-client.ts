'use client'

import { getFileExt } from '@/lib/utils'
import { hashFileSHA256 } from '@/lib/file-utils'

export type UploadEntry = {
	field: string
	url: string
	file: File
}

export async function loadServerContent<T>(key: string): Promise<T> {
	const res = await fetch(`/api/content/${key}`, { cache: 'no-store' })
	if (!res.ok) {
		const data = await res.json().catch(() => ({}))
		throw new Error(data?.message || '加载内容失败')
	}
	const data = await res.json()
	return data.data as T
}

export async function saveJsonContent<T = unknown>(key: string, data: unknown): Promise<T> {
	const res = await fetch(`/api/content/${key}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ data })
	})
	if (!res.ok) {
		const body = await res.json().catch(() => ({}))
		throw new Error(body?.message || '保存失败')
	}
	const body = await res.json().catch(() => ({}))
	return (body?.data ?? data) as T
}

export async function saveFormContent<T = unknown>(key: string, data: unknown, uploads: UploadEntry[], removedUrls: string[] = []): Promise<T> {
	const form = new FormData()
	form.append('data', JSON.stringify(data))
	form.append('uploads', JSON.stringify(uploads.map(({ field, url }) => ({ field, url }))))
	form.append('removedUrls', JSON.stringify(removedUrls))
	for (const upload of uploads) {
		form.append(upload.field, upload.file)
	}

	const res = await fetch(`/api/content/${key}`, {
		method: 'POST',
		body: form
	})
	if (!res.ok) {
		const body = await res.json().catch(() => ({}))
		throw new Error(body?.message || '保存失败')
	}
	const body = await res.json().catch(() => ({}))
	return (body?.data ?? data) as T
}

export async function createHashedUpload(file: File, directory: string, field: string): Promise<UploadEntry> {
	const hash = await hashFileSHA256(file)
	const ext = getFileExt(file.name)
	return {
		field,
		url: `${directory}/${hash}${ext}`,
		file
	}
}

export function diffRemovedUrls(previousUrls: string[], nextUrls: string[]): string[] {
	const nextSet = new Set(nextUrls)
	return previousUrls.filter(url => !nextSet.has(url))
}

