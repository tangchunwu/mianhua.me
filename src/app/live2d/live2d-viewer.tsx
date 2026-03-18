'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useMarkdownRender } from '@/hooks/use-markdown-render'

import { defaultTipsConfig, Live2DTipsConfig } from './tips'

interface PixiTicker {
	add: (fn: (delta: number) => void) => void
	remove: (fn: (delta: number) => void) => void
}

interface PixiAppInstance {
	stage: { addChild: (child: unknown) => void }
	view: HTMLCanvasElement
	ticker: PixiTicker
	renderer?: {
		resize: (width: number, height: number) => void
		resolution?: number
	}
	destroy: (opts?: { removeView?: boolean }) => void
}

interface Live2DModelInstance {
	anchor: { set: (x: number, y: number) => void }
	scale: { set: (x: number, y: number) => void }
	x: number
	y: number
	width?: number
	height?: number
	rotation?: number
	interactive?: boolean
	buttonMode?: boolean
	motion?: (group: string, index?: number, priority?: number) => void | Promise<unknown>
	expression?: (name?: string) => void | Promise<unknown>
	update?: (deltaTime: number) => void
	internalModel?: {
		startMotion?: (group: string, index: number, priority: number) => void
		setExpression?: (name: string) => void
		motionManager?: {
			stopAllMotions?: () => void
			_stopAllMotions?: () => void
		}
	}
	on?: (event: string, handler: () => void) => void
}

interface BrowserSpeechRecognitionAlternative {
	transcript: string
}

interface BrowserSpeechRecognitionResult {
	0: BrowserSpeechRecognitionAlternative
	isFinal: boolean
	length: number
	item: (index: number) => BrowserSpeechRecognitionAlternative
}

interface BrowserSpeechRecognitionResultList {
	length: number
	[index: number]: BrowserSpeechRecognitionResult
}

interface BrowserSpeechRecognitionEvent extends Event {
	resultIndex: number
	results: BrowserSpeechRecognitionResultList
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
	error: string
}

