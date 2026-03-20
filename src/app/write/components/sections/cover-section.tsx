'use client'

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { useWriteStore } from '../../stores/write-store'

type CoverSectionProps = {
	delay?: number
}

export function CoverSection({ delay = 0 }: CoverSectionProps) {
	const { images, setCover, cover, addFiles, addUrlImage } = useWriteStore()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [urlInput, setUrlInput] = useState('')

	const coverPreviewUrl = cover ? (cover.type === 'url' ? cover.url : cover.previewUrl) : null

	const handleCoverDrop = async (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault()

		const md = e.dataTransfer.getData('text/markdown') || e.dataTransfer.getData('text/plain') || ''
		const m = /!\[\]\(([^)]+)\)/.exec(md.trim())
		if (m) {
			const target = m[1]
			let foundItem

			if (target.startsWith('local-image:')) {
				const id = target.replace(/^local-image:/, '')
				foundItem = images.find(it => it.id === id)
			} else {
				foundItem = images.find(it => it.type === 'url' && it.url === target)
			}

			if (foundItem) {
				setCover(foundItem)
				toast.success('已设置封面')
				return
			}
		}

		const files = e.dataTransfer.files
		if (files && files.length > 0) {
			const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
			if (imageFiles.length === 0) {
				toast.error('请拖入图片文件')
				return
			}

			const resultImages = await addFiles(imageFiles as unknown as FileList)
			if (resultImages.length > 0) {
				setCover(resultImages[0])
				toast.success('已设置封面')
			}
		}
	}

	const handleClickUpload = () => {
		fileInputRef.current?.click()
	}

	const handleSetCoverUrl = () => {
		const item = addUrlImage(urlInput)
		if (!item) return
		setCover(item)
		setUrlInput('')
		toast.success('已设置封面')
	}

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files
		if (!files || files.length === 0) return

		const resultImages = await addFiles(files)
		if (resultImages.length > 0) {
			setCover(resultImages[0])
			toast.success('已设置封面')
		}

		e.target.value = ''
	}

	return (
		<motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }} className='card relative'>
			<h2 className='text-sm'>封面</h2>
			<input ref={fileInputRef} type='file' accept='image/*' className='hidden' onChange={handleFileChange} />
			<div
				className='bg-card mt-3 h-[150px] overflow-hidden rounded-xl border'
				onDragOver={e => {
					e.preventDefault()
				}}
				onDrop={handleCoverDrop}>
				{coverPreviewUrl ? (
					<img src={coverPreviewUrl} alt='cover preview' className='h-full w-full rounded-2xl object-cover' />
				) : (
					<div className='grid h-full w-full cursor-pointer place-items-center transition-colors hover:bg-white/60' onClick={handleClickUpload}>
						<span className='text-3xl leading-none text-neutral-400'>+</span>
					</div>
				)}
			</div>

			<div className='mt-3 flex items-center gap-2'>
				<input
					type='text'
					placeholder='https://...'
					className='bg-card flex-1 rounded-lg border px-3 py-2 text-sm'
					value={urlInput}
					onChange={e => setUrlInput(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter') {
							e.preventDefault()
							handleSetCoverUrl()
						}
					}}
				/>
				<button type='button' className='rounded-lg border bg-white/70 px-3 py-2 text-sm' onClick={handleSetCoverUrl}>
					使用链接
				</button>
			</div>
		</motion.div>
	)
}
