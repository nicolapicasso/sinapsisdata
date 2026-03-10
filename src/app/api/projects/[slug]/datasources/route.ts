import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Obtener data sources de un proyecto
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        members: true,
        dataSources: {
          select: {
            id: true,
            type: true,
            accountId: true,
            accountName: true,
            status: true,
            isActive: true,
            lastSyncAt: true,
            metadata: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Verificar acceso
    if (session.user.role !== 'ADMIN') {
      const isMember = project.members.some((m) => m.userId === session.user.id)
      if (!isMember) {
        return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
      }
    }

    return NextResponse.json(project.dataSources)
  } catch (error) {
    console.error('Error fetching project data sources:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