interface BrowserSpeechRecognitionInstance extends EventTarget {
	lang: string
	continuous: boolean
	interimResults: boolean
	maxAlternatives: number
	onstart: ((this: BrowserSpeechRecognitionInstance, ev: Event) => unknown) | null
	onresult: ((this: BrowserSpeechRecognitionInstance, ev: BrowserSpeechRecognitionEvent) => unknown) | null
	onerror: ((this: BrowserSpeechRecognitionInstance, ev: BrowserSpeechRecognitionErrorEvent) => unknown) | null
	onend: ((this: BrowserSpeechRecognitionInstance, ev: Event) => unknown) | null
	start: () => void
	stop: () => void
	abort: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognitionInstance

declare global {
	interface Window {
		SpeechRecognition?: BrowserSpeechRecognitionConstructor
		webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
	}
}

type ViewerStatus = 'loading' | 'ready' | 'error'
type ActionType = 'idle' | 'wave' | 'nod' | 'focus'
type RuntimeType = 'cubism2' | 'cubism4'
type ModelId = 'rgm' | 'bingtanghulu' | 'xiajiao' | 'yuebing' | 'mapodoufu' | 'shuangpinai' | 'xiehuangtangbao' | 'mori_miko'
type ToolId = 'greet' | 'wave' | 'nod' | 'tips' | 'wardrobe'

type ViewerMeta = {
	hasMotions: boolean
	hasExpressions: boolean
	textureCount: number
	motionCount: number
}

type ModelMotionEntry = {
	group: string
	file: string
	name: string
	category: string
}

type ModelExpressionEntry = {
	name: string
	file?: string
	label: string
}

type CuratedMotionGroup = {
	title: string
	motions: ModelMotionEntry[]
}

type ModelAssetCatalog = {
	motions: ModelMotionEntry[]
	expressions: ModelExpressionEntry[]
}

type MotionHandle = {
	group: string
	index: number
	file: string
}

type CharacterVoice = {
	loading: string
	connecting: string
	motionReady: string[]
	motionFailed: string[]
	expressionReady: (label: string) => string
	expressionFailed: string[]
	headTap: string[]
	bodyTap: string[]
}

function ChatMarkdown({ text, compact = false }: { text: string; compact?: boolean }) {
	const { content, loading } = useMarkdownRender(text)

	if (loading) {
		return <div className='whitespace-pre-wrap'>{text}</div>
	}

	return (
		<div className={`prose chat-prose max-w-none text-inherit prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:my-2 prose-code:text-inherit ${compact ? 'prose-sm' : 'prose-sm'}`}>
			{content}
		</div>
	)
}

function AssistantMessage({ text, compact = false }: { text: string; compact?: boolean }) {
	const [visibleCount, setVisibleCount] = useState(0)
	const [done, setDone] = useState(false)

	useEffect(() => {
		setVisibleCount(0)
		setDone(false)

		if (!text) {
			setDone(true)
			return
		}

		const step = text.length > 180 ? 4 : text.length > 80 ? 3 : 2
		const timer = window.setInterval(() => {
			setVisibleCount((current) => {
				const next = Math.min(current + step, text.length)
				if (next >= text.length) {
					window.clearInterval(timer)
					window.setTimeout(() => setDone(true), 80)
				}
				return next
			})
		}, 24)

		return () => window.clearInterval(timer)
	}, [text])

	if (!done) {
		return (
			<div className='whitespace-pre-wrap'>
				{text.slice(0, visibleCount)}
				<span className='ml-0.5 inline-block h-[1em] w-2 animate-pulse rounded-sm bg-[#ef6b4a]/45 align-[-0.15em]' />
			</div>
		)
	}

	return <ChatMarkdown text={text} compact={compact} />
}

const EXPRESSION_LABELS: Partial<Record<ModelId, Record<string, string>>> = {
	rgm: {
		idle: '平静',
		kaixin: '开心',
		renzhen: '认真',
		haixiu: '害羞',
		chijing: '吃惊',
		nanguo: '难过',
		shengqi: '生气'
	},
	bingtanghulu: {
		idle: '平静',
		kaixin: '开心',
		haixiu: '害羞',
		chijing: '吃惊',
		nanguo: '难过',
		shengqi: '生气'
	},
	xiajiao: {
		idle: '平静',
		kaixin: '开心',
		haixiu: '害羞',
		chijing: '吃惊',
		nanguo: '难过',
		shengqi: '生气',
		daku: '大哭'
	},
	yuebing: {
		idle: '平静',
		kaixin: '开心',
		haixiu: '害羞',
		chijing: '吃惊',
		nanguo: '难过',
		shengqi: '生气'
	},
	mapodoufu: {
		idle: '平静',
		kaixin: '开心',
		haixiu: '害羞',
		chijing: '吃惊',
		nanguo: '难过',
		shengqi: '生气'
	},
	shuangpinai: {
		idle: '平静',
		kaixin: '开心',
		haixiu: '害羞',
		chijing: '吃惊',
		nanguo: '难过',
		shengqi: '生气'
	},
	xiehuangtangbao: {
		idle: '平静',
		kaixin: '开心',
		haixiu: '害羞',
		chijing: '吃惊',
		nanguo: '难过',
		shengqi: '生气',
		xianqi: '嫌弃'
	},
	mori_miko: {
		'face weixiao': '微笑',
		'face xiao': '轻笑',
		'face haoqi': '好奇',
		'face xingfen': '兴奋',
		'face yiwen': '疑问'
	}
}

const MORI_MIKO_VISIBLE_MOTION_FILES = new Set([
	'motions/ear_dala.motion3.json',
	'motions/ear_diluo.motion3.json',
	'motions/ear_doudong.motion3.json',
	'motions/ear_shandong.motion3.json',
	'motions/ear_shuqi.motion3.json',
	'motions/ear_xingfen.motion3.json',
	'motions/head_yaotou.motion3.json',
	'motions/head_youwaitou.motion3.json',
	'motions/head_zuowaitou.motion3.json',
	'motions/tail_shuqi.motion3.json',
	'motions/tail_xingfen.motion3.json'
])

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

type AssetController = {
	playMotion: (motionFile: string, label: string) => void
	playExpression: (expressionName: string, label: string) => void
}

type ChatEntry = {
	id: string
	role: 'user' | 'assistant' | 'system'
	text: string
}

type VoiceStatus = 'idle' | 'listening' | 'unsupported' | 'denied' | 'error'

type ModelToolDefinition = {
	id: ToolId
	label: string
	lines: string[]
	mode: 'action' | 'expression' | 'message'
	action?: ActionType
	durationMs?: number
	expressionNames?: string[]
	expressionMotionFiles?: string[]
	motionCategories?: string[]
}

type ModelDefinition = {
	id: ModelId
	name: string
	description: string
	modelUrl: string
	runtime: RuntimeType
	defaultBubble: string
	welcomeText: string
	headTapMessage: string
	motionFiles: Partial<Record<ActionType | 'tapHead' | 'tapBody' | 'expression', string>>
	toolDefinitions: ModelToolDefinition[]
}

const PIXI_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.2.0/browser/pixi.min.js'
const CUBISM2_RUNTIME_SCRIPT = '/live2d/live2d.min.js'
const CUBISM2_SCRIPT = 'https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism2.min.js'
const CUBISM4_CORE_SCRIPT = '/live2d/live2dcubismcore.min.js'
const CUBISM4_SCRIPT = '/live2d/cubism4.min.js'

const TIPS_URL = '/live2d/tips.json'
const DEFAULT_MOTION_GROUP = ''
const MODEL_OPTIONS: Record<ModelId, ModelDefinition> = {
	rgm: {
		id: 'rgm',
		name: '热干面',
		description: '旧版 Cubism 2 模型，保留原始动作与表情资源。',
		modelUrl: '/live2d/rgm/model.json',
		runtime: 'cubism2',
		defaultBubble: '热干面在线，随时可以聊。',
		welcomeText: '已切换到热干面，可以开始对话。',
		headTapMessage: '别一直摸头，我会分心。',
		motionFiles: {
			idle: 'action/idle.mtn',
			wave: 'action/zhaohu.mtn',
			nod: 'action/diantou.mtn',
			focus: 'action/xiangzhi.mtn',
			tapHead: 'action/yaotou.mtn',
			tapBody: 'action/reshen.mtn'
		},
		toolDefinitions: [
			{
				id: 'greet',
				label: '互动',
				lines: ['我换一种更自然的回应给你。', '这次会从热干面自己的动作池里随机挑一个。'],
				mode: 'action',
				action: 'focus',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'wave',
				label: '招呼',
				lines: ['这次会在热干面的招呼和身体动作里随机挑一个。', '不再固定死在同一条 motion 上。'],
				mode: 'action',
				action: 'wave',
				durationMs: 1800,
				motionCategories: ['基础动作']
			},
			{
				id: 'nod',
				label: '回应',
				lines: ['我换一个更明显的回应动作给你。', '热干面这里也改成从自己的动作池里选。'],
				mode: 'action',
				action: 'nod',
				durationMs: 1800,
				motionCategories: ['基础动作']
			},
			{
				id: 'tips',
				label: '表情',
				lines: ['现在切一个更贴近当前状态的表情。', '热干面这套资源带了独立 exp 表情文件。'],
				mode: 'expression',
				expressionNames: ['kaixin', 'renzhen', 'haixiu', 'chijing', 'nanguo', 'shengqi']
			},
			{
				id: 'wardrobe',
				label: '换装',
				lines: ['这套热干面目前只有 1 张贴图，暂时还不能直接换装。', '现阶段更适合优先把动作和表情互动打磨完整。'],
				mode: 'message'
			}
		]
	},
	bingtanghulu: {
		id: 'bingtanghulu',
		name: '冰糖葫芦',
		description: '食物语旧版 Cubism 2 模型，先接入原始动作和表情资源。',
		modelUrl: '/live2d/bingtanghulu_100039/model.json',
		runtime: 'cubism2',
		defaultBubble: '冰糖葫芦已上线。',
		welcomeText: '已切换到冰糖葫芦，可以开始对话。',
		headTapMessage: '别乱碰，我会害羞的。',
		motionFiles: {
			idle: 'action/idle.mtn',
			wave: 'action/baishou.mtn',
			nod: 'action/jushou.mtn',
			focus: 'action/niudong.mtn',
			tapHead: 'action/jushou.mtn',
			tapBody: 'action/baishou.mtn'
		},
		toolDefinitions: [
			{
				id: 'greet',
				label: '互动',
				lines: ['我换成冰糖葫芦来和你互动。', '这里会从她自己的动作池里随机挑一个。'],
				mode: 'action',
				action: 'focus',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'wave',
				label: '招呼',
				lines: ['这次会在冰糖葫芦的动作里随机挑一个招呼。', '先保持旧版模型的原始节奏。'],
				mode: 'action',
				action: 'wave',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'nod',
				label: '回应',
				lines: ['我切一个更明显的回应动作。', '先用这套模型现有的动作资源顶上。'],
				mode: 'action',
				action: 'nod',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'tips',
				label: '表情',
				lines: ['现在切一个更贴近当前状态的表情。', '冰糖葫芦这套也带了独立 exp 表情文件。'],
				mode: 'expression',
				expressionNames: ['kaixin', 'haixiu', 'chijing', 'nanguo', 'shengqi']
			},
			{
				id: 'wardrobe',
				label: '换装',
				lines: ['这套冰糖葫芦目前只有 1 张贴图，暂时还不能直接换装。', '先把角色接进页面，后续再看有没有更多皮肤资源。'],
				mode: 'message'
			}
		]
	},
	xiajiao: {
		id: 'xiajiao',
		name: '虾饺',
		description: '食物语旧版 Cubism 2 模型，先接入原始动作和表情资源。',
		modelUrl: '/live2d/xiajiao_100016/model.json',
		runtime: 'cubism2',
		defaultBubble: '虾饺已上线。',
		welcomeText: '已切换到虾饺，可以开始对话。',
		headTapMessage: '别这样盯着我，我会不好意思。',
		motionFiles: {
			idle: 'action/idle.mtn',
			wave: 'action/jushou.mtn',
			nod: 'action/sikao.mtn',
			focus: 'action/qinwen.mtn',
			tapHead: 'action/woquan.mtn',
			tapBody: 'action/jushou.mtn'
		},
		toolDefinitions: [
			{
				id: 'greet',
				label: '互动',
				lines: ['我换成虾饺来和你互动。', '这里会从她自己的动作池里随机挑一个。'],
				mode: 'action',
				action: 'focus',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'wave',
				label: '招呼',
				lines: ['这次会在虾饺的动作里随机挑一个招呼。', '先保留食物语原始动作。'],
				mode: 'action',
				action: 'wave',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'nod',
				label: '回应',
				lines: ['我切一个更明显的回应动作。', '先用她自己的动作资源顶上。'],
				mode: 'action',
				action: 'nod',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'tips',
				label: '表情',
				lines: ['现在切一个更贴近当前状态的表情。', '虾饺这套也带了独立 exp 表情文件。'],
				mode: 'expression',
				expressionNames: ['kaixin', 'haixiu', 'chijing', 'nanguo', 'shengqi', 'daku']
			},
			{
				id: 'wardrobe',
				label: '换装',
				lines: ['这套虾饺目前只有 1 张贴图，暂时还不能直接换装。', '先把角色接进页面，后续再看有没有更多皮肤资源。'],
				mode: 'message'
			}
		]
	},
	yuebing: {
		id: 'yuebing',
		name: '月饼',
		description: '食物语旧版 Cubism 2 模型，先接入原始动作和表情资源。',
		modelUrl: '/live2d/yuebing_100083/model.json',
		runtime: 'cubism2',
		defaultBubble: '月饼已上线。',
		welcomeText: '已切换到月饼，可以开始对话。',
		headTapMessage: '别乱碰，我在看着你。',
		motionFiles: {
			idle: 'action/idle.mtn',
			wave: 'action/zhengyi.mtn',
			nod: 'action/guqi.mtn',
			focus: 'action/zhengyi.mtn',
			tapHead: 'action/guqi.mtn',
			tapBody: 'action/zhengyi.mtn'
		},
		toolDefinitions: [
			{
				id: 'greet',
				label: '互动',
				lines: ['我换成月饼来和你互动。', '这里会从他的动作池里随机挑一个。'],
				mode: 'action',
				action: 'focus',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'wave',
				label: '招呼',
				lines: ['这次会在月饼的动作里随机挑一个招呼。', '先保留食物语原始动作。'],
				mode: 'action',
				action: 'wave',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'nod',
				label: '回应',
				lines: ['我切一个更明显的回应动作。', '先用他自己的动作资源顶上。'],
				mode: 'action',
				action: 'nod',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'tips',
				label: '表情',
				lines: ['现在切一个更贴近当前状态的表情。', '月饼这套也带了独立 exp 表情文件。'],
				mode: 'expression',
				expressionNames: ['kaixin', 'haixiu', 'chijing', 'nanguo', 'shengqi']
			},
			{
				id: 'wardrobe',
				label: '换装',
				lines: ['这套月饼目前只有 1 张贴图，暂时还不能直接换装。', '先把角色接进页面，后续再看有没有更多皮肤资源。'],
				mode: 'message'
			}
		]
	},
	mapodoufu: {
		id: 'mapodoufu',
		name: '麻婆豆腐',
		description: '食物语旧版 Cubism 2 模型，先接入原始动作和表情资源。',
		modelUrl: '/live2d/mapodoufu_100029/model.json',
		runtime: 'cubism2',
		defaultBubble: '麻婆豆腐已上线。',
		welcomeText: '已切换到麻婆豆腐，可以开始对话。',
		headTapMessage: '别招惹我，我可不客气。',
		motionFiles: {
			idle: 'action/idle.mtn',
			wave: 'action/shuaishou.mtn',
			nod: 'action/niulian.mtn',
			focus: 'action/shuaishou.mtn',
			tapHead: 'action/niulian.mtn',
			tapBody: 'action/shuaishou.mtn'
		},
		toolDefinitions: [
			{
				id: 'greet',
				label: '互动',
				lines: ['我换成麻婆豆腐来和你互动。', '这里会从他的动作池里随机挑一个。'],
				mode: 'action',
				action: 'focus',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'wave',
				label: '招呼',
				lines: ['这次会在麻婆豆腐的动作里随机挑一个招呼。', '先保留食物语原始动作。'],
				mode: 'action',
				action: 'wave',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'nod',
				label: '回应',
				lines: ['我切一个更明显的回应动作。', '先用他自己的动作资源顶上。'],
				mode: 'action',
				action: 'nod',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'tips',
				label: '表情',
				lines: ['现在切一个更贴近当前状态的表情。', '麻婆豆腐这套也带了独立 exp 表情文件。'],
				mode: 'expression',
				expressionNames: ['kaixin', 'haixiu', 'chijing', 'nanguo', 'shengqi']
			},
			{
				id: 'wardrobe',
				label: '换装',
				lines: ['这套麻婆豆腐目前只有 1 张贴图，暂时还不能直接换装。', '先把角色接进页面，后续再看有没有更多皮肤资源。'],
				mode: 'message'
			}
		]
	},
	shuangpinai: {
		id: 'shuangpinai',
		name: '双皮奶',
		description: '食物语旧版 Cubism 2 模型，先接入原始动作和表情资源。',
		modelUrl: '/live2d/shuangpinai_100057/model.json',
		runtime: 'cubism2',
		defaultBubble: '双皮奶已上线。',
		welcomeText: '已切换到双皮奶，可以开始对话。',
		headTapMessage: '轻一点，会弄乱发型的。',
		motionFiles: {
			idle: 'action/idle.mtn',
			wave: 'action/jushou.mtn',
			nod: 'action/fumaozi.mtn',
			focus: 'action/jushou.mtn',
			tapHead: 'action/fumaozi.mtn',
			tapBody: 'action/jushou.mtn'
		},
		toolDefinitions: [
			{
				id: 'greet',
				label: '互动',
				lines: ['我换成双皮奶来和你互动。', '这里会从她自己的动作池里随机挑一个。'],
				mode: 'action',
				action: 'focus',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'wave',
				label: '招呼',
				lines: ['这次会在双皮奶的动作里随机挑一个招呼。', '先保留食物语原始动作。'],
				mode: 'action',
				action: 'wave',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'nod',
				label: '回应',
				lines: ['我切一个更明显的回应动作。', '先用她自己的动作资源顶上。'],
				mode: 'action',
				action: 'nod',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'tips',
				label: '表情',
				lines: ['现在切一个更贴近当前状态的表情。', '双皮奶这套也带了独立 exp 表情文件。'],
				mode: 'expression',
				expressionNames: ['kaixin', 'haixiu', 'chijing', 'nanguo', 'shengqi']
			},
			{
				id: 'wardrobe',
				label: '换装',
				lines: ['这套双皮奶目前只有 1 张贴图，暂时还不能直接换装。', '先把角色接进页面，后续再看有没有更多皮肤资源。'],
				mode: 'message'
			}
		]
	},
	xiehuangtangbao: {
		id: 'xiehuangtangbao',
		name: '蟹黄汤包',
		description: '食物语旧版 Cubism 2 模型，先接入原始动作和表情资源。',
		modelUrl: '/live2d/xiehuangtangbao_100002/model.json',
		runtime: 'cubism2',
		defaultBubble: '蟹黄汤包已上线。',
		welcomeText: '已切换到蟹黄汤包，可以开始对话。',
		headTapMessage: '别闹，我可要躲开了。',
		motionFiles: {
			idle: 'action/idle.mtn',
			wave: 'action/zhuadoupeng_danshou.mtn',
			nod: 'action/suohui.mtn',
			focus: 'action/zhuadoupeng_shuangshou.mtn',
			tapHead: 'action/suohui.mtn',
			tapBody: 'action/zhuadoupeng_danshou.mtn'
		},
		toolDefinitions: [
			{
				id: 'greet',
				label: '互动',
				lines: ['我换成蟹黄汤包来和你互动。', '这里会从他的动作池里随机挑一个。'],
				mode: 'action',
				action: 'focus',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'wave',
				label: '招呼',
				lines: ['这次会在蟹黄汤包的动作里随机挑一个招呼。', '先保留食物语原始动作。'],
				mode: 'action',
				action: 'wave',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'nod',
				label: '回应',
				lines: ['我切一个更明显的回应动作。', '先用他自己的动作资源顶上。'],
				mode: 'action',
				action: 'nod',
				durationMs: 1700,
				motionCategories: ['基础动作']
			},
			{
				id: 'tips',
				label: '表情',
				lines: ['现在切一个更贴近当前状态的表情。', '蟹黄汤包这套也带了独立 exp 表情文件。'],
				mode: 'expression',
				expressionNames: ['kaixin', 'haixiu', 'chijing', 'nanguo', 'shengqi', 'xianqi']
			},
			{
				id: 'wardrobe',
				label: '换装',
				lines: ['这套蟹黄汤包目前只有 1 张贴图，暂时还不能直接换装。', '先把角色接进页面，后续再看有没有更多皮肤资源。'],
				mode: 'message'
			}
		]
	},
	mori_miko: {
		id: 'mori_miko',
		name: '狐娘角色',
		description: '新版 Cubism 4 模型，动作更完整，交互也更丰富。',
		modelUrl: '/live2d/mori_miko/mori_miko.model3.json',
		runtime: 'cubism4',
		defaultBubble: '现在切换到更完整的狐娘模型。',
		welcomeText: '现在已经切换到更完整的模型资源，可以直接和她对话与互动。',
		headTapMessage: '摸头会有点害羞。',
		motionFiles: {
			idle: 'motions/mtn_idle.motion3.json',
			wave: 'motions/mtn_qishen.motion3.json',
			nod: 'motions/head_diantou.motion3.json',
			focus: 'motions/face_haoqi.motion3.json',
			tapHead: 'motions/head_yaotou.motion3.json',
			tapBody: 'motions/mtn_shakeh.motion3.json',
			expression: 'motions/face_weixiao.motion3.json'
		},
		toolDefinitions: [
			{
				id: 'greet',
				label: '互动',
				lines: ['我先随机给你一个更自然的回应。', '这里会从狐娘模型自己的表情和头部动作里挑。'],
				mode: 'action',
				action: 'focus',
				durationMs: 1500,
				motionCategories: ['耳朵', '头部', '尾巴']
			},
			{
				id: 'wave',
				label: '身体',
				lines: ['这次会在狐娘的身体动作里随机挑一个。', '不再固定只走起身这一条。'],
				mode: 'action',
				action: 'wave',
				durationMs: 1700,
				motionCategories: ['尾巴', '耳朵']
			},
			{
				id: 'nod',
				label: '情绪',
				lines: ['这次会随机切一个更明显的情绪反馈。', '只保留能一眼看出来的表情和尾巴动作。'],
				mode: 'action',
				action: 'nod',
				durationMs: 1600,
				motionCategories: ['头部']
			},
			{
				id: 'tips',
				label: '表情',
				lines: ['现在切一个更合适的面部表情。', '狐娘模型会优先走自己的 face motion。'],
				mode: 'expression',
				expressionMotionFiles: [
					'motions/face_weixiao.motion3.json',
					'motions/face_xiao.motion3.json',
					'motions/face_haoqi.motion3.json',
					'motions/face_xingfen.motion3.json',
					'motions/face_yiwen.motion3.json'
				]
			},
			{
				id: 'wardrobe',
				label: '换装',
				lines: ['这套狐娘资源目前也只有 1 张贴图，还没有可切换的服装。', '如果后续补到多贴图 costume，再把这个按钮接成真实换装。'],
				mode: 'message'
			}
		]
	}
}

const CHARACTER_VOICES: Record<ModelId, CharacterVoice> = {
	rgm: {
		loading: '热干面正在理一下衣摆，马上来。',
		connecting: '我去帮你接一下话头，很快回来。',
		motionReady: ['看我这边，已经动起来啦。', '这次我认真回应你了。'],
		motionFailed: ['咦，这个动作刚刚没接上。', '我刚刚绊了一下，再点我一次试试。'],
		expressionReady: label => `表情已经换成“${label}”啦。`,
		expressionFailed: ['这次表情没切稳，我再缓一下。'],
		headTap: ['别总摸头呀，我会分心。', '头顶有点痒，我知道你在叫我。'],
		bodyTap: ['收到收到，我这就回应你。', '我醒着呢，再来一次也可以。']
	},
	bingtanghulu: {
		loading: '冰糖葫芦正在裹糖衣，马上就甜甜地出来。',
		connecting: '我去把甜甜的话接回来，等我一下呀。',
		motionReady: ['看见啦，我给你回一个甜甜的动作。', '这一下有回应到你吧。'],
		motionFailed: ['呀，这个动作刚刚打滑了。', '糖壳有点黏住了，再点我一次试试。'],
		expressionReady: label => `我现在是“${label}”的小表情。`,
		expressionFailed: ['表情糖纸没拆开，再试我一下嘛。'],
		headTap: ['别戳头顶啦，我会脸红的。', '你这样轻轻碰我，我会害羞。'],
		bodyTap: ['我听见你啦。', '甜甜地回你一下。']
	},
	xiajiao: {
		loading: '虾饺正在整理衣角，很快就来。',
		connecting: '我去把这句话接住，你先别走开。',
		motionReady: ['我有认真回应你喔。', '这个动作是我特意回给你的。'],
		motionFailed: ['唔，刚刚有点没接稳。', '我再准备一下，你再点我一次好不好。'],
		expressionReady: label => `现在是“${label}”的样子。`,
		expressionFailed: ['表情刚刚有点乱掉了。'],
		headTap: ['别这样摸头，我会不好意思。', '你这样碰一下，我耳尖都热了。'],
		bodyTap: ['我在听，你继续说。', '嗯，我有好好回应你。']
	},
	yuebing: {
		loading: '月饼正在站稳身形，稍等片刻。',
		connecting: '我去把话接回来，很快给你答复。',
		motionReady: ['我已经作出回应。', '这个动作算我认真答你。'],
		motionFailed: ['这次动作没有顺利触发。', '我再调整一下，你可以再试一次。'],
		expressionReady: label => `表情已切到“${label}”。`,
		expressionFailed: ['表情切换刚刚没跟上。'],
		headTap: ['别乱碰，我看着呢。', '碰头顶做什么，我可注意到了。'],
		bodyTap: ['收到。', '我已经回应你了。']
	},
	mapodoufu: {
		loading: '麻婆豆腐正在热锅，等会儿更带劲。',
		connecting: '我去把这句话拎回来，马上回你。',
		motionReady: ['行，这下算我给你面子。', '动作已经回过去了，别说我没理你。'],
		motionFailed: ['啧，这个动作刚刚没打出来。', '再来一下，我这次不掉链子。'],
		expressionReady: label => `我现在是“${label}”这副神情。`,
		expressionFailed: ['表情没切上，有点扫兴。'],
		headTap: ['别招我，不然我真要回嘴了。', '头顶不是你随便碰的地方。'],
		bodyTap: ['行，我听到了。', '这次算我回应你。']
	},
	shuangpinai: {
		loading: '双皮奶正在把裙摆理平，很快就来。',
		connecting: '我去把软乎乎的回应带回来，等我一下。',
		motionReady: ['我轻轻回你一下。', '这个动作够温柔吧。'],
		motionFailed: ['哎呀，刚刚有点慌乱。', '再试一下，我这次会接住你的。'],
		expressionReady: label => `我把表情换成“${label}”啦。`,
		expressionFailed: ['表情还没站稳，再给我一点点时间。'],
		headTap: ['轻一点啦，会弄乱发型的。', '你这样碰我，我会有点害羞。'],
		bodyTap: ['我在呢。', '嗯嗯，已经回应你啦。']
	},
	xiehuangtangbao: {
		loading: '蟹黄汤包正拢好袖口，很快现身。',
		connecting: '我去把回话端回来，稍等片刻。',
		motionReady: ['这次回应够体面吧。', '我已经把动作递给你了。'],
		motionFailed: ['刚刚没接住，失礼了。', '你再点我一次，我重新来。'],
		expressionReady: label => `我换成“${label}”的神情了。`,
		expressionFailed: ['表情没切稳，容我整理一下。'],
		headTap: ['别闹，我可要躲开了。', '头顶不是让你乱碰的。'],
		bodyTap: ['我听见了。', '这次算我正面回应你。']
	},
	mori_miko: {
		loading: '狐娘在抖耳朵啦，马上就好。',
		connecting: '我去叼一句软软的话回来，稍等喔。',
		motionReady: ['看到了吗，我有乖乖回应你。', '嘿嘿，这个动作是专门回给你的。'],
		motionFailed: ['呜，刚刚尾巴绊住了。', '再戳一下嘛，这次我会接住。'],
		expressionReady: label => `我换成“${label}”啦，好看吗？`,
		expressionFailed: ['表情刚刚没切上，再试我一次嘛。'],
		headTap: ['摸头的话，我会有点害羞喔。', '耳朵都要竖起来啦。'],
		bodyTap: ['唔，我在听呢。', '有感受到你在叫我啦。']
	}
}

const SWITCHABLE_MODEL_OPTIONS = Object.values(MODEL_OPTIONS).filter((modelOption) => modelOption.id !== 'mori_miko')

const scriptLoadCache = new Map<string, Promise<void>>()

function sleep(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function waitFor(check: () => boolean, timeoutMs = 6000) {
	return new Promise<void>((resolve, reject) => {
		const startedAt = Date.now()

		const tick = () => {
			if (check()) {
				resolve()
				return
			}

			if (Date.now() - startedAt > timeoutMs) {
				reject(new Error('Timed out while waiting for script runtime'))
				return
			}

			window.setTimeout(tick, 50)
		}

		tick()
	})
}

function loadScript(src: string, checkReady?: () => boolean): Promise<void> {
	if (checkReady?.()) {
		return Promise.resolve()
	}

	const cached = scriptLoadCache.get(src)
	if (cached) {
		return cached
	}

	const promise = new Promise<void>((resolve, reject) => {
		const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null

		const finalize = () => {
			if (!checkReady) {
				resolve()
				return
			}

			waitFor(checkReady).then(resolve).catch(reject)
		}

		if (existing) {
			finalize()
			return
		}

		const script = document.createElement('script')
		script.src = src
		script.crossOrigin = 'anonymous'
		script.async = false
		script.onload = () => finalize()
		script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
		document.head.appendChild(script)
	})

	scriptLoadCache.set(src, promise)
	return promise
}

function isPixiRuntimeReady() {
	const win = window as unknown as {
		PIXI?: {
			Application?: unknown
			Ticker?: unknown
			utils?: {
				EventEmitter?: unknown
			}
		}
	}

	return Boolean(win.PIXI?.Application && win.PIXI?.Ticker && win.PIXI?.utils?.EventEmitter)
}

function resetScriptState(src: string) {
	scriptLoadCache.delete(src)
	document.querySelector(`script[src="${src}"]`)?.remove()
}

function resetLive2DGlobals() {
	const win = window as unknown as {
		Live2D?: unknown
		Live2DCubismCore?: unknown
		Live2DModel?: unknown
		PIXI?: {
			live2d?: unknown
			Live2DModel?: unknown
		}
	}

	delete win.Live2DModel

	if (win.PIXI) {
		delete win.PIXI.live2d
		delete win.PIXI.Live2DModel
	}
}

function resetLive2DRuntime(runtime: RuntimeType) {
	resetScriptState(CUBISM2_RUNTIME_SCRIPT)
	resetScriptState(CUBISM2_SCRIPT)
	resetScriptState(CUBISM4_CORE_SCRIPT)
	resetScriptState(CUBISM4_SCRIPT)
	resetLive2DGlobals()

	const win = window as unknown as {
		Live2D?: unknown
		Live2DCubismCore?: unknown
	}

	if (runtime === 'cubism4') {
		delete win.Live2D
		return
	}

	delete win.Live2DCubismCore
}

function pickRandom<T>(items: T[]) {
	return items[Math.floor(Math.random() * items.length)]
}

function getCharacterVoice(modelId: ModelId) {
	return CHARACTER_VOICES[modelId]
}

function buildToolBubble(modelId: ModelId, toolId: ToolId) {
	const modelName = MODEL_OPTIONS[modelId].name

	switch (toolId) {
		case 'greet':
			return pickRandom([`你好呀，我是${modelName}。`, `我来啦，这次认真和你打个招呼。`])
		case 'wave':
			return pickRandom(['看我挥挥手，先和你碰个面。', '这一下算是把招呼递到你面前啦。'])
		case 'nod':
			return pickRandom(['嗯，我有在认真听你说。', '收到啦，我点点头回你。'])
		case 'tips':
			return pickRandom(['我换个更贴脸的表情给你看看。', '让我挑一个现在更像我心情的小表情。'])
		case 'wardrobe':
			return pickRandom(['先别急着翻衣柜，我还在轮流试角色呢。', '今天先让我换个角色继续陪你。'])
		default:
			return `${modelName}在这里。`
	}
}

function buildQuickPrompts(modelId: ModelId) {
	switch (modelId) {
		case 'rgm':
			return ['你今天心情怎么样？', '你最擅长什么互动？', '陪我想一个博客标题', '给我一句可爱的晚安']
		case 'bingtanghulu':
			return ['你今天甜度够吗？', '用撒娇口吻打个招呼', '夸夸我今天的状态', '讲一句软软的安慰']
		case 'xiajiao':
			return ['你会怎么安慰人？', '今天要不要一起摸鱼？', '给我一句温柔回复', '你最喜欢什么表情？']
		case 'yuebing':
			return ['用认真一点的语气回复我', '今天适合做什么？', '给我一句稳重建议', '你会怎么介绍自己？']
		case 'mapodoufu':
			return ['嘴硬地夸我一句', '你现在在想什么？', '给我一句带点脾气的回复', '今天适合推进什么任务？']
		case 'shuangpinai':
			return ['说一句温柔的话', '今天可以怎样放松？', '给我一句贴心提醒', '你会怎么哄人？']
		case 'xiehuangtangbao':
			return ['正式一点地和我打招呼', '给我一句像管家一样的提醒', '你最擅长什么互动？', '今天适合做什么计划？']
		case 'mori_miko':
			return ['用狐娘语气和我打招呼', '给我一个可爱的表情建议', '今天想和我聊什么？', '夸夸我一下嘛']
		default:
			return defaultTipsConfig.quickPrompts.slice(0, 4)
	}
}

function buildDirectToolMotion(model: ModelDefinition, toolId: ToolId) {
	if (model.id === 'rgm') {
		switch (toolId) {
			case 'greet':
				return 'action/reshen.mtn'
			case 'wave':
				return 'action/zhaohu.mtn'
			case 'nod':
				return 'action/yaotou.mtn'
			default:
				return undefined
		}
	}

	switch (toolId) {
		case 'greet':
			return model.motionFiles.focus
		case 'wave':
			return model.motionFiles.wave
		case 'nod':
			return model.motionFiles.nod
		default:
			return undefined
	}
}

function buildDirectExpressionName(modelId: ModelId, currentExpressionName?: string | null) {
	const labels = EXPRESSION_LABELS[modelId]
	if (!labels) return undefined

	let candidates = Object.keys(labels).filter((name) => name !== 'idle')
	if (modelId === 'rgm') {
		const strongerCandidates = ['shengqi', 'chijing', 'haixiu', 'kaixin', 'renzhen', 'nanguo'].filter((name) =>
			candidates.includes(name)
		)
		if (strongerCandidates.length) {
			candidates = strongerCandidates
		}
	}
	if (currentExpressionName && candidates.length > 1) {
		candidates = candidates.filter((name) => name !== currentExpressionName)
	}
	return candidates.length ? pickRandom(candidates) : undefined
}

function pickToolMotionFromCatalog(modelId: ModelId, toolId: ToolId, catalog: ModelAssetCatalog) {
	if (modelId !== 'rgm') return undefined

	const visibleMotions = filterVisibleMotions(modelId, catalog.motions).filter((motion) => !motion.file.includes('idle'))
	if (!visibleMotions.length) return undefined

	const keywordsByTool: Partial<Record<ToolId, string[]>> = {
		greet: ['xiangzhi', 'reshen', 'zhaohu'],
		wave: ['zhaohu', 'reshen', 'xiangzhi'],
		nod: ['diantou', 'yaotou', 'xiangzhi']
	}

	const keywords = keywordsByTool[toolId]
	if (!keywords?.length) return undefined

	for (const keyword of keywords) {
		const matchedMotion = visibleMotions.find((motion) => motion.file.includes(keyword) || motion.name.includes(keyword))
		if (matchedMotion) {
			return matchedMotion
		}
	}

	return visibleMotions[0]
}

function buildFallbackReply(modelId: ModelId, input: string) {
	const text = input.trim().toLowerCase()
	const voice = getCharacterVoice(modelId)

	if (!text) return '你还没把话说完呢。'
	if (text.includes('你好') || text.includes('hi') || text.includes('hello')) {
		return pickRandom([`你好呀，我是${MODEL_OPTIONS[modelId].name}。`, '我在这里，听你说。'])
	}
	if (text.includes('项目')) {
		return '你可以先去项目页逛一圈，再回来陪我继续打磨动作和互动。'
	}
	if (text.includes('动作') || text.includes('motion')) {
		return '动作这块还在继续补，我也想把回应做得更灵一点。'
	}
	if (text.includes('换装') || text.includes('衣服') || text.includes('texture')) {
		return '现在这套资源还不够完整，等衣柜补齐了我就能认真换装啦。'
	}
	if (text.includes('对话') || text.includes('聊天')) {
		return '聊天链路已经接上了，下一步就是把动作、表情和语气一起磨圆。'
	}
	if (text.includes('升级')) {
		return '下一步先把可点动作和表情稳定住，再继续补更完整的模型资源。'
	}
	if (text.includes('cotton') || text.includes('棉花')) {
		return 'Cotton 正在把我养成站里的常驻小助手呢。'
	}

	return pickRandom([...voice.bodyTap, '接口这会儿有点忙，我先用本地回复陪你聊。'])
}

function ToolIcon({ toolId }: { toolId: string }) {
	const baseClass = 'h-[22px] w-[22px] stroke-[1.8]'

	switch (toolId) {
		case 'greet':
			return (
				<svg viewBox='0 0 24 24' fill='none' className={baseClass} aria-hidden='true'>
					<path d='M4 7h11a5 5 0 0 1 0 10H9l-4 3v-3H4a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
					<path d='M18 5l1-2m2 4 2-1m-5 5 2 1' stroke='currentColor' strokeLinecap='round' />
				</svg>
			)
		case 'wave':
			return (
				<svg viewBox='0 0 24 24' fill='none' className={baseClass} aria-hidden='true'>
					<path d='M9 21v-8.5a1.5 1.5 0 1 1 3 0V14a1.5 1.5 0 1 1 3 0v1a1.5 1.5 0 1 1 3 0v1c0 2.8-2.2 5-5 5H9Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
					<path d='M9 13V5.5a1.5 1.5 0 1 1 3 0V10m0-2.5a1.5 1.5 0 1 1 3 0V11' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
					<path d='M5 6c1-1.2 1-2.8 0-4m3 5c1.2-1.5 1.2-3.5 0-5.2' stroke='currentColor' strokeLinecap='round' />
				</svg>
			)
		case 'nod':
			return (
				<svg viewBox='0 0 24 24' fill='none' className={baseClass} aria-hidden='true'>
					<path d='M12 4v8m0 0 3-3m-3 3-3-3' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
					<path d='M6 15.5A6 6 0 0 0 12 20a6 6 0 0 0 6-4.5' stroke='currentColor' strokeLinecap='round' />
				</svg>
			)
		case 'tips':
			return (
				<svg viewBox='0 0 24 24' fill='none' className={baseClass} aria-hidden='true'>
					<path d='M12 3 14.6 8.4 20 9.3l-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.4-.9L12 3Z' stroke='currentColor' strokeLinejoin='round' />
				</svg>
			)
		case 'wardrobe':
			return (
				<svg viewBox='0 0 24 24' fill='none' className={baseClass} aria-hidden='true'>
					<path d='M9 5a3 3 0 1 0 6 0l4 2.5-2.2 3.3-1.8-1.2V20H9V9.6L7.2 10.8 5 7.5 9 5Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
				</svg>
			)
		default:
			return (
				<svg viewBox='0 0 24 24' fill='none' className={baseClass} aria-hidden='true'>
					<circle cx='12' cy='12' r='8' stroke='currentColor' />
					<path d='M12 9v3.5m0 3h.01' stroke='currentColor' strokeLinecap='round' />
				</svg>
			)
	}
}

function buildMotionHandles(data: any): MotionHandle[] {
	if (data?.FileReferences) {
		return Object.entries(data.FileReferences.Motions ?? {}).flatMap(([group, items]) =>
			Array.isArray(items)
				? items
						.map((item, index) => ({ group, index, file: item?.File }))
						.filter((item): item is MotionHandle => Boolean(item.file))
				: []
		)
	}

	return Object.entries(data?.motions ?? {}).flatMap(([group, items]) =>
		Array.isArray(items)
			? items
					.map((item, index) => ({ group, index, file: item?.file }))
					.filter((item): item is MotionHandle => Boolean(item.file))
			: []
	)
}

function playMotionFile(
	model: Live2DModelInstance | null,
	motionHandles: MotionHandle[],
	targetFile: string | undefined
) {
	if (!model || !targetFile) return false

	const targetMotion = motionHandles.find((item) => item.file === targetFile)
	if (!targetMotion) return false

	const group = targetMotion.group || DEFAULT_MOTION_GROUP
	let played = false

	try {
		model.internalModel?.motionManager?.stopAllMotions?.()
		model.internalModel?.motionManager?._stopAllMotions?.()
	} catch {
		// ignore
	}

	try {
		if (model.internalModel?.startMotion) {
			model.internalModel.startMotion(group, targetMotion.index, 4)
			played = true
		}
	} catch {
		// ignore
	}

	try {
		if (model.motion) {
			void model.motion(group, targetMotion.index, 4)
			played = true
		}
	} catch {
		// ignore
	}

	return played
}

function playModelMotion(
	model: Live2DModelInstance | null,
	motionHandles: MotionHandle[],
	modelDefinition: ModelDefinition,
	action: ActionType | 'tapHead' | 'tapBody' | 'expression'
) {
	return playMotionFile(model, motionHandles, modelDefinition.motionFiles[action])
}

function applyLegacyExpression(model: Live2DModelInstance | null, expressionName: string) {
	if (!model?.internalModel) return false

	const internalModel = model.internalModel as typeof model.internalModel & {
		expressionManager?: {
			setExpression?: (name: string) => void
		}
	}

	let played = false

	try {
		if (internalModel.expressionManager?.setExpression) {
			internalModel.expressionManager.setExpression(expressionName)
			played = true
		}
	} catch {
		// ignore
	}

	try {
		if (internalModel.setExpression) {
			internalModel.setExpression(expressionName)
			played = true
		}
	} catch {
		// ignore
	}

	return played
}

function playModelExpression(
	model: Live2DModelInstance | null,
	motionHandles: MotionHandle[],
	toolDefinition: ModelToolDefinition
) {
	if (toolDefinition.expressionNames?.length && model) {
		const nextExpression = pickRandom(toolDefinition.expressionNames)
		let played = applyLegacyExpression(model, nextExpression)

		try {
			if (model.expression) {
				void model.expression(nextExpression)
				played = true
			}
		} catch {
			// ignore
		}

		if (played) {
			return true
		}
	}

	if (toolDefinition.expressionMotionFiles?.length) {
		return playMotionFile(model, motionHandles, pickRandom(toolDefinition.expressionMotionFiles))
	}

	return false
}

function readMotionFiles(data: any): string[] {
	if (data?.FileReferences) {
		return Object.values(data.FileReferences.Motions ?? {}).flatMap((group) =>
			Array.isArray(group) ? group.map((item) => item?.File).filter(Boolean) : []
		)
	}

	return Object.values(data?.motions ?? {}).flatMap((group) =>
		Array.isArray(group) ? group.map((item) => item?.file).filter(Boolean) : []
	)
}

function toMotionName(file: string) {
	const fileName = file.split('/').pop() || file
	return fileName
		.replace('.motion3.json', '')
		.replace('.mtn', '')
		.replace(/_/g, ' ')
}

function toMotionCategory(file: string) {
	const fileName = file.split('/').pop() || file
	const baseName = fileName
		.replace('.motion3.json', '')
		.replace('.mtn', '')

	if (!baseName.includes('_')) return '基础动作'

	const prefix = baseName.split('_')[0]
	const categoryMap: Record<string, string> = {
		breath: '呼吸',
		ear: '耳朵',
		eye: '眼睛',
		face: '表情',
		hair: '头发',
		head: '头部',
		mtn: '身体',
		tail: '尾巴',
		action: '动作'
	}

	return categoryMap[prefix] || prefix
}

function resolveExpressionLabel(modelId: ModelId, name: string) {
	return EXPRESSION_LABELS[modelId]?.[name] || name
}

function readModelCatalog(data: any, modelId: ModelId): ModelAssetCatalog {
	const motions = data?.FileReferences
		? Object.entries(data.FileReferences.Motions ?? {}).flatMap(([group, items]) =>
			Array.isArray(items)
				? items
					.map((item) => item?.File)
					.filter(Boolean)
					.map((file) => ({
						group,
						file,
						name: toMotionName(file),
						category: toMotionCategory(file)
					}))
				: []
		  )
		: Object.entries(data?.motions ?? {}).flatMap(([group, items]) =>
			Array.isArray(items)
				? items
					.map((item) => item?.file)
					.filter(Boolean)
					.map((file) => ({
						group,
						file,
						name: toMotionName(file),
						category: '基础动作'
					}))
				: []
		  )

	const expressions = data?.FileReferences
		? []
		: Array.isArray(data?.expressions)
			? data.expressions.map((item: any) => ({
				name: item?.name || toMotionName(item?.file || 'expression'),
				file: item?.file,
				label: resolveExpressionLabel(modelId, item?.name || toMotionName(item?.file || 'expression'))
			  }))
			: []

	return {
		motions,
		expressions
	}
}

function readExpressionCount(data: any) {
	if (data?.FileReferences) {
		const refs = data.FileReferences
		const motionFiles = readMotionFiles(data)
		const hasExpressionFiles = Array.isArray(refs.Expressions) && refs.Expressions.length > 0
		const hasFaceMotions = motionFiles.some((file) => typeof file === 'string' && file.includes('face_'))
		return hasExpressionFiles || hasFaceMotions
	}

	return Array.isArray(data?.expressions) && data.expressions.length > 0
}

function readTextureCount(data: any) {
	if (data?.FileReferences) {
		return Array.isArray(data.FileReferences.Textures) ? data.FileReferences.Textures.length : 0
	}

	return Array.isArray(data?.textures) ? data.textures.length : 0
}

async function readModelMeta(modelDefinition: ModelDefinition): Promise<ViewerMeta> {
	const response = await fetch(modelDefinition.modelUrl, { cache: 'no-store' })
	if (!response.ok) {
		throw new Error('Failed to load model metadata')
	}

	const data = await response.json()
	const motionFiles = readMotionFiles(data)

	return {
		hasMotions: motionFiles.length > 0,
		hasExpressions: readExpressionCount(data),
		textureCount: readTextureCount(data),
		motionCount: motionFiles.length
	}
}

async function readTipsConfig(): Promise<Live2DTipsConfig> {
	try {
		const response = await fetch(TIPS_URL, { cache: 'no-store' })
		if (!response.ok) return defaultTipsConfig
		const data = (await response.json()) as Partial<Live2DTipsConfig>
		return {
			idleHints: data.idleHints?.length ? data.idleHints : defaultTipsConfig.idleHints,
			hoverHints: data.hoverHints?.length ? data.hoverHints : defaultTipsConfig.hoverHints,
			tapHints: data.tapHints?.length ? data.tapHints : defaultTipsConfig.tapHints,
			quickPrompts: data.quickPrompts?.length ? data.quickPrompts : defaultTipsConfig.quickPrompts,
			toolHints: data.toolHints?.length ? data.toolHints : defaultTipsConfig.toolHints
		}
	} catch {
		return defaultTipsConfig
	}
}

async function resolveLive2DModelCtor(runtime: RuntimeType) {
	let hasCubism4Core = false

	for (let index = 0; index < 5; index += 1) {
		const win = window as unknown as {
			Live2DCubismCore?: unknown
			Live2D?: unknown
			PIXI?: {
				live2d?: {
					Live2DModel?: {
						from: (url: string) => Promise<Live2DModelInstance>
					}
				}
				Live2DModel?: {
					from: (url: string) => Promise<Live2DModelInstance>
				}
			}
			Live2DModel?: {
				from: (url: string) => Promise<Live2DModelInstance>
			}
		}

		hasCubism4Core = Boolean(win.Live2DCubismCore)

		const ctor =
			win.PIXI?.live2d?.Live2DModel ||
			win.PIXI?.Live2DModel ||
			win.Live2DModel

		if (runtime === 'cubism4' && win.Live2DCubismCore && ctor) {
			return ctor
		}

		if (runtime === 'cubism2' && win.Live2D && ctor) {
			return ctor
		}

		await sleep(120)
	}

	if (runtime === 'cubism4' && !hasCubism4Core) {
		throw new Error('Live2D Cubism Core runtime not found on window')
	}

	if (runtime === 'cubism2') {
		throw new Error('Live2D Cubism 2 runtime not found on window')
	}

	throw new Error('Live2DModel constructor not found on window')
}

function isCompactViewport(width: number) {
	return width < 640
}

function resolveModelLayout(modelId: ModelId, stageWidth: number) {
	const compact = isCompactViewport(stageWidth)

	if (!compact) {
		if (modelId === 'rgm') {
			return {
				widthRatio: 0.7,
				heightRatio: 0.94,
				minScale: 0.12,
				centerYRatio: 0.975
			}
		}

		return {
			widthRatio: 0.72,
			heightRatio: 0.94,
			minScale: 0.12,
			centerYRatio: 0.975
		}
	}

	if (modelId === 'rgm') {
		return {
			widthRatio: 0.68,
			heightRatio: 0.78,
			minScale: 0.1,
			centerYRatio: 0.985
		}
	}

	return {
		widthRatio: 0.7,
		heightRatio: 0.8,
		minScale: 0.1,
		centerYRatio: 0.985
	}
}

function inferActionFromMotionFile(file: string): ActionType {
	if (file.includes('diantou')) return 'nod'
	if (file.includes('zhaohu') || file.includes('qishen') || file.includes('shake')) return 'wave'
	if (file.includes('face_') || file.includes('xiangzhi') || file.includes('haoqi')) return 'focus'
	return 'focus'
}

function pickMotionFromCategories(
	catalog: ModelAssetCatalog,
	categories: string[] | undefined,
	excludePatterns: string[] = []
) {
	const motions = categories?.length
		? catalog.motions.filter((motion) => categories.includes(motion.category))
		: catalog.motions

	const filtered = motions.filter(
		(motion) => !excludePatterns.some((pattern) => motion.file.includes(pattern) || motion.name.includes(pattern))
	)

	if (!filtered.length) return undefined
	return pickRandom(filtered)
}

function filterVisibleMotions(modelId: ModelId, motions: ModelMotionEntry[]) {
	if (modelId === 'rgm') {
		return motions
	}

	return motions.filter((motion) => {
		return MORI_MIKO_VISIBLE_MOTION_FILES.has(motion.file)
	})
}

function filterVisibleExpressions(modelId: ModelId, expressions: ModelExpressionEntry[], motions: ModelMotionEntry[]) {
	if (modelId === 'rgm') {
		return expressions
	}

	return []
}

function buildCuratedMotionGroups(modelId: ModelId, motions: ModelMotionEntry[]): CuratedMotionGroup[] {
	const visible = filterVisibleMotions(modelId, motions)
	const groupOrder =
		modelId === 'rgm'
			? ['基础动作']
			: ['尾巴', '耳朵', '头部']

	return groupOrder
		.map((title) => ({
			title,
			motions: visible.filter((motion) => motion.category === title)
		}))
		.filter((group) => group.motions.length > 0)
}

export default function Live2DViewer() {
	const containerRef = useRef<HTMLDivElement>(null)
	const stageCardRef = useRef<HTMLDivElement>(null)
	const mobilePanelRef = useRef<HTMLDivElement>(null)
	const stageShellRef = useRef<HTMLDivElement>(null)
	const desktopInputRef = useRef<HTMLTextAreaElement>(null)
	const mobileInputRef = useRef<HTMLTextAreaElement>(null)
	const desktopChatListRef = useRef<HTMLDivElement>(null)
	const mobileChatListRef = useRef<HTMLDivElement>(null)
	const mobileComposerDockRef = useRef<HTMLDivElement>(null)
	const speechRecognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null)
	const voiceSeedTextRef = useRef('')
	const latestChatInputRef = useRef('')
	const bubbleTimerRef = useRef<number | null>(null)
	const actionRunnerRef = useRef<(toolId: string) => void>(() => undefined)
	const actionControllerRef = useRef<ActionController>({ run: () => undefined })
	const currentExpressionNameRef = useRef<string | null>(null)
	const assetControllerRef = useRef<AssetController>({
		playMotion: () => undefined,
		playExpression: () => undefined
	})
	const sessionIdRef = useRef(`visitor-${Date.now()}`)
	const [selectedModelId, setSelectedModelId] = useState<ModelId>('rgm')
	const selectedModel = MODEL_OPTIONS[selectedModelId]

	const [status, setStatus] = useState<ViewerStatus>('loading')
	const [errorMsg, setErrorMsg] = useState('')
	const [message, setMessage] = useState(selectedModel.defaultBubble)
	const [isMessageVisible, setIsMessageVisible] = useState(true)
	const [activeExpressionLabel, setActiveExpressionLabel] = useState(resolveExpressionLabel(selectedModel.id, 'idle'))
	const [chatInput, setChatInput] = useState('')
	const [followCursor, setFollowCursor] = useState(true)
	const [isChatLoading, setIsChatLoading] = useState(false)
	const [isCompactLayout, setIsCompactLayout] = useState(false)
	const [mobileDockHeight, setMobileDockHeight] = useState(112)
	const [mobileViewportOffset, setMobileViewportOffset] = useState(0)
	const [isMobileComposerFocused, setIsMobileComposerFocused] = useState(false)
	const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
	const [voiceHint, setVoiceHint] = useState('点麦克风，把话先转成文字')
	const [tipsConfig, setTipsConfig] = useState<Live2DTipsConfig>(defaultTipsConfig)
	const [chatHistory, setChatHistory] = useState<ChatEntry[]>([])
	const [meta, setMeta] = useState<ViewerMeta>({
		hasMotions: false,
		hasExpressions: false,
		textureCount: 0,
		motionCount: 0
	})
	const [assetCatalog, setAssetCatalog] = useState<ModelAssetCatalog>({
		motions: [],
		expressions: []
	})

	const showBubbleMessage = (nextMessage: string, durationMs = 3200) => {
		setMessage(nextMessage)
		setIsMessageVisible(true)
		if (bubbleTimerRef.current) {
			window.clearTimeout(bubbleTimerRef.current)
		}
		bubbleTimerRef.current = window.setTimeout(() => {
			setIsMessageVisible(false)
			bubbleTimerRef.current = null
		}, durationMs)
	}

	const scrollToStageCard = () => {
		stageCardRef.current?.scrollIntoView({
			block: 'start',
			behavior: 'smooth'
		})
	}

	const scrollToMobilePanel = () => {
		mobilePanelRef.current?.scrollIntoView({
			block: 'start',
			behavior: 'smooth'
		})
	}

	const mergeVoiceText = (seed: string, transcript: string) => {
		const normalizedTranscript = transcript.trim()
		if (!normalizedTranscript) return seed

		const normalizedSeed = seed.trimEnd()
		if (!normalizedSeed) {
			return normalizedTranscript.slice(0, 120)
		}

		const separator = /[。！？.!?,，]$/.test(normalizedSeed) ? '' : ' '
		return `${normalizedSeed}${separator}${normalizedTranscript}`.slice(0, 120)
	}

	const stopVoiceRecognition = () => {
		speechRecognitionRef.current?.stop()
	}

	const startVoiceRecognition = () => {
		const recognition = speechRecognitionRef.current
		if (!recognition) {
			setVoiceStatus('unsupported')
			setVoiceHint('当前浏览器不支持语音输入')
			showBubbleMessage('这台设备暂时不支持语音输入，我们继续打字聊。', 2200)
			return
		}

		voiceSeedTextRef.current = chatInput
		setVoiceHint('我在认真听，你慢慢说。')
		try {
			recognition.start()
		} catch {
			setVoiceStatus('error')
			setVoiceHint('语音输入暂时没启动起来，请再点一次')
		}
	}

	const toggleVoiceRecognition = () => {
		if (voiceStatus === 'listening') {
			stopVoiceRecognition()
			return
		}
		startVoiceRecognition()
	}

	useEffect(() => {
		void readTipsConfig().then(setTipsConfig)
	}, [])

	useEffect(() => {
		latestChatInputRef.current = chatInput
	}, [chatInput])

	useEffect(() => {
		const RecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition
		if (!RecognitionCtor) {
			setVoiceStatus('unsupported')
			setVoiceHint('当前浏览器不支持语音输入')
			return
		}

		const recognition = new RecognitionCtor()
		recognition.lang = 'zh-CN'
		recognition.continuous = false
		recognition.interimResults = true
		recognition.maxAlternatives = 1

		recognition.onstart = () => {
			setVoiceStatus('listening')
			setVoiceHint('正在听你说话，松开后文字会留在输入框里')
		}

		recognition.onresult = (event) => {
			let transcript = ''

			for (let index = event.resultIndex; index < event.results.length; index += 1) {
				const result = event.results[index]
				const alternative = result?.item(0) ?? result?.[0]
				if (!alternative?.transcript) continue
				transcript += alternative.transcript
			}

			if (!transcript.trim()) return
			setChatInput(mergeVoiceText(voiceSeedTextRef.current, transcript))
		}

		recognition.onerror = (event) => {
			if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
				setVoiceStatus('denied')
				setVoiceHint('没有拿到麦克风权限，请在浏览器里允许麦克风')
				showBubbleMessage('麦克风权限没打开，先允许一下我才能帮你听写。', 2600)
				return
			}

			if (event.error === 'no-speech') {
				setVoiceStatus('idle')
				setVoiceHint('刚才没有听清，再说一次也可以')
				return
			}

			setVoiceStatus('error')
			setVoiceHint('这次没有顺利识别出来，请再试一次')
		}

		recognition.onend = () => {
			setVoiceStatus((current) => (current === 'unsupported' || current === 'denied' ? current : 'idle'))
			setVoiceHint((current) => {
				if (current.includes('权限')) return current
				if (latestChatInputRef.current.trim()) return '识别结果已经放进输入框，可以改一改再发'
				return '点麦克风，把话先转成文字'
			})
		}

		speechRecognitionRef.current = recognition

		return () => {
			recognition.onstart = null
			recognition.onresult = null
			recognition.onerror = null
			recognition.onend = null
			recognition.abort()
			speechRecognitionRef.current = null
		}
	}, [])

