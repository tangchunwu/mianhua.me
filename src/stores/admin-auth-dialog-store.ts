'use client'

import { create } from 'zustand'

type AdminAuthDialogState = {
	open: boolean
	title: string
	description: string
	submitLabel: string
	cancelLabel: string
}

type Resolver = (value: string | null) => void

let resolver: Resolver | null = null

export const useAdminAuthDialogStore = create<AdminAuthDialogState>(() => ({
	open: false,
	title: '管理员登录',
	description: '输入管理员密码后即可进入编辑模式。',
	submitLabel: '登录',
	cancelLabel: '取消'
}))

export function openAdminAuthDialog(): Promise<string | null> {
	return new Promise(resolve => {
		resolver = resolve
		useAdminAuthDialogStore.setState({
			open: true,
			title: '管理员登录',
			description: '输入管理员密码后即可进入编辑模式。',
			submitLabel: '登录',
			cancelLabel: '取消'
		})
	})
}

export function closeAdminAuthDialog(password: string | null) {
	useAdminAuthDialogStore.setState({ open: false })
	const currentResolver = resolver
	resolver = null
	currentResolver?.(password)
}
