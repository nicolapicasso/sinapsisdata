import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OptimizationActionType, OptimizationActionStatus, Prisma } from '@prisma/client'

/**
 * GET /api/optimization/actions?projectId=xxx
 *
 * List optimization actions for a project
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status') as OptimizationActionStatus | null

    if (!projectId) {
      return NextResponse.json({ error: 'Se requiere projectId' }, { status: 400 })
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
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && project.members.length === 0) {
      return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
    }

    const where: {
      projectId: string
      status?: OptimizationActionStatus
    } = { projectId }

    if (status) {
      where.status = status
    }

    const actions = await prisma.optimizationAction.findMany({
      where,
      include: {
        dataSource: {
          select: {
            accountName: true,
            accountId: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ actions })
  } catch (error) {
    console.error('[Optimization Actions GET] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener acciones' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/optimization/actions
 *
 * Create new optimization action(s) from analysis suggestions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para crear acciones de optimización' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { projectId, dataSourceId, suggestions } = body

    if (!projectId || !dataSourceId || !suggestions || !Array.isArray(suggestions)) {
      return NextResponse.json(
        { error: 'Se requieren projectId, dataSourceId y suggestions' },
        { status: 400 }
      )
    }

    // Verify access
    const dataSource = await prisma.dataSource.findUnique({
      where: { id: dataSourceId },
      include: {
        project: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!dataSource) {
      return NextResponse.json({ error: 'Fuente de datos no encontrada' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && dataSource.project.members.length === 0) {
      return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
    }

    // Create actions
    const actions = await prisma.$transaction(
      suggestions.map((suggestion: {
        type: string
        title: string
        description: string
        reason: string
        payload: Record<string, unknown>
        targetEntity: Record<string, unknown>
        metrics?: Record<string, unknown>
      }) =>
        prisma.optimizationAction.create({
          data: {
            projectId,
            dataSourceId,
            userId: session.user.id,
            type: suggestion.type as OptimizationActionType,
            payload: suggestion.payload as Prisma.InputJsonValue,
            targetEntity: suggestion.targetEntity as Prisma.InputJsonValue,
            claudeReason: `${suggestion.title}\n\n${suggestion.description}\n\nRazón: ${suggestion.reason}`,
            metrics: suggestion.metrics ? (suggestion.metrics as Prisma.InputJsonValue) : Prisma.JsonNull,
            status: 'PENDING',
          },
        })
      )
    )

    return NextResponse.json({ actions, count: actions.length })
  } catch (error) {
    console.error('[Optimization Actions POST] Error:', error)
    return NextResponse.json(
      { error: 'Error al crear acciones' },
      { status: 500 }
    )
  }
}
