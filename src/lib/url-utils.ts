const ABSOLUTE_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i
const DOMAIN_LIKE_RE = /^(localhost(?::\d+)?|(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?)(?:[/?#].*)?$/i

export function isRemoteUrl(value: string | null | undefined): boolean {
	return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

export function isLocalUrl(value: string | null | undefined): boolean {
	return typeof value === 'string' && value.trim().startsWith('/')
}

export function normalizeExternalUrl(value: string | null | undefined): string {
	if (typeof value !== 'string') return ''
	const trimmed = value.trim()
	if (!trimmed) return ''
	if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('local-image:')) {
		return trimmed
	}
	if (/^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
		return trimmed
	}
	if (ABSOLUTE_SCHEME_RE.test(trimmed)) {
		return trimmed
	}
	if (DOMAIN_LIKE_RE.test(trimmed)) {
		return `https://${trimmed}`
	}
	return trimmed
}

function normalizeMaybeImageUrl(value: string | null | undefined): string {
	return normalizeExternalUrl(value)
}

export function normalizeSiteContentPayload(input: any) {
	if (!input || typeof input !== 'object') return input

	const siteContent = structuredClone(input)
	siteContent.faviconUrl = normalizeMaybeImageUrl(siteContent.faviconUrl || '/favicon.png') || '/favicon.png'
	siteContent.avatarUrl = normalizeMaybeImageUrl(siteContent.avatarUrl || '/images/avatar.png') || '/images/avatar.png'

	if (Array.isArray(siteContent.artImages)) {
		siteContent.artImages = siteContent.artImages.map((item: any) => ({
			...item,
			url: normalizeMaybeImageUrl(item?.url)
		}))
	}

	if (Array.isArray(siteContent.backgroundImages)) {
		siteContent.backgroundImages = siteContent.backgroundImages.map((item: any) => ({
			...item,
			url: normalizeMaybeImageUrl(item?.url)
		}))
	}

	if (Array.isArray(siteContent.socialButtons)) {
		const externalTypes = new Set(['github', 'juejin', 'link', 'x', 'tg', 'facebook', 'tiktok', 'instagram', 'weibo', 'xiaohongshu', 'zhihu', 'bilibili'])
		siteContent.socialButtons = siteContent.socialButtons.map((button: any) => {
			if (!button || typeof button !== 'object') return button
			let value = typeof button.value === 'string' ? button.value.trim() : button.value
			if (externalTypes.has(button.type)) {
				value = normalizeExternalUrl(value)
			} else if ((button.type === 'wechat' || button.type === 'qq') && typeof value === 'string' && (value.includes('/') || value.includes('.') || value.startsWith('http'))) {
				value = normalizeMaybeImageUrl(value)
			}
			return { ...button, value }
		})
	}

	if (siteContent.beian && typeof siteContent.beian === 'object') {
		siteContent.beian = {
			...siteContent.beian,
			link: normalizeExternalUrl(siteContent.beian.link)
		}
	}

	return siteContent
}

export function normalizeContentPayload(key: string, input: any) {
	if (!Array.isArray(input)) return input

	switch (key) {
		case 'projects':
			return input.map(item => ({
				...item,
				image: normalizeMaybeImageUrl(item?.image),
				url: normalizeExternalUrl(item?.url),
				github: item?.github ? normalizeExternalUrl(item.github) : undefined,
				npm: item?.npm ? normalizeExternalUrl(item.npm) : undefined
			}))
		case 'bloggers':
			return input.map(item => ({
				...item,
				avatar: normalizeMaybeImageUrl(item?.avatar),
				url: normalizeExternalUrl(item?.url)
			}))
		case 'share':
			return input.map(item => ({
				...item,
				logo: normalizeMaybeImageUrl(item?.logo),
				url: normalizeExternalUrl(item?.url)
			}))
		case 'pictures':
			return input.map(item => ({
				...item,
				image: item?.image ? normalizeMaybeImageUrl(item.image) : item?.image,
				images: Array.isArray(item?.images) ? item.images.map((url: string) => normalizeMaybeImageUrl(url)) : item?.images
			}))
		default:
			return input
	}
}

export function replaceStringValues<T>(input: T, replacements: Map<string, string>): T {
	if (replacements.size === 0) return input
	if (typeof input === 'string') {
		return (replacements.get(input) ?? input) as T
	}
	if (Array.isArray(input)) {
		return input.map(item => replaceStringValues(item, replacements)) as T
	}
	if (input && typeof input === 'object') {
		return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, replaceStringValues(value, replacements)])) as T
	}
	return input
}
