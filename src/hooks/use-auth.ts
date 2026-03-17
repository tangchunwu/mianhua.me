import { create } from 'zustand'
import { clearAllAuthCache, getAuthToken as getToken, getPemFromCache, savePemToCache } from '@/lib/auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'

interface AuthStore {
	isAuth: boolean
	privateKey: string | null
	setPrivateKey: (key: string) => void
	loginWithPassword: (password: string) => Promise<void>
	clearAuth: () => Promise<void>
	refreshAuthState: () => Promise<void>
	getAuthToken: () => Promise<string>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
	isAuth: false,
	privateKey: null,

	setPrivateKey: async (key: string) => {
		set({ isAuth: true, privateKey: key })
		const { siteContent } = useConfigStore.getState()
		if (siteContent?.isCachePem) {
			await savePemToCache(key)
		}
	},

	loginWithPassword: async (password: string) => {
		const res = await fetch('/api/admin/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password })
		})
		if (!res.ok) {
			const data = await res.json().catch(() => ({}))
			throw new Error(data?.message || '管理员登录失败')
		}
		set({ isAuth: true })
	},

	clearAuth: async () => {
		await fetch('/api/admin/logout', { method: 'POST' }).catch(() => void 0)
		clearAllAuthCache()
		set({ isAuth: false, privateKey: null })
	},

	refreshAuthState: async () => {
		try {
			const res = await fetch('/api/admin/status', { cache: 'no-store' })
			const data = await res.json()
			set({ isAuth: !!data?.authenticated })
		} catch {
			set({ isAuth: false })
		}
	},

	getAuthToken: async () => {
		const token = await getToken()
		get().refreshAuthState()
		return token
	}
}))

getPemFromCache().then(key => {
	if (key) {
		useAuthStore.setState({ privateKey: key })
	}
})

useAuthStore.getState().refreshAuthState()

