import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Obtener informe
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const report = await prisma.report.findUnique({
      where: { id: params.id },
      include: {
        project: {
          include: {
            members: true,
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        files: true,
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
    }

    // Verificar acceso
    if (session.user.role !== 'ADMIN') {
      const isMember = report.project.members.some((m) => m.userId === session.user.id)
      if (!isMember) {
        return NextResponse.json({ error: 'No tienes acceso a este informe' }, { status: 403 })
      }
    }

    // Los clientes solo pueden ver informes READY
    if (session.user.role === 'CLIENT' && report.status !== 'READY') {
      return NextResponse.json({ error: 'Este informe aun no esta disponible' }, { status: 403 })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error fetching report:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Eliminar informe
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const report = await prisma.report.findUnique({
      where: { id: params.id },
      include: {
        project: {
          include: {
            members: true,
          },
        },
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
    }

    // Verificar permisos
    const isOwner = report.project.members.some(
      (m) => m.userId === session.user.id && (m.role === 'OWNER' || m.role === 'CONSULTANT')
    )

    if (session.user.role !== 'ADMIN' && !isOwner) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar este informe' }, { status: 403 })
    }

    await prisma.report.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting report:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