	useEffect(() => {
		const syncLayout = () => {
			setIsCompactLayout(window.innerWidth < 640)
		}

		syncLayout()
		window.addEventListener('resize', syncLayout)

		return () => {
			window.removeEventListener('resize', syncLayout)
		}
	}, [])

	useEffect(() => {
		showBubbleMessage(selectedModel.defaultBubble, 2600)
		currentExpressionNameRef.current = null
		setActiveExpressionLabel(resolveExpressionLabel(selectedModel.id, 'idle'))
		setChatHistory([])
		setAssetCatalog({
			motions: [],
			expressions: []
		})
	}, [selectedModel])

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
		let motionFiles: string[] = []
		let motionHandles: MotionHandle[] = []
		let modelCatalog: ModelAssetCatalog = { motions: [], expressions: [] }
		let currentExpressionName: string | null = null
		let pendingExpressionRefresh = false
		let pendingExpressionRestore = false
		let expressionRestoreName: string | null = null
		let pendingIdleRestore = false
		let lastPointerY = 0
		let baseScale = 0.18
		let fitPasses = 0

		const voice = getCharacterVoice(selectedModel.id)

		const resolveBaseExpressionName = () => {
			return currentExpressionName || modelCatalog.expressions.find((item) => item.name === 'idle')?.name || null
		}

