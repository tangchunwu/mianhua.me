'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import initialList from './list.json'
import { RandomLayout } from './components/random-layout'
import UploadDialog from './components/upload-dialog'
import { pushPictures } from './services/push-pictures'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import type { ImageItem } from '../projects/components/image-upload-dialog'
import { useRouter } from 'next/navigation'
import { ensureAdminAuth } from '@/lib/admin-client'
import { loadServerContent } from '@/lib/content-client'

export interface Picture {
	id: string
	uploadedAt: string
	description?: string
	image?: string
	images?: string[]
}

export default function Page() {
	const [pictures, setPictures] = useState<Picture[]>(initialList as Picture[])
	const [originalPictures, setOriginalPictures] = useState<Picture[]>(initialList as Picture[])
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
	const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())
	const router = useRouter()

	const { isAuth, loginWithPassword } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false

	useEffect(() => {
		loadServerContent<Picture[]>('pictures')
			.then(serverPictures => {
				setPictures(serverPictures)
				setOriginalPictures(serverPictures)
			})
			.catch(error => {
				console.error('Failed to load pictures:', error)
				toast.error(error?.message || '加载内容失败')
			})
	}, [])

	const handleUploadSubmit = ({ images, description }: { images: ImageItem[]; description: string }) => {
		const now = new Date().toISOString()

		if (images.length === 0) {
			toast.error('请至少选择一张图片')
			return
		}

		const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
		const desc = description.trim() || undefined
		const imageUrls = images.map(imageItem => (imageItem.type === 'url' ? imageItem.url : imageItem.previewUrl))
		const newPicture: Picture = {
			id,
			uploadedAt: now,
			description: desc,
			images: imageUrls
		}

		setPictures(prev => [...prev, newPicture])
		setImageItems(prev => {
			const next = new Map(prev)
			images.forEach((imageItem, index) => {
				if (imageItem.type === 'file') {
					next.set(`${id}::${index}`, imageItem)
				}
			})
			return next
		})
		setIsUploadDialogOpen(false)
	}

	const handleDeleteSingleImage = (pictureId: string, imageIndex: number | 'single') => {
		setPictures(prev => {
			return prev
				.map(picture => {
					if (picture.id !== pictureId) return picture

					if (imageIndex === 'single') {
						return null
					}

					if (picture.images && picture.images.length > 0) {
						const newImages = picture.images.filter((_, idx) => idx !== imageIndex)
						if (newImages.length === 0) {
							return null
						}
						return {
							...picture,
							images: newImages
						}
					}

					return picture
				})
				.filter((picture): picture is Picture => picture !== null)
		})

		setImageItems(prev => {
			const next = new Map(prev)
			if (imageIndex === 'single') {
				for (const key of next.keys()) {
					if (key.startsWith(`${pictureId}::`)) {
						next.delete(key)
					}
				}
				return next
			}

			next.delete(`${pictureId}::${imageIndex}`)
			const keysToUpdate: Array<{ oldKey: string; newKey: string }> = []
			for (const key of next.keys()) {
				if (!key.startsWith(`${pictureId}::`)) continue
				const [, indexStr] = key.split('::')
				const oldIndex = Number(indexStr)
				if (!Number.isNaN(oldIndex) && oldIndex > imageIndex) {
					keysToUpdate.push({
						oldKey: key,
						newKey: `${pictureId}::${oldIndex - 1}`
					})
				}
			}
			for (const { oldKey, newKey } of keysToUpdate) {
				const value = next.get(oldKey)
				if (value) {
					next.set(newKey, value)
					next.delete(oldKey)
				}
			}
			return next
		})
	}

	const handleDeleteGroup = (picture: Picture) => {
		if (!confirm('确定要删除这一组图片吗？')) return

		setPictures(prev => prev.filter(item => item.id !== picture.id))
		setImageItems(prev => {
			const next = new Map(prev)
			for (const key of next.keys()) {
				if (key.startsWith(`${picture.id}::`)) {
					next.delete(key)
				}
			}
			return next
		})
	}

	const handleSave = async () => {
		setIsSaving(true)

		try {
			const savedPictures = await pushPictures({
				pictures,
				originalPictures,
				imageItems
			})

			setPictures(savedPictures)
			setOriginalPictures(savedPictures)
			setImageItems(new Map())
			setIsEditMode(false)
			toast.success('保存成功')
		} catch (error: any) {
			console.error('Failed to save:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleSaveClick = async () => {
		if (!(await ensureAdminAuth(isAuth, loginWithPassword))) return
		await handleSave()
	}

	const handleEnterEditMode = async () => {
		if (!(await ensureAdminAuth(isAuth, loginWithPassword))) return
		setIsEditMode(true)
	}

	const handleCancel = () => {
		setPictures(originalPictures)
		setImageItems(new Map())
		setIsEditMode(false)
	}

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isEditMode && (e.ctrlKey || e.metaKey) && e.key === ',') {
				e.preventDefault()
				void handleEnterEditMode()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [isEditMode, isAuth, loginWithPassword])

	return (
		<>
			<RandomLayout pictures={pictures} isEditMode={isEditMode} onDeleteSingle={handleDeleteSingleImage} onDeleteGroup={handleDeleteGroup} />

			{pictures.length === 0 && <div className='text-secondary flex min-h-screen items-center justify-center text-center text-sm'>还没有上传图片，点击右上角“编辑”后即可开始上传。</div>}

			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => router.push('/image-toolbox')}
							className='rounded-xl border bg-blue-50 px-4 py-2 text-sm text-blue-700'>
							压缩工具
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							disabled={isSaving}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							取消
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setIsUploadDialogOpen(true)}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							上传
						</motion.button>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSaveClick} disabled={isSaving} className='brand-btn px-6'>
							{isSaving ? '保存中...' : '保存'}
						</motion.button>
					</>
				) : (
					!hideEditButton && (
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => void handleEnterEditMode()}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
							编辑
						</motion.button>
					)
				)}
			</motion.div>

			{isUploadDialogOpen && <UploadDialog onClose={() => setIsUploadDialogOpen(false)} onSubmit={handleUploadSubmit} />}
		</>
	)
}
