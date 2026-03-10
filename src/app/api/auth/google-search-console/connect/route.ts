import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuthorizationUrl } from '@/lib/google/oauth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/google-search-console/connect?projectId=xxx
 *
 * Initiates Google Search Console OAuth flow for a specific project.
 * Only ADMIN and CONSULTANT roles can connect data sources.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Only ADMIN and CONSULTANT can connect data sources
    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para conectar fuentes de datos' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Se requiere projectId' },
        { status: 400 }
      )
    }

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId: session.user.id },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado' },
        { status: 404 }
      )
    }

    // Check membership (unless admin)
    if (session.user.role !== 'ADMIN' && project.members.length === 0) {
      return NextResponse.json(
        { error: 'No tienes acceso a este proyecto' },
        { status: 403 }
      )
    }

    // Create state parameter with project info
    const state = Buffer.from(
      JSON.stringify({
        projectId,
        userId: session.user.id,
        timestamp: Date.now(),
      })
    ).toString('base64url')

    // Generate authorization URL
    const authUrl = getAuthorizationUrl('google_search_console', state)

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('[Search Console Connect] Error:', error)
    return NextResponse.json(
      { error: 'Error al iniciar conexión con Google Search Console' },
      { status: 500 }
    )
  }
}
