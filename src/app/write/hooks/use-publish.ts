import { useCallback } from 'react'
import { toast } from 'sonner'
import { pushBlog } from '../services/push-blog'
import { deleteBlog } from '../services/delete-blog'
import { useWriteStore } from '../stores/write-store'
import { useAuthStore } from '@/hooks/use-auth'
import { ensureAdminAuth } from '@/lib/admin-client'

export function usePublish() {
	const { loading, setLoading, form, cover, images, mode, originalSlug } = useWriteStore()
	const { isAuth, loginWithPassword } = useAuthStore()

	const onPublish = useCallback(async () => {
		if (!(await ensureAdminAuth(isAuth, loginWithPassword))) return
		try {
			setLoading(true)
			await pushBlog({
				form,
				cover,
				images,
				mode,
				originalSlug
			})

			const successMsg = mode === 'edit' ? '更新成功' : '发布成功'
			toast.success(successMsg)
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '操作失败')
		} finally {
			setLoading(false)
		}
	}, [form, cover, images, mode, originalSlug, setLoading, isAuth, loginWithPassword])

	const onDelete = useCallback(async () => {
		const targetSlug = originalSlug || form.slug
		if (!targetSlug) {
			toast.error('缺少 slug，无法删除')
			return
		}
		if (!(await ensureAdminAuth(isAuth, loginWithPassword))) return
		try {
			setLoading(true)
			await deleteBlog(targetSlug)
			toast.success('删除成功')
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '删除失败')
		} finally {
			setLoading(false)
		}
	}, [form.slug, originalSlug, setLoading, isAuth, loginWithPassword])

	return {
		isAuth,
		loading,
		onPublish,
		onDelete
	}
}