		const applyExpression = (expressionName: string, label: string, showMessage = true, persist = true) => {
			if (!model) return false
			let applied = applyLegacyExpression(model, expressionName)

			try {
				if (model.expression) {
					void model.expression(expressionName)
					applied = true
				}
			} catch {
				// ignore
			}

			if (!applied) {
				return false
			}

			if (persist) {
				currentExpressionName = expressionName
				currentExpressionNameRef.current = expressionName
				setActiveExpressionLabel(label)
			}
			pendingExpressionRefresh = false
			action = 'focus'
			actionExpiresAt = performance.now() + 1400
			if (showMessage) {
				showBubbleMessage(voice.expressionReady(label))
			}
			return true
		}

		const resizeTargets = () => {
			if (!container || !model) return
			fitModelToStage()
			const width = container.clientWidth || 720
			const height = container.clientHeight || 720
			const layout = resolveModelLayout(selectedModel.id, width)
			centerX = width / 2
			centerY = height * layout.centerYRatio
			targetX = centerX
			targetY = centerY
			currentX = centerX
			currentY = centerY
			model.x = centerX
			model.y = centerY
		}

		const resizeCanvas = () => {
			if (!container) return
			const nextWidth = container.clientWidth || 720
			const nextHeight = container.clientHeight || 720
			app?.renderer?.resize(nextWidth, nextHeight)
		}

