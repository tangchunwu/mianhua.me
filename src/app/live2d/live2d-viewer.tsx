'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import { hoverHints, idleHints, tapHints, toolHints } from './tips'

interface PixiTicker {
	add: (fn: (delta: number) => void) => void
	remove: (fn: (delta: number) => void) => void
}

interface PixiAppInstance {
	stage: { addChild: (child: unknown) => void }
	view: HTMLCanvasElement
	ticker: PixiTicker
	destroy: (opts?: { removeView?: boolean }) => void
}

interface Live2DModelInstance {
	anchor: { set: (x: number, y: number) => void }
	scale: { set: (x: number, y: number) => void }
	x: number
	y: number
	rotation?: number
	interactive?: boolean
	buttonMode?: boolean
	on?: (event: string, handler: () => void) => void
}

type ViewerStatus = 'loading' | 'ready' | 'error'
type ActionType = 'idle' | 'wave' | 'nod' | 'focus'

type ViewerMeta = {
	hasMotions: boolean
	hasExpressions: boolean
	textureCount: number
}

type Live2DChatPayload = {
	ok?: boolean
	error?: string
	data?: {
		message?: string
		raw?: string
		reply?: string
		response?: string
	}
}

type ActionController = {
	run: (action: ActionType, hint: string, durationMs?: number) => void
}

type ChatEntry = {
	id: string
	role: 'user' | 'assistant' | 'system'
	text: string
}

const CDN_SCRIPTS = [
	'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.2.0/browser/pixi.min.js',
	'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
	'https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js'
]

const MODEL_URL = '/live2d/live2d.model3.json'
const BASE_SCALE = 0.25
const QUICK_PROMPTS = ['你好，介绍一下你自己', '你现在支持哪些能力？', '这个模型为什么不能换装？', '下一步应该怎么升级？']

function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve()
			return
		}

		const script = document.createElement('script')
		script.src = src
		script.crossOrigin = 'anonymous'
		script.onload = () => resolve()
		script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
		document.head.appendChild(script)
	})
}

function pickRandom(lines: string[]) {
	return lines[Math.floor(Math.random() * lines.length)]
}

function buildFallbackReply(input: string) {
	const text = input.trim().toLowerCase()

	if (!text) return '你还没输入内容。'
	if (text.includes('你好') || text.includes('hi') || text.includes('hello')) {
		return '你好，我在。'
	}
	if (text.includes('项目')) {
		return '你可以先看项目页，再回来继续扩展这个模型的动作和换装。'
	}
	if (text.includes('动作') || text.includes('motion')) {
		return '当前模型没有内置 motions，所以这里只能先用轻量交互动效模拟。'
	}
	if (text.includes('换装') || text.includes('衣服') || text.includes('texture')) {
		return '这只模型目前只有一张贴图，想做换装需要更完整的模型资源。'
	}
	if (text.includes('对话') || text.includes('聊天')) {
		return '第二阶段已经预留了真实聊天接口，现在缺的是完整的上游地址。'
	}
	if (text.includes('cotton') || text.includes('棉花')) {
		return 'Cotton 这边会继续把这个角色做得更像站点陪伴助手。'
	}

	return '接口不可用时，我会先用本地回复兜底。'
}

async function readModelMeta(): Promise<ViewerMeta> {
	const response = await fetch(MODEL_URL, { cache: 'no-store' })
	if (!response.ok) {
		throw new Error('Failed to load model metadata')
	}

	const data = await response.json()
	const refs = data?.FileReferences ?? {}

	return {
		hasMotions: Boolean(refs.Motions && Object.keys(refs.Motions).length > 0),
		hasExpressions: Array.isArray(refs.Expressions) && refs.Expressions.length > 0,
		textureCount: Array.isArray(refs.Textures) ? refs.Textures.length : 0
	}
}

