'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { ProjectCard, type Project } from './components/project-card'
import CreateDialog from './components/create-dialog'
import { pushProjects } from './services/push-projects'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import initialList from './list.json'
import type { ImageItem } from './components/image-upload-dialog'
import { ensureAdminAuth } from '@/lib/admin-client'
import { loadServerContent } from '@/lib/content-client'

function getProjectKey(project: Project): string {
	return project.id || project.name
}

function ensureProjectIds(projects: Project[]): Project[] {
	return projects.map(project => ({
		...project,
		id: project.id || crypto.randomUUID()
	}))
}

export default function Page() {
	const [projects, setProjects] = useState<Project[]>(initialList as Project[])
	const [originalProjects, setOriginalProjects] = useState<Project[]>(initialList as Project[])
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [editingProject, setEditingProject] = useState<Project | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())

	const { isAuth, loginWithPassword } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false

	useEffect(() => {
		loadServerContent<Project[]>('projects')
			.then(serverProjects => {
				const normalizedProjects = ensureProjectIds(serverProjects)
				setProjects(normalizedProjects)
				setOriginalProjects(normalizedProjects)
			})
			.catch(error => {
				console.error('Failed to load projects:', error)
				toast.error(error?.message || '加载内容失败')
			})
	}, [])

	const handleUpdate = (updatedProject: Project, oldProject: Project, imageItem?: ImageItem) => {
		const oldKey = getProjectKey(oldProject)
		const nextProject = updatedProject.id ? updatedProject : { ...updatedProject, id: oldProject.id || crypto.randomUUID() }
		setProjects(prev => prev.map(project => (getProjectKey(project) === oldKey ? nextProject : project)))
		if (imageItem) {
			setImageItems(prev => {
				const next = new Map(prev)
				next.set(getProjectKey(nextProject), imageItem)
				return next
			})
		}
	}

	const handleAdd = () => {
		setEditingProject(null)
		setIsCreateDialogOpen(true)
	}

	const handleSaveProject = (updatedProject: Project) => {
		const nextProject = updatedProject.id ? updatedProject : { ...updatedProject, id: crypto.randomUUID() }
		if (editingProject) {
			const editingKey = getProjectKey(editingProject)
			setProjects(prev => prev.map(project => (getProjectKey(project) === editingKey ? nextProject : project)))
			return
		}
		setProjects(prev => [...prev, nextProject])
	}

	const handleDelete = (project: Project) => {
		if (confirm(`确定要删除 ${project.name} 吗？`)) {
			const projectKey = getProjectKey(project)
			setProjects(prev => prev.filter(item => getProjectKey(item) !== projectKey))
		}
	}

	const handleSave = async () => {
		setIsSaving(true)

		try {
			const savedProjects = await pushProjects({
				projects,
				originalProjects,
				imageItems
			})

			setProjects(savedProjects)
			setOriginalProjects(savedProjects)
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
		setProjects(originalProjects)
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
			<div className='flex flex-col items-center justify-center px-6 pt-32 pb-12'>
				<div className='grid w-full max-w-[1200px] grid-cols-2 gap-6 max-md:grid-cols-1'>
					{projects.map(project => (
						<ProjectCard key={getProjectKey(project)} project={project} isEditMode={isEditMode} onUpdate={handleUpdate} onDelete={() => handleDelete(project)} />
					))}
				</div>
			</div>

			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
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
							onClick={handleAdd}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							添加
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
							className='bg-card rounded-xl border px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
							编辑
						</motion.button>
					)
				)}
			</motion.div>

			{isCreateDialogOpen && <CreateDialog project={editingProject} onClose={() => setIsCreateDialogOpen(false)} onSave={handleSaveProject} />}
		</>
	)
}
