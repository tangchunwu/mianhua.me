'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { DialogModal } from '@/components/dialog-modal'
import { useAuthStore } from '@/hooks/use-auth'
import { closeAdminAuthDialog, useAdminAuthDialogStore } from '@/stores/admin-auth-dialog-store'

export function AdminAuthDialog() {
	const inputRef = useRef<HTMLInputElement>(null)
	const { isAuth, loginWithPassword } = useAuthStore()
	const { open, title, description, submitLabel, cancelLabel } = useAdminAuthDialogStore()
	const [password, setPassword] = useState('')
	const [submitting, setSubmitting] = useState(false)

	useEffect(() => {
		if (!open) {
			setPassword('')
			setSubmitting(false)
			return
		}

		const timer = window.setTimeout(() => inputRef.current?.focus(), 80)
		return () => window.clearTimeout(timer)
	}, [open])

	useEffect(() => {
		if (open && isAuth) {
			closeAdminAuthDialog('__AUTHED__')
		}
	}, [open, isAuth])

	const strengthHint = useMemo(() => {
		if (password.length === 0) return '仅管理员可用'
		if (password.length < 6) return '密码输入中'
		return '准备验证'
	}, [password.length])

	const handleClose = () => {
		if (submitting) return
		closeAdminAuthDialog(null)
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!password.trim()) {
			toast.error('请输入管理员密码')
			return
		}

		try {
			setSubmitting(true)
			await loginWithPassword(password)
			toast.success('管理员登录成功')
			closeAdminAuthDialog('__AUTHED__')
		} catch (error: any) {
			console.error('Admin login failed:', error)
			toast.error(error?.message || '登录失败')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<DialogModal open={open} onClose={handleClose} className='w-full max-w-[420px]' disableCloseOnOverlay={submitting}>
			<div className='card relative overflow-hidden p-0'>
				<div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(252,200,65,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(222,67,49,0.18),transparent_36%)]' />
				<div className='relative border-b border-white/60 px-6 pt-6 pb-5'>
					<div className='mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/70 shadow-[0_10px_30px_rgba(222,67,49,0.12)] backdrop-blur'>
						<ShieldCheck className='text-brand h-6 w-6' />
					</div>
					<h2 className='text-primary text-2xl font-semibold'>{title}</h2>
					<p className='text-secondary mt-2 text-sm leading-6'>{description}</p>
				</div>

				<form onSubmit={handleSubmit} className='relative space-y-5 px-6 pt-5 pb-6'>
					<div className='rounded-2xl border border-white/70 bg-white/65 p-4 backdrop-blur-sm'>
						<label className='text-secondary mb-2 block text-xs font-semibold tracking-[0.18em] uppercase'>Admin Password</label>
						<div className='flex items-center gap-3 rounded-xl border border-[#f1dfd8] bg-white/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'>
							<LockKeyhole className='h-4 w-4 text-[#d16a54]' />
							<input
								ref={inputRef}
								type='password'
								value={password}
								onChange={event => setPassword(event.target.value)}
								placeholder='输入管理员密码'
								className='text-primary placeholder:text-secondary/60 flex-1 bg-transparent text-sm outline-none'
								autoComplete='current-password'
								disabled={submitting}
							/>
						</div>
						<p className='text-secondary mt-3 text-xs'>{strengthHint}</p>
					</div>

					<div className='flex gap-3'>
						<motion.button
							type='button'
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
							onClick={handleClose}
							disabled={submitting}
							className='flex-1 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-medium text-[#6f6864] backdrop-blur'>
							{cancelLabel}
						</motion.button>
						<motion.button
							type='submit'
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
							disabled={submitting}
							className='brand-btn flex-1 justify-center rounded-2xl px-4 py-3 text-sm font-medium'>
							{submitting ? '验证中...' : submitLabel}
						</motion.button>
					</div>
				</form>
			</div>
		</DialogModal>
	)
}