		const fitModelToStage = () => {
			if (!container || !model) return

			const stageWidth = container.clientWidth || 720
			const stageHeight = container.clientHeight || 720
			const layout = resolveModelLayout(selectedModel.id, stageWidth)

			model.scale.set(1, 1)
			const rawWidth = model.width || 0
			const rawHeight = model.height || 0

			if (rawWidth <= 0 || rawHeight <= 0) {
				baseScale = layout.minScale
				return
			}

			const widthScale = (stageWidth * layout.widthRatio) / rawWidth
			const heightScale = (stageHeight * layout.heightRatio) / rawHeight
			baseScale = Math.max(layout.minScale, Math.min(widthScale, heightScale))
			model.scale.set(baseScale, baseScale)
		}

		const handlePointerDown = (event: PointerEvent) => {
			const bounds = container.getBoundingClientRect()
			lastPointerY = event.clientY - bounds.top
		}

		const playAction = (nextAction: ActionType, hint: string, durationMs = 900, useNativeMotion = true) => {
			action = nextAction
			actionExpiresAt = performance.now() + durationMs
			if (useNativeMotion) {
				const played = playModelMotion(model, motionHandles, selectedModel, nextAction)
				if (played && nextAction !== 'idle') {
					pendingIdleRestore = true
				}
			}
			showBubbleMessage(hint)
		}

		actionControllerRef.current = {
			run: (nextAction, hint, durationMs = 900) => {
				playAction(nextAction, hint, durationMs)
			}
		}

		assetControllerRef.current = {
			playMotion: (motionFile, label) => {
				const played = playMotionFile(model, motionHandles, motionFile)
				if (!played) {
					showBubbleMessage(pickRandom(voice.motionFailed))
					return
				}
				pendingIdleRestore = motionFile !== selectedModel.motionFiles.idle
				pendingExpressionRefresh = Boolean(currentExpressionName)
				action = inferActionFromMotionFile(motionFile)
				actionExpiresAt = performance.now() + 1700
				showBubbleMessage(`${pickRandom(voice.motionReady)}${label ? ` 这是“${label}”动作。` : ''}`)
			},
			playExpression: (expressionName, label) => {
				const restoreName = resolveBaseExpressionName()
				const played =
					applyExpression(expressionName, label, false, false) ||
					playModelExpression(model, motionHandles, {
					id: 'tips',
					label,
					lines: [voice.expressionReady(label)],
					mode: 'expression',
					expressionNames: [expressionName],
					expressionMotionFiles: []
				})

				if (!played) {
					showBubbleMessage(pickRandom(voice.expressionFailed))
					return
				}

				expressionRestoreName = restoreName
				pendingExpressionRestore = Boolean(restoreName)
				pendingExpressionRefresh = false
				action = 'focus'
				actionExpiresAt = performance.now() + 1400
				showBubbleMessage(voice.expressionReady(label))
			}
		}

		actionRunnerRef.current = (toolId: string) => {
			const toolDefinition = selectedModel.toolDefinitions.find((item) => item.id === toolId)
			if (!toolDefinition) return

			const hintText = buildToolBubble(selectedModel.id, toolDefinition.id)
			const visibleCatalog = { ...modelCatalog, motions: filterVisibleMotions(selectedModel.id, modelCatalog.motions) }

			if (toolDefinition.mode === 'message') {
				showBubbleMessage(hintText)
				return
			}

			if (toolDefinition.mode === 'expression') {
				const nextExpressionName =
					selectedModel.id === 'rgm'
						? buildDirectExpressionName(selectedModel.id, currentExpressionNameRef.current)
						: toolDefinition.expressionNames?.length
							? pickRandom(toolDefinition.expressionNames)
							: undefined
				const nextExpressionLabel = nextExpressionName ? resolveExpressionLabel(selectedModel.id, nextExpressionName) : toolDefinition.label
				const restoreName = resolveBaseExpressionName()
				const played =
					(nextExpressionName ? applyExpression(nextExpressionName, nextExpressionLabel, false, false) : false) ||
					playModelExpression(model, motionHandles, {
						...toolDefinition,
						expressionNames: nextExpressionName ? [nextExpressionName] : toolDefinition.expressionNames
					})
				if (!played) {
					playModelMotion(model, motionHandles, selectedModel, 'expression')
					pendingExpressionRefresh = Boolean(currentExpressionName)
					showBubbleMessage(pickRandom(voice.expressionFailed))
				} else if (toolDefinition.expressionNames?.length) {
					expressionRestoreName = restoreName
					pendingExpressionRestore = Boolean(restoreName)
					pendingExpressionRefresh = false
					showBubbleMessage(voice.expressionReady(nextExpressionLabel))
				}
				return
			}

			if (toolDefinition.action) {
				if (selectedModel.id === 'rgm') {
					const preferredMotion = pickToolMotionFromCatalog(selectedModel.id, toolDefinition.id, visibleCatalog)
					if (preferredMotion) {
						const played = playMotionFile(model, motionHandles, preferredMotion.file)
						if (played) {
							pendingIdleRestore = preferredMotion.file !== selectedModel.motionFiles.idle
							pendingExpressionRefresh = Boolean(currentExpressionName)
							action = inferActionFromMotionFile(preferredMotion.file)
							actionExpiresAt = performance.now() + (toolDefinition.durationMs ?? 1300)
							showBubbleMessage(hintText)
							return
						}
					}

					const fallbackAction = toolDefinition.id === 'nod' ? 'tapHead' : 'tapBody'
					const fallbackPlayed = playModelMotion(model, motionHandles, selectedModel, fallbackAction)
					if (fallbackPlayed) {
						pendingIdleRestore = true
						pendingExpressionRefresh = Boolean(currentExpressionName)
						action = fallbackAction === 'tapHead' ? 'nod' : 'wave'
						actionExpiresAt = performance.now() + (toolDefinition.durationMs ?? 1300)
						showBubbleMessage(hintText)
						return
					}
				}

				const directPlayed = playModelMotion(model, motionHandles, selectedModel, toolDefinition.action)
				if (directPlayed) {
					pendingIdleRestore = true
					pendingExpressionRefresh = Boolean(currentExpressionName)
					action = toolDefinition.action
					actionExpiresAt = performance.now() + (toolDefinition.durationMs ?? 1300)
					showBubbleMessage(hintText)
					return
				}

				const randomMotion = pickMotionFromCategories(
					visibleCatalog,
					toolDefinition.motionCategories,
					selectedModel.id === 'mori_miko' ? ['huifu', 'jieshu', 'hide', 'nor', 'idle'] : ['idle']
				)

				if (randomMotion) {
					const played = playMotionFile(model, motionHandles, randomMotion.file)
					if (!played) {
						showBubbleMessage(`${pickRandom(voice.motionFailed)} ${hintText}`)
						return
					}
					pendingIdleRestore = randomMotion.file !== selectedModel.motionFiles.idle
					pendingExpressionRefresh = Boolean(currentExpressionName)
					action = inferActionFromMotionFile(randomMotion.file)
					actionExpiresAt = performance.now() + (toolDefinition.durationMs ?? 1300)
					showBubbleMessage(hintText)
					return
				}

				playAction(toolDefinition.action, hintText, toolDefinition.durationMs ?? 1300)
			}
		}

