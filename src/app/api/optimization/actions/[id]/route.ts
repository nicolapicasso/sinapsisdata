import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/google/data-extraction'
import { executeOptimizationAction } from '@/lib/google/ads-mutations'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/optimization/actions/[id]
 *
 * Get action details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const action = await prisma.optimizationAction.findUnique({
      where: { id: params.id },
      include: {
        project: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
        dataSource: {
          select: {
            accountId: true,
            accountName: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && action.project.members.length === 0) {
      return NextResponse.json({ error: 'No tienes acceso a esta acción' }, { status: 403 })
    }

    return NextResponse.json({ action })
  } catch (error) {
    console.error('[Action GET] Error:', error)
    return NextResponse.json({ error: 'Error al obtener acción' }, { status: 500 })
  }
}

/**
 * PATCH /api/optimization/actions/[id]
 *
 * Update action status (approve/reject)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para modificar acciones' },
        { status: 403 }
      )
    }

    const action = await prisma.optimizationAction.findUnique({
      where: { id: params.id },
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

    if (!action) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && action.project.members.length === 0) {
      return NextResponse.json({ error: 'No tienes acceso a esta acción' }, { status: 403 })
    }

    const body = await request.json()
    const { status, comment } = body

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Estado inválido. Debe ser APPROVED o REJECTED' },
        { status: 400 }
      )
    }

    if (action.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Solo se pueden modificar acciones pendientes' },
        { status: 400 }
      )
    }

    const updated = await prisma.optimizationAction.update({
      where: { id: params.id },
      data: {
        status,
        userComment: comment || null,
        reviewedAt: new Date(),
      },
    })

    return NextResponse.json({ action: updated })
  } catch (error) {
    console.error('[Action PATCH] Error:', error)
    return NextResponse.json({ error: 'Error al actualizar acción' }, { status: 500 })
  }
}

/**
 * POST /api/optimization/actions/[id]/execute
 *
 * Execute an approved action
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para ejecutar acciones' },
        { status: 403 }
      )
    }

    const action = await prisma.optimizationAction.findUnique({
      where: { id: params.id },
      include: {
        dataSource: true,
        project: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && action.project.members.length === 0) {
      return NextResponse.json({ error: 'No tienes acceso a esta acción' }, { status: 403 })
    }

    if (action.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Solo se pueden ejecutar acciones aprobadas' },
        { status: 400 }
      )
    }

    // Get valid access token
    const { accessToken, customerId, loginCustomerId } = await getValidAccessToken(
      action.dataSourceId
    )

    // Execute the action
    console.log(`[Optimization] Executing action ${action.id}: ${action.type}`)

    const result = await executeOptimizationAction(
      accessToken,
      customerId,
      {
        type: action.type,
        payload: action.payload as Record<string, unknown>,
        targetEntity: action.targetEntity as {
          campaignId?: string
          adGroupId?: string
          keywordId?: string
        },
      },
      loginCustomerId
    )

    // Update action status
    const updated = await prisma.optimizationAction.update({
      where: { id: params.id },
      data: {
        status: result.success ? 'EXECUTED' : 'FAILED',
        executedAt: new Date(),
        result: result.success ? { resourceName: result.resourceName } : null,
        errorMessage: result.error || null,
      },
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, action: updated },
        { status: 400 }
      )
    }

    return NextResponse.json({
      action: updated,
      resourceName: result.resourceName,
    })
  } catch (error) {
    console.error('[Action Execute] Error:', error)

    // Update action as failed
    await prisma.optimizationAction.update({
      where: { id: params.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Error desconocido',
      },
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al ejecutar acción' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/optimization/actions/[id]
 *
 * Delete a pending action
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar acciones' },
        { status: 403 }
      )
    }

    const action = await prisma.optimizationAction.findUnique({
      where: { id: params.id },
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

    if (!action) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && action.project.members.length === 0) {
      return NextResponse.json({ error: 'No tienes acceso a esta acción' }, { status: 403 })
    }

    if (action.status === 'EXECUTED') {
      return NextResponse.json(
        { error: 'No se pueden eliminar acciones ejecutadas' },
        { status: 400 }
      )
    }

    await prisma.optimizationAction.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Action DELETE] Error:', error)
    return NextResponse.json({ error: 'Error al eliminar acción' }, { status: 500 })
  }
}
