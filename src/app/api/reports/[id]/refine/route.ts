import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { refineReport } from '@/lib/claude'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admin y consultores pueden refinar
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos para modificar informes' }, { status: 403 })
    }

    const { id } = await params
    const { prompt } = await req.json()

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'El prompt es requerido' }, { status: 400 })
    }

    // Obtener el informe actual
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: { select: { userId: true } },
          },
        },
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
    }

    // Verificar acceso al proyecto
    if (session.user.role !== 'ADMIN') {
      const isMember = report.project.members.some((m) => m.userId === session.user.id)
      if (!isMember) {
        return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
      }
    }

    if (!report.htmlContent) {
      return NextResponse.json({ error: 'El informe no tiene contenido para modificar' }, { status: 400 })
    }

    // Marcar como procesando
    await prisma.report.update({
      where: { id },
      data: { status: 'PROCESSING' },
    })

    // Refinar el informe
    const result = await refineReport({
      currentHtml: report.htmlContent,
      refinementPrompt: prompt,
      projectContext: report.project.aiContext || report.project.description || undefined,
    })

    // Guardar el nuevo HTML
    await prisma.report.update({
      where: { id },
      data: {
        status: 'READY',
        htmlContent: result.html,
        aiMetadata: result.metadata,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error refinando informe:', error)

    // Intentar restaurar estado
    try {
      const { id } = await params
      await prisma.report.update({
        where: { id },
        data: { status: 'READY' },
      })
    } catch {
      // Ignorar
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error refinando informe' },
      { status: 500 }
    )
  }
}
