import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateTokenExpiry } from '@/lib/google/oauth'

/**
 * POST /api/datasources
 *
 * Create a new data source connection.
 * Used after OAuth flow when user selects an account from multiple options.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para conectar fuentes de datos' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const {
      projectId,
      type,
      accessToken,
      refreshToken,
      tokenExpiry,
      accountId,
      accountName,
      mccId,
      metadata,
    } = body

    // Validate required fields
    if (!projectId || !type || !accessToken || !refreshToken || !accountId || !accountName) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Verify project access
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

    if (session.user.role !== 'ADMIN' && project.members.length === 0) {
      return NextResponse.json(
        { error: 'No tienes acceso a este proyecto' },
        { status: 403 }
      )
    }

    // Check for existing connection of same type and account
    const existing = await prisma.dataSource.findFirst({
      where: {
        projectId,
        type,
        accountId,
      },
    })

    if (existing) {
      // Update existing connection
      const dataSource = await prisma.dataSource.update({
        where: { id: existing.id },
        data: {
          accessToken,
          refreshToken,
          tokenExpiry: tokenExpiry ? calculateTokenExpiry(tokenExpiry) : null,
          accountName,
          mccId,
          metadata,
          status: 'CONNECTED',
          isActive: true,
          lastError: null,
        },
      })

      return NextResponse.json({ dataSource, updated: true })
    }

    // Create new connection
    const dataSource = await prisma.dataSource.create({
      data: {
        projectId,
        type,
        accessToken,
        refreshToken,
        tokenExpiry: tokenExpiry ? calculateTokenExpiry(tokenExpiry) : null,
        accountId,
        accountName,
        mccId,
        metadata,
        status: 'CONNECTED',
        isActive: true,
      },
    })

    return NextResponse.json({ dataSource, created: true })
  } catch (error) {
    console.error('[DataSources POST] Error:', error)
    return NextResponse.json(
      { error: 'Error al crear la conexión' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/datasources?projectId=xxx
 *
 * List all data sources for a project.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Se requiere projectId' },
        { status: 400 }
      )
    }

    // Verify project access
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

    if (session.user.role !== 'ADMIN' && project.members.length === 0) {
      return NextResponse.json(
        { error: 'No tienes acceso a este proyecto' },
        { status: 403 }
      )
    }

    // Get data sources (exclude sensitive token data)
    const dataSources = await prisma.dataSource.findMany({
      where: { projectId },
      select: {
        id: true,
        type: true,
        accountId: true,
        accountName: true,
        mccId: true,
        metadata: true,
        status: true,
        isActive: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ dataSources })
  } catch (error) {
    console.error('[DataSources GET] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener fuentes de datos' },
      { status: 500 }
    )
  }
}
