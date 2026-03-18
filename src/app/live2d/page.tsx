'use client'

import Live2DViewer from './live2d-viewer'

export default function Live2DPage() {
	return (
		<div className='flex min-h-full items-start justify-center px-3 pb-16 pt-20 sm:px-4 sm:pb-16 sm:pt-20 lg:px-6 lg:pb-20 lg:pt-20 xl:px-0 xl:pb-24 xl:pt-20'>
			<Live2DViewer />
		</div>
	)
}
