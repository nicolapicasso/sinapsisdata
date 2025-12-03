import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// POST - Crear informe
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const {
      projectSlug,
      title,
      description,
      prompt,
      periodFrom,
      periodTo,
      useHtmlDirectly,
      htmlContent,
    } = await req.json()

    // Si NO usamos HTML directamente, el prompt es requerido
    if (!projectSlug || !title) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (!useHtmlDirectly && !prompt) {
      return NextResponse.json({ error: 'El prompt es requerido' }, { status: 400 })
    }

    // Verificar que el proyecto existe y el usuario tiene acceso
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        members: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Verificar permisos
    const isMember = project.members.some((m) => m.userId === session.user.id)
    if (session.user.role !== 'ADMIN' && !isMember) {
      return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
    }

    // Solo ADMIN y CONSULTANT pueden crear informes
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos para crear informes' }, { status: 403 })
    }

    // Si usamos HTML directamente, el informe ya está listo
    const report = await prisma.report.create({
      data: {
        projectId: project.id,
        title,
        description,
        prompt: prompt || '',
        periodFrom: periodFrom ? new Date(periodFrom) : null,
        periodTo: periodTo ? new Date(periodTo) : null,
        createdById: session.user.id,
        // Si usamos HTML directamente, guardamos el contenido y marcamos como READY
        status: useHtmlDirectly ? 'READY' : 'DRAFT',
        htmlContent: useHtmlDirectly ? htmlContent : null,
        // Marcar que fue subido directamente (sin consumo de IA)
        aiMetadata: useHtmlDirectly
          ? ({ source: 'UPLOADED', inputTokens: 0, outputTokens: 0 } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error creating report:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
