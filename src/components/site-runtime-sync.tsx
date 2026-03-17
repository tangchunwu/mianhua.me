'use client'

import { useEffect } from 'react'
import { useConfigStore } from '@/app/(home)/stores/config-store'

export function SiteRuntimeSync() {
	const { siteContent, loadRemoteConfig } = useConfigStore()

	useEffect(() => {
		void loadRemoteConfig()
	}, [loadRemoteConfig])

	useEffect(() => {
		if (typeof document === 'undefined') return
		document.title = siteContent.meta.title

		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute('content', siteContent.meta.description)
		}

		let favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']")
		if (!favicon) {
			favicon = document.createElement('link')
			favicon.rel = 'icon'
			document.head.appendChild(favicon)
		}
		favicon.href = siteContent.faviconUrl || '/favicon.png'
	}, [siteContent])

	return null
}
