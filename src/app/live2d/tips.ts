export type Live2DHintGroup = {
	id: string
	label: string
	lines: string[]
}

export const idleHints = [
	'你好，我是 Cotton 的小助手。',
	'今天也在认真打磨这个博客。',
	'如果你想看动作和对话，我已经准备好第一版交互层了。',
	'这只模型目前更适合做陪伴和提示，不适合直接换装。'
]

export const hoverHints = [
	'别盯太久，我会紧张。',
	'你可以点右侧工具试试互动。',
	'现在这版支持跟随鼠标和消息提示。'
]

export const tapHints = [
	'收到，开始互动。',
	'这一下算是唤醒我了。',
	'想继续的话，可以试试“点头”或者“招手”。'
]

export const toolHints: Live2DHintGroup[] = [
	{
		id: 'greet',
		label: '打招呼',
		lines: ['你好，欢迎来到 mianhua.me。', '今天也适合记录一点新的想法。']
	},
	{
		id: 'wave',
		label: '招手',
		lines: ['先来个招呼动作。', '当前模型没有内置 motion，这里先用轻量动画代替。']
	},
	{
		id: 'nod',
		label: '点头',
		lines: ['收到。', '如果你之后换成完整模型，可以接真实动作。']
	},
	{
		id: 'tips',
		label: '随机提示',
		lines: ['这套交互层参考了 Halo 插件的 tips 机制，但实现已经改成 Next.js 版。']
	},
	{
		id: 'wardrobe',
		label: '换装',
		lines: ['当前模型只有一张贴图，没有现成换装资源。', '如果你换成带多贴图或多 costume 的模型，这个按钮就能接真实换装。']
	}
]