		const handlePointerMove = (event: PointerEvent) => {
			if (!followCursor || !container) return
			const rect = container.getBoundingClientRect()
			const px = event.clientX - rect.left
			const py = event.clientY - rect.top
			const nx = (px / rect.width - 0.5) * 48
			const ny = (py / rect.height - 0.5) * 28
			lastPointerY = py
			targetX = centerX + nx
			targetY = centerY + ny
		}

		const handlePointerLeave = () => {
			targetX = centerX
			targetY = centerY
		}

		const ticker = (delta: number) => {
			if (!model) return

			model.update?.(delta * (1000 / 60))
			animationTime += delta / 60
			if (fitPasses < 180) {
				fitModelToStage()
				fitPasses += 1
			}
			if (action !== 'idle' && performance.now() > actionExpiresAt) {
				action = 'idle'
				if (pendingIdleRestore && selectedModel.runtime === 'cubism2' && selectedModel.motionFiles.idle) {
					playMotionFile(model, motionHandles, selectedModel.motionFiles.idle)
					pendingIdleRestore = false
				}
				if (pendingExpressionRestore && expressionRestoreName && selectedModel.runtime === 'cubism2') {
					applyExpression(expressionRestoreName, resolveExpressionLabel(selectedModel.id, expressionRestoreName), false, false)
					pendingExpressionRestore = false
					expressionRestoreName = null
				}
				if (pendingExpressionRefresh && currentExpressionName && selectedModel.runtime === 'cubism2') {
					applyExpression(currentExpressionName, resolveExpressionLabel(selectedModel.id, currentExpressionName), false)
				}
			}

			const ease = followCursor ? 0.08 : 0.12
			currentX += (targetX - currentX) * ease
			currentY += (targetY - currentY) * ease

			model.x = currentX
			model.y = currentY
			model.scale.set(baseScale, baseScale)
		}

