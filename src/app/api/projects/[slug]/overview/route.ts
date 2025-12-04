import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOverview } from '@/lib/claude'

// Helper para formatear fecha
function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// GET: Obtener el overview del proyecto
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Buscar el overview (solo hay uno por proyecto)
    const overview = await prisma.report.findFirst({
      where: {
        projectId: project.id,
        type: 'OVERVIEW',
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        htmlContent: true,
        executiveSummary: true,
        aiMetadata: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ overview })
  } catch (error) {
    console.error('Error obteniendo overview:', error)
    return NextResponse.json(
      { error: 'Error obteniendo overview' },
      { status: 500 }
    )
  }
}

// POST: Generar/regenerar el overview
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admins y consultores pueden generar overviews
    if (session.user.role !== 'ADMIN' && session.user.role !== 'CONSULTANT') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    // Obtener proyecto con todos los datos necesarios
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        reports: {
          where: {
            type: 'CUSTOM',
            status: 'READY',
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            createdAt: true,
            periodFrom: true,
            periodTo: true,
            htmlContent: true,
            executiveSummary: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Verificar que hay al menos un informe para generar el overview
    if (project.reports.length === 0) {
      return NextResponse.json(
        { error: 'Se necesita al menos un informe generado para crear el overview' },
        { status: 400 }
      )
    }

    // Buscar overview existente o crear uno nuevo
    let overview = await prisma.report.findFirst({
      where: {
        projectId: project.id,
        type: 'OVERVIEW',
      },
    })

    if (overview) {
      // Actualizar existente a PROCESSING
      overview = await prisma.report.update({
        where: { id: overview.id },
        data: {
          status: 'PROCESSING',
          errorMessage: null,
          updatedAt: new Date(),
        },
      })
    } else {
      // Crear nuevo
      overview = await prisma.report.create({
        data: {
          projectId: project.id,
          title: `Overview - ${project.name}`,
          description: `Dashboard ejecutivo del proyecto ${project.name}`,
          type: 'OVERVIEW',
          status: 'PROCESSING',
          prompt: 'Generación de overview ejecutivo',
          createdById: session.user.id,
        },
      })
    }

    // Obtener propuestas y preguntas
    const [approvedProposals, rejectedProposals, answeredQuestions] = await Promise.all([
      prisma.aIProposal.findMany({
        where: { projectId: project.id, status: 'APPROVED' },
        select: { type: true, title: true, description: true, votedAt: true },
      }),
      prisma.aIProposal.findMany({
        where: { projectId: project.id, status: 'REJECTED' },
        select: { title: true },
      }),
      prisma.aIQuestion.findMany({
        where: { projectId: project.id, status: 'ANSWERED' },
        select: { question: true, answer: true },
      }),
    ])

    // Preparar datos para la función generateOverview
    const overviewParams = {
      project: {
        name: project.name,
        description: project.description,
        aiContext: project.aiContext,
      },
      reports: project.reports.map((r) => ({
        title: r.title,
        createdAt: formatDate(r.createdAt),
        periodFrom: r.periodFrom ? formatDate(r.periodFrom) : undefined,
        periodTo: r.periodTo ? formatDate(r.periodTo) : undefined,
        htmlContent: r.htmlContent,
        executiveSummary: r.executiveSummary,
      })),
      approvedProposals: approvedProposals.map((p) => ({
        type: p.type,
        title: p.title,
        description: p.description,
        votedAt: p.votedAt || undefined,
      })),
      answeredQuestions: answeredQuestions
        .filter((q) => q.answer)
        .map((q) => ({
          question: q.question,
          answer: q.answer!,
        })),
      rejectedProposalTitles: rejectedProposals.map((p) => p.title),
    }

    // Generar overview con IA (async)
    const overviewId = overview.id
    const existingMetadata = overview.aiMetadata as { inputTokens?: number; outputTokens?: number; duration?: number } | null

    generateOverview(overviewParams)
      .then(async (result) => {
        // ACUMULAR tokens en lugar de sobrescribir
        const accumulatedMetadata = {
          model: result.metadata.model,
          inputTokens: (existingMetadata?.inputTokens || 0) + result.metadata.inputTokens,
          outputTokens: (existingMetadata?.outputTokens || 0) + result.metadata.outputTokens,
          duration: (existingMetadata?.duration || 0) + result.metadata.duration,
          projectStatus: result.projectStatus,
        }

        // Actualizar overview con el resultado
        await prisma.report.update({
          where: { id: overviewId },
          data: {
            status: 'READY',
            htmlContent: result.html,
            executiveSummary: result.summary,
            aiMetadata: accumulatedMetadata,
          },
        })

        console.log(`[Overview] Generado exitosamente para proyecto ${project.slug} - Status: ${result.projectStatus}`)
      })
      .catch(async (error) => {
        console.error('[Overview] Error generando:', error)
        await prisma.report.update({
          where: { id: overviewId },
          data: {
            status: 'ERROR',
            errorMessage: error instanceof Error ? error.message : 'Error desconocido',
          },
        })
      })

    return NextResponse.json({
      success: true,
      overviewId: overview.id,
      message: 'Generando overview...',
    })
  } catch (error) {
    console.error('Error generando overview:', error)
    return NextResponse.json(
      { error: 'Error generando overview' },
      { status: 500 }
    )
  }
}
