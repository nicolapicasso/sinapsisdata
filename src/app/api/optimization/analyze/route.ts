import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { extractGoogleAdsData } from '@/lib/google/data-extraction'
import { analyzeGoogleAdsData, generateAnalysisReport } from '@/lib/google/optimization-analyzer'

/**
 * POST /api/optimization/analyze
 *
 * Analyze Google Ads data and generate optimization suggestions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permiso para acceder a la herramienta de optimización' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { dataSourceId, startDate, endDate } = body

    if (!dataSourceId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Se requieren dataSourceId, startDate y endDate' },
        { status: 400 }
      )
    }

    // Verify data source access
    const dataSource = await prisma.dataSource.findUnique({
      where: { id: dataSourceId },
      include: {
        project: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!dataSource) {
      return NextResponse.json(
        { error: 'Fuente de datos no encontrada' },
        { status: 404 }
      )
    }

    if (dataSource.type !== 'GOOGLE_ADS') {
      return NextResponse.json(
        { error: 'Esta fuente de datos no es Google Ads' },
        { status: 400 }
      )
    }

    if (session.user.role !== 'ADMIN' && dataSource.project.members.length === 0) {
      return NextResponse.json(
        { error: 'No tienes acceso a este proyecto' },
        { status: 403 }
      )
    }

    if (!dataSource.isActive) {
      return NextResponse.json(
        { error: 'La fuente de datos está desactivada' },
        { status: 400 }
      )
    }

    if (dataSource.status === 'EXPIRED') {
      return NextResponse.json(
        { error: 'El token ha expirado. Reconecta la cuenta de Google Ads.' },
        { status: 400 }
      )
    }

    // Extract data from Google Ads
    console.log(`[Optimization] Starting analysis for ${dataSource.accountName}`)
    const adsData = await extractGoogleAdsData(dataSourceId, startDate, endDate)

    // Analyze with Claude
    const analysis = await analyzeGoogleAdsData(adsData, dataSource.project.aiContext || undefined)

    // Generate human-readable report
    const report = generateAnalysisReport(analysis)

    return NextResponse.json({
      analysis,
      report,
      data: {
        accountId: adsData.accountId,
        accountName: adsData.accountName,
        dateRange: adsData.dateRange,
        summary: adsData.summary,
        campaignCount: adsData.campaigns.length,
        keywordCount: adsData.keywords.length,
        searchTermCount: adsData.searchTerms.length,
      },
    })
  } catch (error) {
    console.error('[Optimization Analyze] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al analizar' },
      { status: 500 }
    )
  }
}
