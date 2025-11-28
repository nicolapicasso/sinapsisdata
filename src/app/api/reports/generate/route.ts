import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateReport } from '@/lib/claude'
import { parseCSV } from '@/lib/csv-parser'
import { readFile } from 'fs/promises'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { reportId } = await req.json()

    // Obtener informe con archivos y proyecto
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        files: true,
        project: true,
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
    }

    // Actualizar estado a procesando
    await prisma.report.update({
      where: { id: reportId },
      data: { status: 'PROCESSING' },
    })

    // Parsear todos los CSVs
    const allData: Record<string, unknown>[] = []
    for (const file of report.files) {
      if (file.mimeType === 'text/csv' || file.originalName.endsWith('.csv')) {
        try {
          const content = await readFile(file.path, 'utf-8')
          const parsed = parseCSV(content)

          // Guardar datos parseados
          await prisma.reportFile.update({
            where: { id: file.id },
            data: {
              parsedData: parsed.data,
              columns: parsed.columns,
              rowCount: parsed.rowCount,
            },
          })

          allData.push(...parsed.data)
        } catch (err) {
          console.error(`Error parsing file ${file.originalName}:`, err)
        }
      }
    }

    if (allData.length === 0) {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'ERROR',
          errorMessage: 'No se encontraron datos en los archivos CSV',
        },
      })
      return NextResponse.json({ error: 'No hay datos para analizar' }, { status: 400 })
    }

    // Obtener feedback previo del proyecto
    const [approvedProposals, rejectedProposals, answeredQuestions] = await Promise.all([
      prisma.aIProposal.findMany({
        where: { projectId: report.projectId, status: 'APPROVED' },
        select: { title: true },
      }),
      prisma.aIProposal.findMany({
        where: { projectId: report.projectId, status: 'REJECTED' },
        select: { title: true },
      }),
      prisma.aIQuestion.findMany({
        where: { projectId: report.projectId, status: 'ANSWERED' },
        select: { question: true, answer: true },
      }),
    ])

    // Generar informe con IA
    const result = await generateReport({
      projectContext: report.project.aiContext || report.project.description || '',
      reportPrompt: report.prompt,
      csvData: allData,
      previousFeedback: {
        approvedProposals: approvedProposals.map((p) => p.title),
        rejectedProposals: rejectedProposals.map((p) => p.title),
        answeredQuestions: answeredQuestions.map((q) => ({
          question: q.question,
          answer: q.answer!,
        })),
      },
    })

    // Guardar resultado
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'READY',
        htmlContent: result.html,
        aiMetadata: result.metadata,
      },
    })

    // Crear preguntas
    if (result.questions.length > 0) {
      await prisma.aIQuestion.createMany({
        data: result.questions.map((q) => ({
          projectId: report.projectId,
          reportId: reportId,
          question: q.question,
          context: q.context,
        })),
      })
    }

    // Crear propuestas
    if (result.proposals.length > 0) {
      await prisma.aIProposal.createMany({
        data: result.proposals.map((p) => ({
          projectId: report.projectId,
          reportId: reportId,
          type: p.type,
          title: p.title,
          description: p.description,
          priority: p.priority,
          metadata: p.metadata,
        })),
      })
    }

    return NextResponse.json({ success: true, reportId })
  } catch (error) {
    console.error('Error generando informe:', error)

    // Marcar como error si tenemos reportId
    try {
      const body = await req.clone().json()
      if (body.reportId) {
        await prisma.report.update({
          where: { id: body.reportId },
          data: {
            status: 'ERROR',
            errorMessage: error instanceof Error ? error.message : 'Error desconocido',
          },
        })
      }
    } catch {
      // Ignorar error de parsing
    }

    return NextResponse.json(
      { error: 'Error generando informe' },
      { status: 500 }
    )
  }
}
