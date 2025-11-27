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

    // Solo admin y consultores pueden responder
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos para responder preguntas' }, { status: 403 })
    }

    const { id } = await params
    const { answer } = await req.json()

    if (!answer?.trim()) {
      return NextResponse.json({ error: 'La respuesta es requerida' }, { status: 400 })
    }

    const question = await prisma.aIQuestion.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: { select: { userId: true } },
          },
        },
      },
    })

    if (!question) {
      return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })
    }

    // Verificar acceso al proyecto
    if (session.user.role !== 'ADMIN') {
      const isMember = question.project.members.some((m) => m.userId === session.user.id)
      if (!isMember) {
        return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
      }
    }

    const updated = await prisma.aIQuestion.update({
      where: { id },
      data: {
        answer,
        status: 'ANSWERED',
        answeredById: session.user.id,
        answeredAt: new Date(),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error answering question:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
