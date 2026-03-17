import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'

export const runtime = 'nodejs'

export async function GET() {
	return NextResponse.json({ authenticated: await isAdminAuthed() })
}