export default function Live2DViewer() {
	const containerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const actionRunnerRef = useRef<(toolId: string) => void>(() => undefined)
	const actionControllerRef = useRef<ActionController>({
		run: () => undefined
	})
	const sessionIdRef = useRef(`visitor-${Date.now()}`)

	const [status, setStatus] = useState<ViewerStatus>('loading')
	const [errorMsg, setErrorMsg] = useState('')
	const [message, setMessage] = useState('Live2D 兼容层加载中...')
	const [chatInput, setChatInput] = useState('')
	const [followCursor, setFollowCursor] = useState(true)
	const [isChatLoading, setIsChatLoading] = useState(false)
	const [chatHistory, setChatHistory] = useState<ChatEntry[]>([
		{
			id: 'system-welcome',
			role: 'system',
			text: '这里是第二阶段 Live2D 对话面板。当前已接入数字分身代理，接口异常时会自动回退本地回复。'
		}
	])
	const [meta, setMeta] = useState<ViewerMeta>({
		hasMotions: false,
		hasExpressions: false,
		textureCount: 0
	})

	const capabilitySummary = useMemo(
		() => [
			`动作: ${meta.hasMotions ? '模型自带' : '当前仅轻量模拟'}`,
			`表情: ${meta.hasExpressions ? '可扩展' : '未发现表达文件'}`,
			`贴图: ${meta.textureCount} 张`
		],
		[meta]
	)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		let app: PixiAppInstance | null = null
		let model: Live2DModelInstance | null = null
		let animationTime = 0
		let action: ActionType = 'idle'
		let actionExpiresAt = 0
		let targetX = 0
		let targetY = 0
		let currentX = 0
		let currentY = 0
		let centerX = 0
		let centerY = 0

		const resizeTargets = () => {
			if (!container || !model) return
			const width = container.clientWidth || 720
			const height = container.clientHeight || 720
			centerX = width / 2
			centerY = height / 2 + 20
			targetX = centerX
			targetY = centerY
			currentX = centerX
			currentY = centerY
			model.x = centerX
			model.y = centerY
		}

		const playAction = (nextAction: ActionType, hint: string) => {
			action = nextAction
			actionExpiresAt = performance.now() + 900
			setMessage(hint)
		}

		actionControllerRef.current = {
			run: (nextAction, hint, durationMs = 900) => {
				action = nextAction
				actionExpiresAt = performance.now() + durationMs
				setMessage(hint)
			}
		}

		actionRunnerRef.current = (toolId: string) => {
			const hint = toolHints.find((item) => item.id === toolId)
			if (!hint) return

			if (toolId === 'wardrobe') {
				setMessage(hint.lines.join(' '))
				return
			}

			if (toolId === 'wave') {
				playAction('wave', hint.lines.join(' '))
				return
			}

			if (toolId === 'nod') {
				playAction('nod', hint.lines.join(' '))
				return
			}

			if (toolId === 'greet') {
				playAction('focus', pickRandom(hint.lines))
				return
			}

			setMessage(pickRandom(hint.lines))
		}

		const handlePointerMove = (event: PointerEvent) => {
			if (!followCursor || !container) return
			const rect = container.getBoundingClientRect()
			const px = event.clientX - rect.left
			const py = event.clientY - rect.top
			const nx = (px / rect.width - 0.5) * 48
			const ny = (py / rect.height - 0.5) * 28
			targetX = centerX + nx
			targetY = centerY + ny
		}

		const handlePointerLeave = () => {
			targetX = centerX
			targetY = centerY
		}

		const ticker = (delta: number) => {
			if (!model) return

			animationTime += delta / 60
			if (action !== 'idle' && performance.now() > actionExpiresAt) {
				action = 'idle'
			}

			const ease = followCursor ? 0.08 : 0.12
			currentX += (targetX - currentX) * ease
			currentY += (targetY - currentY) * ease

			const breathing = Math.sin(animationTime * 1.4) * 6
			const wave = action === 'wave' ? Math.sin(animationTime * 10) * 0.16 : 0
			const nod = action === 'nod' ? Math.sin(animationTime * 12) * 16 : 0
			const focusScale = action === 'focus' ? 0.03 : 0

			model.x = currentX
			model.y = currentY + breathing + nod
			model.scale.set(BASE_SCALE + focusScale, BASE_SCALE + focusScale)

			if (typeof model.rotation === 'number') {
				model.rotation = wave + (currentX - centerX) / 360
			}
		}

		const init = async () => {
			try {
				setMessage('正在加载 Live2D 模型...')
				const modelMeta = await readModelMeta()
				setMeta(modelMeta)

				for (const src of CDN_SCRIPTS) {
					await loadScript(src)
				}

				const PIXI = (window as unknown as { PIXI?: unknown }).PIXI
				if (!PIXI) {
					throw new Error('PIXI not found on window')
				}
				;(window as unknown as { PIXI: unknown }).PIXI = PIXI

				const PixiApplication = (
					PIXI as {
						Application: new (opts: {
							view: HTMLCanvasElement
							width?: number
							height?: number
							backgroundAlpha?: number
							autoStart?: boolean
						}) => PixiAppInstance
					}
				).Application

				const Live2DModel = (
					PIXI as {
						live2d?: { Live2DModel: { from: (url: string) => Promise<Live2DModelInstance> } }
					}
				).live2d?.Live2DModel

				if (!Live2DModel) {
					throw new Error('PIXI.live2d.Live2DModel not found')
				}

				const width = container.clientWidth || 720
				const height = container.clientHeight || 720
				const canvas = document.createElement('canvas')
				canvas.style.width = '100%'
				canvas.style.height = '100%'
				canvas.style.display = 'block'
				container.appendChild(canvas)

				app = new PixiApplication({
					view: canvas,
					width,
					height,
					backgroundAlpha: 0,
					autoStart: true
				})

				model = await Live2DModel.from(MODEL_URL)
				app.stage.addChild(model)

				model.anchor.set(0.5, 0.5)
				model.interactive = true
				model.buttonMode = true
				resizeTargets()

				model.on?.('pointertap', () => {
					playAction('focus', pickRandom(tapHints))
				})

				container.addEventListener('pointermove', handlePointerMove)
				container.addEventListener('pointerleave', handlePointerLeave)
				container.addEventListener('mouseenter', () => {
					setMessage(pickRandom(hoverHints))
				})

				window.addEventListener('resize', resizeTargets)
				app.ticker.add(ticker)

				setStatus('ready')
				setMessage(pickRandom(idleHints))
			} catch (err) {
				setErrorMsg(err instanceof Error ? err.message : String(err))
				setStatus('error')
			}
		}

		void init()

		const idleTimer = window.setInterval(() => {
			setMessage((current) => {
				if (current.startsWith('当前模型')) return current
				if (current.startsWith('正在连接数字分身')) return current
				return pickRandom(idleHints)
			})
		}, 12000)

		return () => {
			actionRunnerRef.current = () => undefined
			actionControllerRef.current = { run: () => undefined }
			window.clearInterval(idleTimer)
			window.removeEventListener('resize', resizeTargets)
			container.removeEventListener('pointermove', handlePointerMove)
			container.removeEventListener('pointerleave', handlePointerLeave)

			if (app) {
				app.ticker.remove(ticker)
				app.destroy({ removeView: true })
			}

			container.innerHTML = ''
		}
	}, [followCursor])

	const runToolAction = (toolId: string) => {
		actionRunnerRef.current(toolId)
	}

	const sendMessage = async (rawValue: string) => {
		const value = rawValue.trim()
		if (!value || isChatLoading) return

		setChatHistory((current) => [
			...current,
			{
				id: `user-${Date.now()}`,
				role: 'user',
				text: value
			}
		])
		setIsChatLoading(true)
		setChatInput('')
		actionControllerRef.current.run('focus', '正在连接数字分身接口...', 1600)

		try {
			const response = await fetch('/api/live2d/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: value,
					session_id: sessionIdRef.current
				})
			})

			const payload = (await response.json()) as Live2DChatPayload

			if (!response.ok || !payload.ok) {
				throw new Error(payload.error || 'Live2D chat request failed')
			}

			const aiMessage =
				payload.data?.message ||
				payload.data?.reply ||
				payload.data?.response ||
				payload.data?.raw ||
				'接口已经连通，但没有返回可展示的 message 字段。'

			actionControllerRef.current.run('nod', aiMessage, 1800)
			setChatHistory((current) => [
				...current,
				{
					id: `assistant-${Date.now()}`,
					role: 'assistant',
					text: aiMessage
				}
			])
		} catch {
			const fallback = buildFallbackReply(value)
			actionControllerRef.current.run('wave', fallback, 1800)
			setChatHistory((current) => [
				...current,
				{
					id: `assistant-${Date.now()}`,
					role: 'assistant',
					text: fallback
				}
			])
		} finally {
			setIsChatLoading(false)
			inputRef.current?.focus()
		}
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		await sendMessage(chatInput)
	}

	return (
		<div className='grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
			<div className='relative overflow-hidden rounded-[36px] border border-white/60 bg-white/45 p-6 shadow-[0_24px_80px_rgba(227,122,87,0.16)] backdrop-blur-xl'>
				<div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.85),_rgba(255,255,255,0.18)_45%,_rgba(255,203,145,0.2)_100%)]' />
				<div className='relative flex min-h-[720px] flex-col'>
					<div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
						<div>
							<p className='text-[13px] font-semibold uppercase tracking-[0.28em] text-[#b5977b]'>Live2D Compat Layer</p>
							<h2 className='mt-2 text-3xl font-semibold tracking-tight text-[#4b3d3d]'>对话、提示与动作兼容层</h2>
						</div>
						<div className='flex flex-wrap gap-2'>
							{capabilitySummary.map((item) => (
								<span
									key={item}
									className='rounded-full border border-white/65 bg-white/70 px-3 py-1 text-xs text-[#7b6a6a]'
								>
									{item}
								</span>
							))}
						</div>
					</div>

					<div className='relative flex-1 overflow-hidden rounded-[28px] border border-white/65 bg-white/40'>
						<div className='absolute left-6 top-6 z-10 max-w-[320px] rounded-[24px] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_12px_32px_rgba(100,72,60,0.12)] backdrop-blur-md'>
							<p className='text-sm leading-6 text-[#5d4d4d]'>{message}</p>
						</div>
						<div
							ref={containerRef}
							className='absolute inset-0 h-full w-full bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.7),_rgba(255,234,207,0.18)_58%,_rgba(255,195,160,0.18)_100%)]'
						/>
						{status === 'loading' && (
							<div className='absolute inset-0 flex items-center justify-center text-sm text-[#8f7d7d]'>
								正在加载 Live2D 模型...
							</div>
						)}
						{status === 'error' && (
							<div className='absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-500'>
								{errorMsg}
							</div>
						)}
					</div>
				</div>
			</div>

			<div className='flex flex-col gap-4'>
				<div className='rounded-[28px] border border-white/60 bg-white/50 p-5 shadow-[0_20px_60px_rgba(226,136,102,0.12)] backdrop-blur-xl'>
					<h3 className='text-lg font-semibold text-[#4b3d3d]'>交互工具</h3>
					<p className='mt-2 text-sm leading-6 text-[#7a6969]'>
						这里兼容的是 Halo 插件的交互层，不是直接复用插件代码。动作现在仍然用轻量动效模拟。
					</p>
					<div className='mt-4 grid grid-cols-2 gap-3'>
						{toolHints.map((tool) => (
							<button
								key={tool.id}
								type='button'
								onClick={() => runToolAction(tool.id)}
								className='rounded-2xl border border-white/70 bg-white/75 px-3 py-3 text-sm font-medium text-[#5d4d4d] transition hover:-translate-y-0.5 hover:bg-white'
							>
								{tool.label}
							</button>
						))}
					</div>
					<label className='mt-4 flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-[#5d4d4d]'>
						<span>跟随鼠标</span>
						<input
							type='checkbox'
							checked={followCursor}
							onChange={(event) => setFollowCursor(event.target.checked)}
							className='h-4 w-4 accent-[#ef6b4a]'
						/>
					</label>
				</div>

				<div className='rounded-[28px] border border-white/60 bg-white/50 p-5 shadow-[0_20px_60px_rgba(226,136,102,0.12)] backdrop-blur-xl'>
					<h3 className='text-lg font-semibold text-[#4b3d3d]'>对话测试</h3>
					<p className='mt-2 text-sm leading-6 text-[#7a6969]'>
						这里已经接好了真实接口的服务端代理。只要补全环境变量里的 Supabase 函数地址，就会先走数字分身接口，失败时再回退到本地回复。
					</p>
					<div className='mt-4 flex flex-wrap gap-2'>
						{QUICK_PROMPTS.map((prompt) => (
							<button
								key={prompt}
								type='button'
								disabled={isChatLoading}
								onClick={() => void sendMessage(prompt)}
								className='rounded-full border border-white/70 bg-white/80 px-3 py-2 text-xs text-[#6f5d5d] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
							>
								{prompt}
							</button>
						))}
					</div>
					<div className='mt-4 max-h-64 space-y-3 overflow-y-auto rounded-3xl border border-white/70 bg-white/65 p-3'>
						{chatHistory.map((entry) => (
							<div
								key={entry.id}
								className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
									entry.role === 'user'
										? 'ml-8 bg-[#ef6b4a] text-white'
										: entry.role === 'assistant'
											? 'mr-4 bg-white text-[#5a4b4b]'
											: 'border border-dashed border-white/70 bg-white/50 text-[#7a6969]'
								}`}
							>
								{entry.text}
							</div>
						))}
					</div>
					<form className='mt-4 space-y-3' onSubmit={handleSubmit}>
						<input
							ref={inputRef}
							value={chatInput}
							disabled={isChatLoading}
							onChange={(event) => setChatInput(event.target.value)}
							placeholder='输入一句话，例如：你好，介绍一下你自己'
							className='w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-[#4b3d3d] outline-none ring-0 placeholder:text-[#aa9c9c] disabled:cursor-not-allowed disabled:opacity-60'
						/>
						<button
							type='submit'
							disabled={isChatLoading}
							className='w-full rounded-2xl bg-[#ef6b4a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e85b37] disabled:cursor-not-allowed disabled:opacity-60'
						>
							{isChatLoading ? '请求中...' : '发送'}
						</button>
					</form>
				</div>

				<div className='rounded-[28px] border border-white/60 bg-white/50 p-5 shadow-[0_20px_60px_rgba(226,136,102,0.12)] backdrop-blur-xl'>
					<h3 className='text-lg font-semibold text-[#4b3d3d]'>当前模型限制</h3>
					<ul className='mt-3 space-y-2 text-sm leading-6 text-[#7a6969]'>
						<li>没有检测到 motions 文件，真实动作还不能直接接。</li>
						<li>只发现 {meta.textureCount} 张贴图，暂时没有现成换装资源。</li>
						<li>如果你换成完整模型资源，这个兼容层可以继续往上接真实动作、表情和换装。</li>
					</ul>
				</div>
			</div>
		</div>
	)
}
