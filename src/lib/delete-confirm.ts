'use client'

import { toast } from 'sonner'

export async function confirmDeleteAction(targetLabel: string): Promise<boolean> {
	const confirmed = window.confirm(`确定删除${targetLabel}吗？此操作不可恢复。`)
	if (!confirmed) return false

	const typed = window.prompt('请输入 DELETE 确认删除')
	if (typed !== 'DELETE') {
		toast.error('删除已取消：确认文本不匹配')
		return false
	}

	return true
}
