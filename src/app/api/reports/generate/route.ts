import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateReport } from '@/lib/claude'
import { parseCSV } from '@/lib/csv-parser'
import { readFile } from 'fs/promises'
import { Prisma } from '@prisma/client'
import { extractGoogleAdsData, GoogleAdsAnalysisData } from '@/lib/google/data-extraction'
import { extractGoogleAnalyticsData, analyticsDataToRows, GoogleAnalyticsData } from '@/lib/google/analytics-extraction'

// Convert Google Ads data to rows for AI analysis
function adsDataToRows(data: GoogleAdsAnalysisData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  // Add summary
  rows.push({
    _type: 'summary',
    source: 'Google Ads',
    account: data.accountName,
    dateRange: `${data.dateRange.startDate} to ${data.dateRange.endDate}`,
    ...data.summary,
  })

  // Add campaigns
  data.campaigns.forEach((c) => {
    rows.push({ _type: 'campaign', ...c })
  })

  // Add ad groups (top 50)
  data.adGroups.slice(0, 50).forEach((ag) => {
    rows.push({ _type: 'ad_group', ...ag })
  })

  // Add keywords (top 100)
  data.keywords.slice(0, 100).forEach((k) => {
    rows.push({ _type: 'keyword', ...k })
  })

  // Add search terms (top 100)
  data.searchTerms.slice(0, 100).forEach((st) => {
    rows.push({ _type: 'search_term', ...st })
  })

  // Add placements if any
  data.placements.slice(0, 50).forEach((p) => {
    rows.push({ _type: 'placement', ...p })
  })

  return rows
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { reportId, dataSourceIds = [] } = await req.json()

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

    const allData: Record<string, unknown>[] = []

    console.log(`[Report Generate] dataSourceIds received:`, dataSourceIds)
    console.log(`[Report Generate] periodFrom: ${report.periodFrom}, periodTo: ${report.periodTo}`)

    // 1. Obtener datos de data sources conectados (Analytics/Ads)
    if (dataSourceIds.length > 0) {
      if (!report.periodFrom || !report.periodTo) {
        console.log(`[Report Generate] WARNING: Period not set, skipping data source extraction`)
      } else {
        // Ensure dates don't go into the future (GA4 can't handle future dates)
        const today = new Date()
        const effectiveEndDate = report.periodTo > today ? today : report.periodTo

        const startDate = report.periodFrom.toISOString().split('T')[0]
        const endDate = effectiveEndDate.toISOString().split('T')[0]

        console.log(`[Report Generate] Using date range: ${startDate} to ${endDate}`)

        // Obtener los data sources seleccionados
        const dataSources = await prisma.dataSource.findMany({
          where: {
            id: { in: dataSourceIds },
            projectId: report.projectId,
            status: 'CONNECTED',
            isActive: true,
          },
        })

        console.log(`[Report Generate] Found ${dataSources.length} data sources matching criteria`)

        for (const ds of dataSources) {
          try {
            if (ds.type === 'GOOGLE_ANALYTICS') {
              console.log(`[Report Generate] Extracting Google Analytics data for ${ds.accountName}`)
              const gaData: GoogleAnalyticsData = await extractGoogleAnalyticsData(ds.id, startDate, endDate)
              const gaRows = analyticsDataToRows(gaData)
              allData.push(...gaRows)
              console.log(`[Report Generate] Got ${gaRows.length} rows from Google Analytics`)
            } else if (ds.type === 'GOOGLE_ADS') {
              console.log(`[Report Generate] Extracting Google Ads data for ${ds.accountName}`)
              const adsData: GoogleAdsAnalysisData = await extractGoogleAdsData(ds.id, startDate, endDate)
              const adsRows = adsDataToRows(adsData)
              allData.push(...adsRows)
              console.log(`[Report Generate] Got ${adsRows.length} rows from Google Ads`)
            }
          } catch (err) {
            console.error(`[Report Generate] Error extracting data from ${ds.type} ${ds.accountName}:`, err)
            // Continue with other data sources
          }
        }
      }
    }

    // 2. Parsear archivos CSV
    for (const file of report.files) {
      if (file.mimeType === 'text/csv' || file.originalName.endsWith('.csv')) {
        try {
          const content = await readFile(file.path, 'utf-8')
          const parsed = parseCSV(content)

          // Guardar datos parseados
          await prisma.reportFile.update({
            where: { id: file.id },
            data: {
              parsedData: parsed.data as unknown as Prisma.JsonArray,
              columns: parsed.columns as unknown as Prisma.JsonArray,
              rowCount: parsed.rowCount,
            },
          })

          // Marcar los datos de CSV con su origen
          const csvRows = parsed.data.map((row) => ({
            _type: 'csv_data',
            _source: file.originalName,
            ...row,
          }))
          allData.push(...csvRows)
          console.log(`[Report Generate] Got ${csvRows.length} rows from CSV ${file.originalName}`)
        } catch (err) {
          console.error(`Error parsing file ${file.originalName}:`, err)
        }
      }
    }

    // Verificar que hay datos
    if (allData.length === 0) {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'ERROR',
          errorMessage: 'No se encontraron datos para analizar. Verifica que las conexiones esten activas o sube archivos CSV.',
        },
      })
      return NextResponse.json({ error: 'No hay datos para analizar' }, { status: 400 })
    }

    console.log(`[Report Generate] Total data rows for analysis: ${allData.length}`)

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
          metadata: p.metadata as Prisma.InputJsonValue | undefined,
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
