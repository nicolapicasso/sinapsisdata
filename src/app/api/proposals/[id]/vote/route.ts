import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admin y consultores pueden votar
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos para votar propuestas' }, { status: 403 })
    }

    const { id } = await params
    const { action, comment } = await req.json()

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Accion invalida' }, { status: 400 })
    }

    const proposal = await prisma.aIProposal.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: { select: { userId: true } },
          },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    }

    // Verificar acceso al proyecto
    if (session.user.role !== 'ADMIN') {
      const isMember = proposal.project.members.some((m) => m.userId === session.user.id)
      if (!isMember) {
        return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
      }
    }

    const updated = await prisma.aIProposal.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        votedById: session.user.id,
        votedAt: new Date(),
        voteComment: comment || null,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error voting proposal:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
