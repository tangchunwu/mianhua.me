'use client'

import { toast } from 'sonner'
import { openAdminAuthDialog } from '@/stores/admin-auth-dialog-store'

async function hasActiveAdminSession(): Promise<boolean> {
	try {
		const res = await fetch('/api/admin/status', { cache: 'no-store' })
		if (!res.ok) return false
		const data = await res.json().catch(() => ({}))
		return !!data?.authenticated
	} catch {
		return false
	}
}

export async function ensureAdminAuth(isAuth: boolean, loginWithPassword: (password: string) => Promise<void>): Promise<boolean> {
	if (isAuth && (await hasActiveAdminSession())) return true

	const password = await openAdminAuthDialog()
	if (!password) return false
	if (password === '__AUTHED__') return hasActiveAdminSession()

	try {
		await loginWithPassword(password)
		return true
	} catch (error: any) {
		toast.error(error?.message || '登录失败')
		return false
	}
}
