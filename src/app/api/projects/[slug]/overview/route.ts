import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOverview } from '@/lib/claude'

// GET: Obtener el overview más reciente del proyecto
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

    // Buscar el overview más reciente
    const overview = await prisma.report.findFirst({
      where: {
        projectId: project.id,
        type: 'OVERVIEW',
      },
      orderBy: { createdAt: 'desc' },
      include: {
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

// POST: Generar un nuevo overview
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
            description: true,
            createdAt: true,
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

    // Crear el registro del overview en estado PROCESSING
    const overview = await prisma.report.create({
      data: {
        projectId: project.id,
        title: `Overview - ${project.name}`,
        description: `Resumen ejecutivo del proyecto ${project.name}`,
        type: 'OVERVIEW',
        status: 'PROCESSING',
        prompt: 'Generación automática de overview',
        createdById: session.user.id,
      },
    })

    // Obtener feedback acumulado
    const [approvedProposals, rejectedProposals, answeredQuestions] = await Promise.all([
      prisma.aIProposal.findMany({
        where: { projectId: project.id, status: 'APPROVED' },
        select: { title: true, description: true },
      }),
      prisma.aIProposal.findMany({
        where: { projectId: project.id, status: 'REJECTED' },
        select: { title: true, description: true },
      }),
      prisma.aIQuestion.findMany({
        where: { projectId: project.id, status: 'ANSWERED' },
        select: { question: true, answer: true },
      }),
    ])

    // Preparar datos de los informes
    const reportsData = project.reports.map((r) => ({
      title: r.title,
      summary: r.executiveSummary || r.description || 'Sin resumen',
      date: r.createdAt.toISOString().split('T')[0],
    }))

    // Generar overview con IA (async)
    generateOverview(
      project.aiContext || project.description || `Proyecto: ${project.name}`,
      reportsData,
      {
        approvedProposals,
        rejectedProposals,
        answeredQuestions: answeredQuestions
          .filter((q) => q.answer)
          .map((q) => ({ question: q.question, answer: q.answer! })),
      }
    )
      .then(async (result) => {
        // Actualizar overview con el resultado
        await prisma.report.update({
          where: { id: overview.id },
          data: {
            status: 'READY',
            htmlContent: result.html,
            aiMetadata: result.metadata as object,
          },
        })

        // Crear nuevas preguntas si las hay
        if (result.questions.length > 0) {
          await prisma.aIQuestion.createMany({
            data: result.questions.map((q) => ({
              projectId: project.id,
              reportId: overview.id,
              question: q.question,
              context: q.context,
            })),
          })
        }

        // Crear nuevas propuestas si las hay
        if (result.proposals.length > 0) {
          await prisma.aIProposal.createMany({
            data: result.proposals.map((p) => ({
              projectId: project.id,
              reportId: overview.id,
              type: p.type as 'ACTION' | 'INSIGHT' | 'RISK' | 'OPPORTUNITY',
              title: p.title,
              description: p.description,
              priority: p.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
            })),
          })
        }

        console.log(`[Overview] Generado exitosamente para proyecto ${project.slug}`)
      })
      .catch(async (error) => {
        console.error('[Overview] Error generando:', error)
        await prisma.report.update({
          where: { id: overview.id },
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