		const init = async () => {
			try {
				setStatus('loading')
				setErrorMsg('')
				showBubbleMessage(voice.loading, 6000)
				const [modelMeta] = await Promise.all([readModelMeta(selectedModel)])
				setMeta(modelMeta)
				const modelDataResponse = await fetch(selectedModel.modelUrl, { cache: 'no-store' })
				const modelData = await modelDataResponse.json()
				motionFiles = readMotionFiles(modelData)
				motionHandles = buildMotionHandles(modelData)
				modelCatalog = readModelCatalog(modelData, selectedModel.id)
				setAssetCatalog(modelCatalog)

				await loadScript(PIXI_SCRIPT, () => isPixiRuntimeReady())
				resetLive2DRuntime(selectedModel.runtime)

				if (selectedModel.runtime === 'cubism2') {
					await loadScript(CUBISM2_RUNTIME_SCRIPT, () => Boolean((window as unknown as { Live2D?: unknown }).Live2D))
					await loadScript(CUBISM2_SCRIPT, () => {
						const win = window as unknown as {
							PIXI?: {
								live2d?: { Live2DModel?: unknown }
								Live2DModel?: unknown
							}
							Live2DModel?: unknown
						}
						return Boolean(win.PIXI?.live2d?.Live2DModel || win.PIXI?.Live2DModel || win.Live2DModel)
					})
				} else {
					await loadScript(CUBISM4_CORE_SCRIPT, () => Boolean((window as unknown as { Live2DCubismCore?: unknown }).Live2DCubismCore))
					await loadScript(CUBISM4_SCRIPT, () => {
						const win = window as unknown as {
							PIXI?: {
								live2d?: { Live2DModel?: unknown }
								Live2DModel?: unknown
							}
							Live2DModel?: unknown
						}
						return Boolean(win.PIXI?.live2d?.Live2DModel || win.PIXI?.Live2DModel || win.Live2DModel)
					})
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
							autoDensity?: boolean
							resolution?: number
							antialias?: boolean
						}) => PixiAppInstance
					}
				).Application

				const Live2DModel = await resolveLive2DModelCtor(selectedModel.runtime)

				const width = container.clientWidth || 720
				const height = container.clientHeight || 720
				const resolution = Math.min(window.devicePixelRatio || 1, 2)
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
					autoStart: true,
					autoDensity: true,
					resolution,
					antialias: true
				})

				model = await Live2DModel.from(selectedModel.modelUrl)
				app.stage.addChild(model)

				model.anchor.set(0.5, 1)
				model.interactive = true
				model.buttonMode = true
				fitModelToStage()
				resizeTargets()
				window.setTimeout(() => {
					fitModelToStage()
					resizeTargets()
				}, 120)
				window.setTimeout(() => {
					fitModelToStage()
					resizeTargets()
				}, 400)

				model.on?.('pointertap', () => {
					const bounds = container.getBoundingClientRect()
					const isHeadTap = lastPointerY > 0 && lastPointerY < bounds.height * 0.46

					if (isHeadTap) {
						const headMotion = pickMotionFromCategories(
							{ ...modelCatalog, motions: filterVisibleMotions(selectedModel.id, modelCatalog.motions) },
							selectedModel.id === 'mori_miko' ? ['头部', '耳朵'] : ['基础动作'],
							selectedModel.id === 'mori_miko' ? ['huifu', 'jieshu', 'hide', 'nor'] : []
						)

						if (headMotion) {
							const played = playMotionFile(model, motionHandles, headMotion.file)
							if (!played) {
								showBubbleMessage(`${pickRandom(voice.motionFailed)} ${pickRandom(voice.headTap)}`)
								return
							}
							pendingIdleRestore = headMotion.file !== selectedModel.motionFiles.idle
							pendingExpressionRefresh = Boolean(currentExpressionName)
							action = inferActionFromMotionFile(headMotion.file)
							actionExpiresAt = performance.now() + 1600
							showBubbleMessage(pickRandom(voice.headTap))
							return
						}

						const played = playModelMotion(model, motionHandles, selectedModel, 'tapHead')
						if (!played) {
							showBubbleMessage(`${pickRandom(voice.motionFailed)} ${pickRandom(voice.headTap)}`)
							return
						}
						pendingIdleRestore = true
						playAction('focus', pickRandom(voice.headTap), 1400, false)
						return
					}

					const bodyMotion = pickMotionFromCategories(
						{ ...modelCatalog, motions: filterVisibleMotions(selectedModel.id, modelCatalog.motions) },
						selectedModel.id === 'mori_miko' ? ['尾巴', '耳朵', '头部'] : ['基础动作'],
						selectedModel.id === 'mori_miko' ? ['huifu', 'jieshu', 'hide', 'nor'] : ['idle']
					)

					if (bodyMotion) {
						const played = playMotionFile(model, motionHandles, bodyMotion.file)
						if (!played) {
							showBubbleMessage(`${pickRandom(voice.motionFailed)} ${pickRandom(voice.bodyTap)}`)
							return
						}
						const tapHint = pickRandom(voice.bodyTap)
						pendingIdleRestore = bodyMotion.file !== selectedModel.motionFiles.idle
						pendingExpressionRefresh = Boolean(currentExpressionName)
						action = inferActionFromMotionFile(bodyMotion.file)
						actionExpiresAt = performance.now() + 1800
						showBubbleMessage(tapHint)
						return
					}

					const played = playModelMotion(model, motionHandles, selectedModel, 'tapBody')
					if (!played) {
						showBubbleMessage(`${pickRandom(voice.motionFailed)} ${pickRandom(voice.bodyTap)}`)
						return
					}
					pendingIdleRestore = true
					playAction('focus', pickRandom(voice.bodyTap), 1400, false)
				})

				container.addEventListener('pointerdown', handlePointerDown)
				container.addEventListener('pointermove', handlePointerMove)
				container.addEventListener('pointerleave', handlePointerLeave)
				window.addEventListener('resize', resizeTargets)
				window.addEventListener('resize', resizeCanvas)
				app.ticker.add(ticker)
				if (selectedModel.id === 'rgm') {
					applyExpression('idle', resolveExpressionLabel('rgm', 'idle'))
				}

				setStatus('ready')
			} catch (err) {
				setErrorMsg(err instanceof Error ? err.message : String(err))
				setStatus('error')
			}
		}

		void init()

		return () => {
			currentExpressionNameRef.current = null
			actionRunnerRef.current = () => undefined
			actionControllerRef.current = { run: () => undefined }
			assetControllerRef.current = {
				playMotion: () => undefined,
				playExpression: () => undefined
			}
			if (bubbleTimerRef.current) {
				window.clearTimeout(bubbleTimerRef.current)
				bubbleTimerRef.current = null
			}
			window.removeEventListener('resize', resizeTargets)
			window.removeEventListener('resize', resizeCanvas)
			container.removeEventListener('pointerdown', handlePointerDown)
			container.removeEventListener('pointermove', handlePointerMove)
			container.removeEventListener('pointerleave', handlePointerLeave)

			if (app) {
				app.ticker.remove(ticker)
				app.destroy({ removeView: true })
			}

			container.innerHTML = ''
		}
	}, [followCursor, selectedModel, tipsConfig])

	const runToolAction = (toolId: string) => {
		if (status !== 'ready') {
			showBubbleMessage(getCharacterVoice(selectedModel.id).loading, 2200)
			return
		}

		if (selectedModel.id === 'rgm' && toolId !== 'wardrobe') {
			actionRunnerRef.current(toolId)
			return
		}

		if (selectedModel.runtime === 'cubism2' && toolId !== 'wardrobe') {
			if (toolId === 'tips') {
				const expressionName = buildDirectExpressionName(selectedModel.id, currentExpressionNameRef.current)
				if (expressionName) {
					const label = resolveExpressionLabel(selectedModel.id, expressionName)
					assetControllerRef.current.playExpression(expressionName, label)
					return
				}
			}

			const preferredMotion = pickToolMotionFromCatalog(selectedModel.id, toolId as ToolId, assetCatalog)
			const motionFile = preferredMotion?.file || buildDirectToolMotion(selectedModel, toolId as ToolId)
			if (motionFile) {
				const toolLabel = selectedModel.toolDefinitions.find(item => item.id === toolId)?.label || toolId
				assetControllerRef.current.playMotion(motionFile, toolLabel)
				return
			}
		}

		if (toolId === 'wardrobe') {
			const currentIndex = SWITCHABLE_MODEL_OPTIONS.findIndex((modelOption) => modelOption.id === selectedModelId)
			const nextModel = SWITCHABLE_MODEL_OPTIONS[(currentIndex + 1) % SWITCHABLE_MODEL_OPTIONS.length]
			if (nextModel) {
				setSelectedModelId(nextModel.id)
			}
			return
		}

		actionRunnerRef.current(toolId)
	}

	const sendMessage = async (rawValue: string) => {
		const value = rawValue.trim().slice(0, 120)
		if (!value || isChatLoading) return
		if (voiceStatus === 'listening') {
			stopVoiceRecognition()
		}

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
		actionControllerRef.current.run('focus', getCharacterVoice(selectedModel.id).connecting, 1600)

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
			const fallback = buildFallbackReply(selectedModel.id, value)
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
			const nextInput = isCompactLayout ? mobileInputRef.current : desktopInputRef.current
			nextInput?.focus()
		}
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		await sendMessage(chatInput)
	}

	const handleChatKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key !== 'Enter' || event.shiftKey) return
		if (isCompactLayout) return
		event.preventDefault()
		if (!chatInput.trim() || isChatLoading) return
		void sendMessage(chatInput)
	}

	useEffect(() => {
		const scrollToBottom = (element: HTMLDivElement | null) => {
			if (!element) return
			element.scrollTo({
				top: element.scrollHeight,
				behavior: 'smooth'
			})
		}

		scrollToBottom(desktopChatListRef.current)
		scrollToBottom(mobileChatListRef.current)
	}, [chatHistory, isChatLoading])

	useEffect(() => {
		if (!isCompactLayout) {
			setMobileViewportOffset(0)
			return
		}

		const syncViewport = () => {
			const viewport = window.visualViewport
			if (!viewport) {
				setMobileViewportOffset(0)
				return
			}

			const nextOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
			setMobileViewportOffset(nextOffset)
		}

		syncViewport()
		window.visualViewport?.addEventListener('resize', syncViewport)
		window.visualViewport?.addEventListener('scroll', syncViewport)
		window.addEventListener('resize', syncViewport)

		return () => {
			window.visualViewport?.removeEventListener('resize', syncViewport)
			window.visualViewport?.removeEventListener('scroll', syncViewport)
			window.removeEventListener('resize', syncViewport)
		}
	}, [isCompactLayout])

	useEffect(() => {
		const dock = mobileComposerDockRef.current
		if (!dock) return

		const syncDockHeight = () => {
			setMobileDockHeight(dock.getBoundingClientRect().height)
		}

		syncDockHeight()

		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', syncDockHeight)
			return () => window.removeEventListener('resize', syncDockHeight)
		}

		const observer = new ResizeObserver(syncDockHeight)
		observer.observe(dock)

		return () => observer.disconnect()
	}, [chatInput, isChatLoading, isCompactLayout])

	const renderChatItem = (entry: ChatEntry, compact = false) => (
		<div
			key={entry.id}
			className={`rounded-2xl ${compact ? 'px-3 py-2 text-sm' : 'px-3 py-2.5 text-sm sm:px-4 sm:py-3'} leading-6 ${
				entry.role === 'user'
					? compact
						? 'ml-5 bg-[#ef6b4a] text-white'
						: 'ml-6 bg-[#ef6b4a] text-white sm:ml-10'
					: entry.role === 'assistant'
						? compact
							? 'mr-1 bg-white text-[#5a4b4b]'
							: 'mr-2 bg-white text-[#5a4b4b] sm:mr-4'
						: 'border border-dashed border-white/70 bg-white/50 text-[#7a6969]'
			} ${entry.role === 'assistant' ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''}`}>
			<div className='mb-1 flex items-center gap-2 text-[11px] font-medium'>
				<span
					className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 ${
						entry.role === 'user'
							? 'bg-white/20 text-white'
							: entry.role === 'assistant'
								? 'bg-[#f9ede6] text-[#d77757]'
								: 'bg-white/60 text-[#8b7777]'
					}`}>
					{entry.role === 'user' ? '你' : entry.role === 'assistant' ? selectedModel.name.slice(0, 2) : '系统'}
				</span>
				<span className={entry.role === 'user' ? 'text-white/90' : 'text-[#9a8787]'}>
					{entry.role === 'user' ? '你' : entry.role === 'assistant' ? selectedModel.name : '系统消息'}
				</span>
			</div>
			{entry.role === 'assistant' ? <AssistantMessage text={entry.text} compact={compact} /> : <ChatMarkdown text={entry.text} compact={compact} />}
		</div>
	)

	const renderPendingReply = (compact = false) => (
		<div
			className={`rounded-2xl bg-white/88 text-[#7a6969] shadow-[0_10px_24px_rgba(131,93,75,0.08)] ${
				compact ? 'mr-1 px-3 py-2' : 'mr-2 px-3 py-2.5 sm:mr-4 sm:px-4 sm:py-3'
			}`}>
			<div className='flex items-center gap-2'>
				<span className='text-[11px] font-medium text-[#b5977b]'>{selectedModel.name}</span>
				<div className='flex items-center gap-1'>
					<span className='h-1.5 w-1.5 animate-bounce rounded-full bg-[#ef6b4a] [animation-delay:-0.2s]' />
					<span className='h-1.5 w-1.5 animate-bounce rounded-full bg-[#ef6b4a] [animation-delay:-0.1s]' />
					<span className='h-1.5 w-1.5 animate-bounce rounded-full bg-[#ef6b4a]' />
				</div>
			</div>
			<div className='mt-1 text-sm'>{getCharacterVoice(selectedModel.id).connecting}</div>
		</div>
	)

	const renderEmptyChatState = (compact = false) => (
		<div
			className={`rounded-[20px] border border-dashed border-white/75 bg-white/55 text-[#8b7777] ${
				compact ? 'px-3 py-3.5' : 'px-4 py-4'
			}`}>
			<div className='text-sm font-medium text-[#6f5d5d]'>还没有开始对话</div>
			<div className='mt-1 text-xs leading-5'>
				先点一个快捷提问，或者直接在下面输入一句话。
			</div>
		</div>
	)

	const visibleToolHints = useMemo(() => selectedModel.toolDefinitions.slice(0, 5), [selectedModel.toolDefinitions])
	const visibleQuickPrompts = useMemo(() => buildQuickPrompts(selectedModel.id), [selectedModel.id])
	const curatedMotionGroups = useMemo(
		() => buildCuratedMotionGroups(selectedModel.id, assetCatalog.motions),
		[selectedModel.id, assetCatalog.motions]
	)
	const visibleExpressions = useMemo(
		() => filterVisibleExpressions(selectedModel.id, assetCatalog.expressions, assetCatalog.motions),
		[selectedModel.id, assetCatalog.expressions, assetCatalog.motions]
	)
	const hasChatMessages = chatHistory.length > 0
	const panelStatusLabel = status === 'ready' ? '在线中' : status === 'loading' ? '连接中' : '本地回退'
	const panelModeLabel = status === 'error' ? '已切本地回答' : '数字分身优先'
	const panelPresenceLabel = isChatLoading ? '正在认真回应' : isMessageVisible ? '在听你说' : '安静陪伴中'
	const recentExpressionText = activeExpressionLabel || resolveExpressionLabel(selectedModel.id, 'idle')
	const inspirationPrompt = visibleQuickPrompts[(chatHistory.length + selectedModel.name.length) % visibleQuickPrompts.length] || visibleQuickPrompts[0] || '陪我聊聊今天'
	const isVoiceListening = voiceStatus === 'listening'
	const isVoiceUnavailable = voiceStatus === 'unsupported' || voiceStatus === 'denied'
	const hasDraftInput = chatInput.trim().length > 0
	const mobileChatPriority = isCompactLayout && (hasChatMessages || isChatLoading || hasDraftInput || isVoiceListening)
	const shouldExpandMobileComposer =
		isCompactLayout && (isVoiceListening || hasDraftInput || isChatLoading || isMobileComposerFocused)

	const handleMobileComposerFocus = () => {
		setIsMobileComposerFocused(true)
		window.setTimeout(() => {
			mobilePanelRef.current?.scrollIntoView({
				block: 'start',
				behavior: 'smooth'
			})
			mobileChatListRef.current?.scrollTo({
				top: mobileChatListRef.current.scrollHeight,
				behavior: 'smooth'
			})
			mobileComposerDockRef.current?.scrollIntoView({
				block: 'nearest',
				behavior: 'smooth'
			})
		}, 180)
	}

	const handleMobileComposerBlur = () => {
		window.setTimeout(() => {
			if (!mobileInputRef.current) return
			if (document.activeElement === mobileInputRef.current) return
			if (chatInput.trim() || isVoiceListening || isChatLoading) return
			setIsMobileComposerFocused(false)
		}, 140)
	}

	const renderVoiceListeningState = (compact = false) => {
		if (!isVoiceListening) return null

		return (
			<div
				className={`rounded-[18px] border border-[#ef6b4a]/18 bg-[linear-gradient(135deg,rgba(255,241,235,0.98),rgba(255,248,244,0.9))] text-[#9a5a46] shadow-[0_12px_28px_rgba(239,107,74,0.12)] ${
					compact ? 'px-3 py-2.5' : 'px-3.5 py-3'
				}`}>
				<div className='flex items-center justify-between gap-3'>
					<div className='flex items-center gap-2.5'>
						<span className='relative inline-flex h-2.5 w-2.5'>
							<span className='absolute inset-0 animate-ping rounded-full bg-[#ef6b4a]/45' />
							<span className='relative rounded-full bg-[#ef6b4a] h-2.5 w-2.5' />
						</span>
						<div>
							<div className='text-[12px] font-semibold'>正在听你说话</div>
							<div className='text-[11px] text-[#b06b57]'>说完后会先帮你变成文字，不会直接发送。</div>
						</div>
					</div>
					<div className='flex items-end gap-1'>
						<span className='h-2.5 w-1 rounded-full bg-[#ef6b4a]/45 animate-[pulse_1s_ease-in-out_infinite]' />
						<span className='h-4 w-1 rounded-full bg-[#ef6b4a]/70 animate-[pulse_1s_ease-in-out_infinite_0.15s]' />
						<span className='h-6 w-1 rounded-full bg-[#ef6b4a] animate-[pulse_1s_ease-in-out_infinite_0.3s]' />
						<span className='h-4 w-1 rounded-full bg-[#ef6b4a]/70 animate-[pulse_1s_ease-in-out_infinite_0.45s]' />
					</div>
				</div>
			</div>
		)
	}

	const renderVoiceButton = (compact = false) => (
		<button
			type='button'
			onClick={toggleVoiceRecognition}
			disabled={isChatLoading || voiceStatus === 'unsupported'}
			aria-pressed={isVoiceListening}
			title={isVoiceListening ? '停止听写' : '开始语音输入'}
			className={`relative inline-flex items-center justify-center gap-1.5 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-55 ${
				isVoiceListening
					? 'border-[#ef6b4a]/35 bg-[#fff0eb] text-[#ef6b4a] shadow-[0_0_0_6px_rgba(239,107,74,0.08)]'
					: 'border-white/72 bg-white/84 text-[#7b6868] hover:bg-white'
			} ${compact ? 'h-[2.95rem] min-w-[2.95rem] px-2.5' : 'px-3.5 py-2'}`}>
			{isVoiceListening && <span className='absolute inset-0 rounded-full animate-pulse bg-[#ef6b4a]/8' />}
			<svg viewBox='0 0 24 24' fill='none' className='h-[18px] w-[18px] stroke-[1.9]' aria-hidden='true'>
				<path d='M12 4a3 3 0 0 1 3 3v4a3 3 0 1 1-6 0V7a3 3 0 0 1 3-3Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
				<path d='M6.5 10.5a5.5 5.5 0 0 0 11 0M12 18v2.5m-3 0h6' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
			</svg>
			{compact ? null : <span className='relative text-xs font-medium'>{isVoiceListening ? '正在听' : '语音输入'}</span>}
		</button>
	)

	const renderStarterGrid = (compact = false) => (
		<div className='grid grid-cols-2 gap-2.5'>
			{visibleQuickPrompts.map((prompt) => (
				<button
					key={prompt}
					type='button'
					disabled={isChatLoading}
					onClick={() => void sendMessage(prompt)}
					className={`rounded-[18px] border border-white/72 bg-white/84 text-left text-[#6f5d5d] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${
						compact ? 'min-h-[2.95rem] px-3 py-1.5 text-[11px] leading-[1.15rem]' : 'min-h-[3.6rem] px-3.5 py-2.5 text-[12px] leading-5'
					}`}>
					{prompt}
				</button>
			))}
		</div>
	)

	const renderPanelHeader = (compact = false) => {
		if (compact) {
			return (
				<div className='space-y-2'>
					<div className='flex items-start justify-between gap-3'>
						<div className='min-w-0'>
							<h3 className='text-[17px] font-semibold text-[#4b3d3d]'>来访对话</h3>
						</div>
						<div className='flex items-center gap-2'>
							<span className='mt-1 rounded-full border border-white/70 bg-white/78 px-3 py-1 text-[11px] text-[#8b7777]'>
								{chatHistory.length} 条
							</span>
							<button
								type='button'
								onClick={scrollToStageCard}
								className='mt-1 rounded-full border border-white/70 bg-white/78 px-3 py-1 text-[11px] text-[#8b7777] transition hover:bg-white'>
								看角色
							</button>
						</div>
					</div>
					<div className='rounded-[16px] border border-white/68 bg-white/72 px-3 py-1.5 text-[11px] text-[#7b6868]'>
						<div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
							<span className='font-medium text-emerald-700'>{panelStatusLabel}</span>
							<span>{panelModeLabel}</span>
							<span>{panelPresenceLabel}</span>
						</div>
					</div>
				</div>
			)
		}

		return (
			<div className='space-y-4'>
				<div className='flex items-start justify-between gap-3'>
					<div>
						<h3 className='text-lg font-semibold text-[#4b3d3d]'>来访对话</h3>
						<p className='mt-1 text-xs leading-5 text-[#8c7a7a]'>
							更像陪伴面板，不是表单面板。你说一句，我就接一句。
						</p>
					</div>
					<span className='mt-1 rounded-full border border-white/70 bg-white/78 px-3 py-1 text-[11px] text-[#8b7777]'>
						{chatHistory.length} 条消息
					</span>
				</div>
				<div className='flex flex-wrap gap-2'>
					<span className='rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-[11px] font-medium text-emerald-700'>
						{panelStatusLabel}
					</span>
					<span className='rounded-full border border-white/70 bg-white/78 px-3 py-1 text-[11px] text-[#8b7777]'>
						{panelModeLabel}
					</span>
					<span className='rounded-full border border-white/70 bg-white/78 px-3 py-1 text-[11px] text-[#8b7777]'>
						{panelPresenceLabel}
					</span>
				</div>
				<div className='grid grid-cols-3 gap-2.5'>
					<div className='rounded-[18px] border border-white/68 bg-white/72 px-3 py-2.5'>
						<div className='text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b5977b]'>今日状态</div>
						<div className='mt-1 text-sm font-medium text-[#5c4c4c]'>{panelPresenceLabel}</div>
					</div>
					<div className='rounded-[18px] border border-white/68 bg-white/72 px-3 py-2.5'>
						<div className='text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b5977b]'>最近表情</div>
						<div className='mt-1 text-sm font-medium text-[#5c4c4c]'>{recentExpressionText}</div>
					</div>
					<div className='rounded-[18px] border border-white/68 bg-white/72 px-3 py-2.5'>
						<div className='text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b5977b]'>当前角色</div>
						<div className='mt-1 truncate text-sm font-medium text-[#5c4c4c]'>{selectedModel.name}</div>
					</div>
				</div>
			</div>
		)
	}

	const renderCompanionOpener = (compact = false) => (
		<div className={`rounded-[22px] border border-white/70 bg-white/62 ${compact ? 'p-2.5' : 'p-4'}`}>
			<div className={`font-semibold text-[#5d4d4d] ${compact ? 'text-[15px]' : 'text-sm'}`}>先从一句轻松的话开始</div>
			<p className={`mt-2 text-sm leading-6 text-[#6f5d5d] ${compact ? 'line-clamp-2 text-[13px] leading-5' : ''}`}>
				{selectedModel.defaultBubble}
			</p>
			<div className={`flex items-center justify-between gap-3 ${compact ? 'mt-3' : 'mt-4'}`}>
				<div className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b5977b]'>Quick Start</div>
				<span className='text-[11px] text-[#9a8a8a]'>点一句开始更快</span>
			</div>
			<div className={`${compact ? 'mt-2.5' : 'mt-3'}`}>
				{renderStarterGrid(compact)}
			</div>
		</div>
	)

	const renderConversationFeed = (compact = false) => (
		<div className='space-y-2.5'>
			<div className='flex items-center justify-between gap-3'>
				<div className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b5977b]'>{compact ? '最近对话' : 'Conversation'}</div>
				{hasChatMessages && (
					<button
						type='button'
						disabled={isChatLoading}
						onClick={() => void sendMessage(inspirationPrompt)}
						className='rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-[11px] text-[#7b6868] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'>
						再给我一句灵感
					</button>
				)}
			</div>
			<div
				ref={compact ? mobileChatListRef : desktopChatListRef}
				className={`overflow-y-auto rounded-[22px] border border-white/70 bg-white/68 ${
					compact ? 'max-h-[20rem] space-y-2 p-2.5' : 'min-h-[18rem] max-h-[28rem] space-y-3 p-3'
				}`}>
				{chatHistory.map((entry) => renderChatItem(entry, compact))}
				{isChatLoading && renderPendingReply(compact)}
			</div>
		</div>
	)

	const renderComposer = (compact = false) => (
		<form
			className={`rounded-[22px] border border-white/68 bg-[rgba(255,255,255,0.58)] shadow-[0_16px_40px_rgba(223,152,115,0.12)] ${
				compact ? 'p-3.5' : 'p-4'
			}`}
			onSubmit={handleSubmit}>
			{renderVoiceListeningState(compact)}
			<textarea
				ref={desktopInputRef}
				value={chatInput}
				disabled={isChatLoading}
				onChange={(event) => setChatInput(event.target.value.slice(0, 120))}
				onKeyDown={handleChatKeyDown}
				placeholder='输入一句话，例如：今天过得怎么样？'
				rows={2}
				className={`w-full resize-none rounded-[18px] border border-white/72 bg-white/84 text-sm leading-6 text-[#4b3d3d] outline-none ring-0 placeholder:text-[#aa9c9c] focus:border-[#ef6b4a]/50 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${
					compact ? 'min-h-[6rem] px-3.5 py-3' : 'min-h-[6.6rem] px-4 py-3.5'
				} ${isVoiceListening ? 'mt-2.5 border-[#ef6b4a]/28 bg-[#fffaf7]' : ''}`}
			/>
			<div className='mt-2.5 flex flex-wrap items-center justify-between gap-2.5'>
				<div className='flex flex-wrap items-center gap-2'>
					{renderVoiceButton()}
					<span className={`text-[11px] ${isVoiceListening ? 'text-[#c26c54]' : 'text-[#9a8a8a]'}`}>{voiceHint}</span>
				</div>
				<div className='flex items-center gap-2'>
					<span className='text-[11px] text-[#9a8a8a]'>{chatInput.trim().length}/120</span>
					<button
						type='submit'
						disabled={isChatLoading || !chatInput.trim()}
						className='rounded-full bg-[#ef6b4a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e85b37] disabled:cursor-not-allowed disabled:opacity-60'>
						{isChatLoading ? '请求中...' : '发送'}
					</button>
				</div>
			</div>
		</form>
	)

	const renderMobileComposerDock = () => (
		<div
			ref={mobileComposerDockRef}
			className='fixed inset-x-2.5 z-40 xl:hidden'
			style={{ bottom: `calc(env(safe-area-inset-bottom) + ${mobileViewportOffset + 10}px)` }}>
			<form
				onSubmit={handleSubmit}
				className={`border border-white/72 bg-[rgba(255,255,255,0.9)] backdrop-blur-xl transition-all duration-200 ${
					shouldExpandMobileComposer
						? 'rounded-[22px] p-2 shadow-[0_18px_48px_rgba(176,125,102,0.18)]'
						: 'rounded-[18px] p-1.5 shadow-[0_14px_34px_rgba(176,125,102,0.14)]'
				}`}>
				{renderVoiceListeningState(true)}
				<div className='flex items-end gap-2'>
					<textarea
						ref={mobileInputRef}
						value={chatInput}
						disabled={isChatLoading}
						onChange={(event) => setChatInput(event.target.value.slice(0, 120))}
						onKeyDown={handleChatKeyDown}
						onFocus={handleMobileComposerFocus}
						onBlur={handleMobileComposerBlur}
						placeholder={hasChatMessages ? '继续说一句，我会接着聊。' : '输入一句话，直接开始聊天...'}
						rows={shouldExpandMobileComposer ? 2 : 1}
						className={`flex-1 resize-none rounded-[18px] border border-white/75 bg-white/90 px-3 text-sm leading-6 text-[#4b3d3d] outline-none ring-0 placeholder:text-[#aa9c9c] focus:border-[#ef6b4a]/50 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${
							shouldExpandMobileComposer ? 'min-h-[4.75rem] max-h-28 py-2.5' : 'min-h-[2.8rem] max-h-[2.8rem] py-2'
						} ${
							isVoiceListening ? 'border-[#ef6b4a]/28 bg-[#fffaf7]' : ''
						}`}
					/>
					{renderVoiceButton(true)}
					<button
						type='submit'
						disabled={isChatLoading || !chatInput.trim()}
						className={`rounded-[18px] bg-[#ef6b4a] text-sm font-semibold text-white transition hover:bg-[#e85b37] disabled:cursor-not-allowed disabled:opacity-60 ${
							shouldExpandMobileComposer ? 'h-[2.95rem] min-w-[4.35rem] px-3.5' : 'h-[2.8rem] min-w-[3.55rem] px-3'
						}`}>
						{isChatLoading ? '发送中' : shouldExpandMobileComposer ? '发送' : '发'}
					</button>
				</div>
				{(shouldExpandMobileComposer || isVoiceUnavailable) && (
					<div className={`mt-1 flex items-center justify-between gap-3 px-1 text-[10px] ${isVoiceListening ? 'text-[#c26c54]' : 'text-[#9a8a8a]'}`}>
						<span>{isVoiceUnavailable ? voiceHint : isVoiceListening ? '正在听写，识别结果会先落进输入框。' : voiceHint}</span>
						<span>{chatInput.trim().length}/120</span>
					</div>
				)}
			</form>
		</div>
	)
	return (
		<div
			className='px-3 pb-28 pt-5 sm:px-5 sm:pb-6 sm:pt-8 lg:px-8 lg:pt-10 xl:px-6 xl:pb-6 xl:pt-6 2xl:px-8'
			style={isCompactLayout ? { paddingBottom: `${mobileDockHeight + mobileViewportOffset + 28}px` } : undefined}>
			<div className='mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1880px] gap-3 lg:gap-4 xl:grid-cols-[minmax(760px,1fr)_420px] 2xl:grid-cols-[minmax(860px,1fr)_448px]'>
				<div
					ref={stageCardRef}
					className='order-2 relative overflow-hidden rounded-[26px] border border-white/60 bg-white/42 p-3 shadow-[0_24px_80px_rgba(227,122,87,0.16)] backdrop-blur-xl sm:rounded-[32px] sm:p-5 xl:order-none xl:rounded-[36px] xl:p-5'>
					<div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.88),_rgba(255,255,255,0.22)_45%,_rgba(255,215,173,0.24)_100%)]' />
					<div className='relative flex h-full flex-col'>
						<div className='mb-2 hidden sm:block'>
							<div>
								<p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b5977b]'>Digital Persona</p>
								<h2 className='mt-1 text-xl font-semibold tracking-tight text-[#4b3d3d] sm:text-2xl'>{selectedModel.name}</h2>
							</div>
						</div>
						<div className='mb-2 flex items-center justify-between sm:hidden'>
							<div>
								<p className='text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b5977b]'>互动舞台</p>
								<h2 className='mt-0.5 text-base font-semibold tracking-tight text-[#4b3d3d]'>{selectedModel.name}</h2>
							</div>
							<button
								type='button'
								onClick={scrollToMobilePanel}
								className='rounded-full border border-white/75 bg-white/82 px-3 py-1.5 text-[11px] text-[#7d6969] transition hover:bg-white'>
								去对话
							</button>
						</div>

						<div className={`relative flex-1 overflow-hidden rounded-[24px] border border-white/65 bg-white/35 px-3 pb-3.5 pt-2.5 sm:min-h-[520px] sm:rounded-[30px] sm:px-5 sm:pb-24 sm:pt-4 lg:px-6 lg:pt-5 xl:min-h-[640px] xl:rounded-[30px] xl:px-5 xl:pb-5 xl:pt-5 2xl:min-h-[700px] 2xl:px-6 2xl:pb-6 2xl:pt-5 ${
							mobileChatPriority ? 'min-h-[270px]' : 'min-h-[clamp(19rem,78vw,24rem)]'
						}`}>
							<div className='absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.82),_rgba(255,239,214,0.24)_58%,_rgba(255,196,157,0.18)_100%)]' />

							{isMessageVisible && (
								<div className='absolute left-3 right-3 top-2.5 z-20 max-w-[calc(100%-1.5rem)] sm:left-5 sm:right-auto sm:top-4 sm:max-w-[19rem] lg:left-6 lg:top-5'>
									<div className='relative rounded-[18px] border border-[#e0ba8c] bg-[rgba(236,217,188,0.62)] px-3 py-2 text-[11px] leading-[1.35rem] text-[#584949] shadow-[0_8px_24px_rgba(191,158,118,0.14)] backdrop-blur-md sm:rounded-[22px] sm:px-4 sm:py-2.5 sm:text-[13px] sm:leading-6'>
										<div className='absolute -bottom-2 left-6 h-4 w-4 rotate-45 rounded-[5px] border-b border-r border-[#e0ba8c] bg-[rgba(236,217,188,0.62)] sm:left-8 sm:h-5 sm:w-5' />
										{message}
									</div>
								</div>
							)}

							<div className='absolute left-3 right-3 top-[5.3rem] z-20 hidden flex-wrap gap-2 sm:left-5 sm:right-auto sm:top-[6.2rem] lg:left-6 xl:hidden'>
								<span className='rounded-full border border-white/75 bg-white/78 px-3 py-1 text-[11px] font-medium text-[#6e5b5b] shadow-[0_10px_24px_rgba(131,93,75,0.08)] sm:text-xs'>
									当前角色：{selectedModel.name}
								</span>
							</div>

							<div className='absolute inset-x-0 bottom-0 top-0 z-10 flex items-end justify-center'>
								<div ref={stageShellRef} className='relative h-full w-full will-change-transform'>
									<div ref={containerRef} className='relative h-full w-full' />
								</div>
							</div>

							{status !== 'ready' && (
								<div className='pointer-events-none absolute inset-x-0 bottom-0 top-0 z-[9] flex items-end justify-center'>
									<div className='mb-10 h-[360px] w-[240px] rounded-[120px] bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.92),rgba(255,232,214,0.72)_55%,rgba(248,196,167,0.34)_100%)] opacity-70 blur-[2px]' />
								</div>
							)}

							<div className='hidden absolute bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-3 right-3 z-20 rounded-[20px] border border-white/70 bg-[rgba(255,255,255,0.52)] p-1.5 shadow-[0_18px_48px_rgba(176,125,102,0.18)] backdrop-blur-xl sm:block sm:bottom-5 sm:left-5 sm:right-5 sm:rounded-[24px] sm:p-2.5 xl:bottom-auto xl:left-auto xl:right-6 xl:top-1/2 xl:w-auto xl:-translate-y-1/2 xl:rounded-[30px] xl:bg-[rgba(255,255,255,0.42)]'>
								<div className='flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2.5 xl:flex-col xl:overflow-visible xl:pb-0'>
								{visibleToolHints.map((tool) => {
									const label = tool.id === 'wardrobe' ? '换角色' : tool.label

									return (
										<div key={tool.id} className='group relative'>
											<button
												type='button'
												title={label}
												aria-label={label}
												onClick={() => runToolAction(tool.id)}
												className='flex min-w-[3.9rem] flex-1 flex-col items-center justify-center gap-1 rounded-[16px] border border-white/85 bg-white/80 px-1.5 py-1.5 text-[#5d4d4d] shadow-[0_10px_24px_rgba(131,93,75,0.08)] transition hover:-translate-y-0.5 hover:bg-white hover:text-[#ef6b4a] sm:min-w-[5.25rem] sm:gap-1.5 sm:px-2 sm:py-2.5 xl:h-12 xl:min-w-0 xl:w-12 xl:flex-none xl:rounded-2xl xl:px-0 xl:py-0'
											>
												<ToolIcon toolId={tool.id} />
												<span className='text-[10px] font-medium leading-none text-[#6d5c5c] sm:text-[11px] xl:hidden'>
													{label}
												</span>
											</button>
											<div className='pointer-events-none absolute right-[calc(100%+10px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-white/80 bg-[rgba(255,255,255,0.92)] px-3 py-1.5 text-xs font-medium text-[#5d4d4d] shadow-[0_10px_24px_rgba(131,93,75,0.10)] xl:group-hover:block'>
												{label}
											</div>
										</div>
									)
								})}
								</div>
							</div>

							<div className='pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-[rgba(255,230,198,0.34)] to-transparent' />

							{status === 'loading' && (
								<div className='absolute inset-0 z-30 flex items-center justify-center text-sm text-[#8f7d7d]'>
									正在加载 Live2D 模型...
								</div>
							)}
							{status === 'error' && (
								<div className='absolute inset-0 z-30 flex items-center justify-center p-6 text-center text-sm text-red-500'>
									{errorMsg}
								</div>
							)}
						</div>

						<div className='mt-2 sm:hidden'>
							<div className='rounded-[18px] border border-white/70 bg-[rgba(255,255,255,0.52)] p-1.25 shadow-[0_16px_36px_rgba(176,125,102,0.16)] backdrop-blur-xl'>
								<div className='grid grid-cols-5 gap-1.25'>
									{visibleToolHints.map((tool) => {
										const label = tool.id === 'wardrobe' ? '换角色' : tool.label

										return (
											<button
												key={tool.id}
												type='button'
												title={label}
												aria-label={label}
												onClick={() => runToolAction(tool.id)}
												className='flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[15px] border border-white/85 bg-white/80 px-1 py-1.25 text-[#5d4d4d] shadow-[0_8px_20px_rgba(131,93,75,0.08)] transition hover:bg-white hover:text-[#ef6b4a]'
											>
												<ToolIcon toolId={tool.id} />
												<span className='text-[9px] font-medium leading-none text-[#6d5c5c]'>
													{label}
												</span>
											</button>
										)
									})}
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className='order-1 xl:order-none xl:sticky xl:top-6 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto xl:pr-1'>
					<div className='grid gap-3 sm:gap-4'>
						<div className='hidden rounded-[24px] border border-white/60 bg-white/52 p-4 shadow-[0_20px_60px_rgba(226,136,102,0.12)] backdrop-blur-xl sm:rounded-[28px] sm:p-5 xl:flex xl:min-h-[34rem] xl:max-h-[calc(100vh-2.5rem)] xl:flex-col xl:rounded-[28px] xl:p-5'>
							{renderPanelHeader()}
							<div className='mt-4 flex-1 overflow-hidden'>
								{hasChatMessages || isChatLoading ? renderConversationFeed() : renderCompanionOpener()}
							</div>
							<div className='mt-4'>
								{renderComposer()}
							</div>
						</div>

						<div
							ref={mobilePanelRef}
							className='-mt-0.5 rounded-[22px] border border-white/60 bg-white/52 p-2.5 shadow-[0_16px_44px_rgba(226,136,102,0.12)] backdrop-blur-xl sm:p-4 xl:hidden'>
							{renderPanelHeader(true)}
							<div className='mt-2.5 space-y-2.5'>
								{hasChatMessages || isChatLoading ? renderConversationFeed(true) : renderCompanionOpener(true)}
							</div>
						</div>
					</div>
				</div>
			</div>
			{renderMobileComposerDock()}
		</div>
	)
}
