import { unstable_noStore as noStore } from 'next/cache'
import { readServerContent } from '@/lib/server-config'
import ProjectsClient from './projects-client'
import type { Project } from './components/project-card'

export const dynamic = 'force-dynamic'

function ensureProjectIds(projects: Project[]): Project[] {
	return projects.map(project => ({
		...project,
		id: project.id || crypto.randomUUID()
	}))
}

export default async function Page() {
	noStore()
	const projects = ensureProjectIds(await readServerContent<Project[]>('projects'))
	return <ProjectsClient initialProjects={projects} />
}
