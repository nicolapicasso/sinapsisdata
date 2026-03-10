import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptTokens, encryptTokens } from '@/lib/encryption'
import { refreshAccessToken, calculateTokenExpiry } from '@/lib/google/oauth'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/datasources/[id]
 *
 * Get a specific data source details.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const dataSource = await prisma.dataSource.findUnique({
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

    if (!dataSource) {
      return NextResponse.json(
        { error: 'Fuente de datos no encontrada' },
        { status: 404 }
      )
    }

    // Check access
    if (session.user.role !== 'ADMIN' && dataSource.project.members.length === 0) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta fuente de datos' },
        { status: 403 }
      )
    }

    // Return without sensitive data (omit tokens)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accessToken, refreshToken, project, ...safeData } = dataSource

    return NextResponse.json({
      dataSource: {
        ...safeData,
        projectSlug: project.slug,
      },
    })
  } catch (error) {
    console.error('[DataSource GET] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener fuente de datos' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/datasources/[id]
 *
 * Update a data source (toggle active, etc.)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para modificar fuentes de datos' },
        { status: 403 }
      )
    }

    const dataSource = await prisma.dataSource.findUnique({
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

    if (!dataSource) {
      return NextResponse.json(
        { error: 'Fuente de datos no encontrada' },
        { status: 404 }
      )
    }

    if (session.user.role !== 'ADMIN' && dataSource.project.members.length === 0) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta fuente de datos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { isActive } = body

    const updated = await prisma.dataSource.update({
      where: { id: params.id },
      data: {
        isActive: isActive !== undefined ? isActive : dataSource.isActive,
      },
      select: {
        id: true,
        type: true,
        accountId: true,
        accountName: true,
        status: true,
        isActive: true,
        lastSyncAt: true,
        lastError: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ dataSource: updated })
  } catch (error) {
    console.error('[DataSource PATCH] Error:', error)
    return NextResponse.json(
      { error: 'Error al actualizar fuente de datos' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/datasources/[id]
 *
 * Delete a data source connection.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar fuentes de datos' },
        { status: 403 }
      )
    }

    const dataSource = await prisma.dataSource.findUnique({
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

    if (!dataSource) {
      return NextResponse.json(
        { error: 'Fuente de datos no encontrada' },
        { status: 404 }
      )
    }

    if (session.user.role !== 'ADMIN' && dataSource.project.members.length === 0) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta fuente de datos' },
        { status: 403 }
      )
    }

    await prisma.dataSource.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DataSource DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Error al eliminar fuente de datos' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/datasources/[id]/refresh
 *
 * Refresh the access token for a data source.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para actualizar tokens' },
        { status: 403 }
      )
    }

    const dataSource = await prisma.dataSource.findUnique({
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

    if (!dataSource) {
      return NextResponse.json(
        { error: 'Fuente de datos no encontrada' },
        { status: 404 }
      )
    }

    if (session.user.role !== 'ADMIN' && dataSource.project.members.length === 0) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta fuente de datos' },
        { status: 403 }
      )
    }

    // Decrypt current tokens
    const tokens = decryptTokens({
      accessToken: dataSource.accessToken,
      refreshToken: dataSource.refreshToken,
    })

    // Determine service type
    const service = dataSource.type === 'GOOGLE_ADS' ? 'google_ads' : 'google_analytics'

    // Refresh the token
    const newTokens = await refreshAccessToken(service, tokens.refreshToken)

    // Encrypt new tokens
    const encrypted = encryptTokens({
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || tokens.refreshToken,
    })

    // Update in database
    const updated = await prisma.dataSource.update({
      where: { id: params.id },
      data: {
        accessToken: encrypted.accessToken,
        refreshToken: encrypted.refreshToken,
        tokenExpiry: calculateTokenExpiry(newTokens.expires_in),
        status: 'CONNECTED',
        lastError: null,
      },
      select: {
        id: true,
        type: true,
        accountName: true,
        status: true,
        tokenExpiry: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ dataSource: updated, refreshed: true })
  } catch (error) {
    console.error('[DataSource Refresh] Error:', error)

    // Mark as error if refresh failed
    await prisma.dataSource.update({
      where: { id: params.id },
      data: {
        status: 'EXPIRED',
        lastError: error instanceof Error ? error.message : 'Error al refrescar token',
      },
    })

    return NextResponse.json(
      { error: 'Error al refrescar el token. Es posible que necesites reconectar la cuenta.' },
      { status: 500 }
    )
  }
}
