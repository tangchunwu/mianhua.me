'use client'

import { ANIMATION_DELAY } from '@/consts'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useSize } from '@/hooks/use-size'

interface Props {
	className?: string
	order: number
	width: number
	height?: number
	x: number
	y: number
	children: React.ReactNode
}

export default function Card({ children, order, width, height, x, y, className }: Props) {
	const { maxMD, init } = useSize()
	let [show, setShow] = useState(false)
	if (maxMD && init) order = 0

	useEffect(() => {
		if (show) return
		if (x === 0 && y === 0) return
		setTimeout(
			() => {
				setShow(true)
			},
			order * ANIMATION_DELAY * 1000
		)
	}, [x, y, show])

	if (show && maxMD && init)
		return (
			<motion.div
				className={cn(
					'bg-card relative w-full max-w-[32rem] rounded-[40px] border p-6 backdrop-blur-[4px] shadow-[0_40px_50px_-32px_rgba(0,0,0,0.05),inset_0_0_20px_rgba(255,255,255,0.25)]',
					className
				)}
				initial={{ opacity: 0, scale: 0.94 }}
				animate={{ opacity: 1, scale: 1 }}>
				{children}
			</motion.div>
		)

	if (show)
		return (
			<motion.div
				className={cn('card squircle', className)}
				initial={{ opacity: 0, scale: 0.6, left: x, top: y, width, height }}
				animate={{ opacity: 1, scale: 1, left: x, top: y, width, height }}
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}>
				{children}
			</motion.div>
		)

	return null
}
