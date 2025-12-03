import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import Link from 'next/link'
import { ArrowLeft, Coins, FileText, TrendingUp, Calendar } from 'lucide-react'

// Precios de Claude Sonnet 3.5 (por millón de tokens)
const PRICE_INPUT_PER_MILLION = 3 // $3 por millón de tokens de entrada
const PRICE_OUTPUT_PER_MILLION = 15 // $15 por millón de tokens de salida

interface AIMetadata {
  model?: string
  inputTokens?: number
  outputTokens?: number
  duration?: number
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRICE_INPUT_PER_MILLION
  const outputCost = (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_MILLION
  return inputCost + outputCost
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M'
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K'
  }
  return num.toString()
}

export default async function UsagePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Solo admin y consultores pueden ver esta página
  if (session.user.role === 'CLIENT') {
    redirect('/dashboard')
  }

  // Obtener todos los informes con aiMetadata
  const reports = await prisma.report.findMany({
    where: {
      status: 'READY',
      NOT: {
        aiMetadata: {
          equals: Prisma.DbNull,
        },
      },
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Calcular estadísticas totales
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalReports = 0

  const projectStats: Record<string, {
    name: string
    slug: string
    inputTokens: number
    outputTokens: number
    reports: number
  }> = {}

  // Estadísticas por mes
  const monthlyStats: Record<string, {
    inputTokens: number
    outputTokens: number
    reports: number
  }> = {}

  for (const report of reports) {
    const metadata = report.aiMetadata as AIMetadata | null
    if (!metadata) continue

    const inputTokens = metadata.inputTokens || 0
    const outputTokens = metadata.outputTokens || 0

    totalInputTokens += inputTokens
    totalOutputTokens += outputTokens
    totalReports++

    // Por proyecto
    if (report.project) {
      if (!projectStats[report.project.id]) {
        projectStats[report.project.id] = {
          name: report.project.name,
          slug: report.project.slug,
          inputTokens: 0,
          outputTokens: 0,
          reports: 0,
        }
      }
      projectStats[report.project.id].inputTokens += inputTokens
      projectStats[report.project.id].outputTokens += outputTokens
      projectStats[report.project.id].reports++
    }

    // Por mes
    const monthKey = new Date(report.createdAt).toISOString().slice(0, 7) // YYYY-MM
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { inputTokens: 0, outputTokens: 0, reports: 0 }
    }
    monthlyStats[monthKey].inputTokens += inputTokens
    monthlyStats[monthKey].outputTokens += outputTokens
    monthlyStats[monthKey].reports++
  }

  const totalCost = calculateCost(totalInputTokens, totalOutputTokens)

  // Ordenar proyectos por coste
  const sortedProjects = Object.values(projectStats).sort(
    (a, b) => calculateCost(b.inputTokens, b.outputTokens) - calculateCost(a.inputTokens, a.outputTokens)
  )

  // Ordenar meses (más reciente primero)
  const sortedMonths = Object.entries(monthlyStats).sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-primary mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark">Consumo de IA</h1>
        <p className="text-gray-500 mt-1">Estadísticas de uso de Claude AI</p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tokens entrada</p>
              <p className="text-xl font-bold text-dark">{formatNumber(totalInputTokens)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tokens salida</p>
              <p className="text-xl font-bold text-dark">{formatNumber(totalOutputTokens)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Coins className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Coste estimado</p>
              <p className="text-xl font-bold text-dark">${totalCost.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Informes generados</p>
              <p className="text-xl font-bold text-dark">{totalReports}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumo por proyecto */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-dark">Por proyecto</h2>
          </div>
          <div className="p-4">
            {sortedProjects.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay datos de consumo</p>
            ) : (
              <div className="space-y-4">
                {sortedProjects.map((project) => {
                  const cost = calculateCost(project.inputTokens, project.outputTokens)
                  return (
                    <div key={project.slug} className="flex items-center justify-between">
                      <div>
                        <Link
                          href={`/projects/${project.slug}`}
                          className="font-medium text-dark hover:text-primary transition"
                        >
                          {project.name}
                        </Link>
                        <p className="text-sm text-gray-500">
                          {project.reports} informe{project.reports !== 1 ? 's' : ''} · {formatNumber(project.inputTokens + project.outputTokens)} tokens
                        </p>
                      </div>
                      <span className="text-lg font-semibold text-green-600">
                        ${cost.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Consumo por mes */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-dark">Por mes</h2>
          </div>
          <div className="p-4">
            {sortedMonths.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay datos de consumo</p>
            ) : (
              <div className="space-y-4">
                {sortedMonths.slice(0, 6).map(([month, stats]) => {
                  const cost = calculateCost(stats.inputTokens, stats.outputTokens)
                  const [year, monthNum] = month.split('-')
                  const monthName = new Date(Number(year), Number(monthNum) - 1).toLocaleDateString('es-ES', {
                    month: 'long',
                    year: 'numeric'
                  })
                  return (
                    <div key={month} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-dark capitalize">{monthName}</p>
                          <p className="text-sm text-gray-500">
                            {stats.reports} informe{stats.reports !== 1 ? 's' : ''} · {formatNumber(stats.inputTokens + stats.outputTokens)} tokens
                          </p>
                        </div>
                      </div>
                      <span className="text-lg font-semibold text-green-600">
                        ${cost.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Últimos informes */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-dark">Últimos informes generados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                <th className="p-4 font-medium">Informe</th>
                <th className="p-4 font-medium">Proyecto</th>
                <th className="p-4 font-medium">Fecha</th>
                <th className="p-4 font-medium text-right">Input</th>
                <th className="p-4 font-medium text-right">Output</th>
                <th className="p-4 font-medium text-right">Coste</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 10).map((report) => {
                const metadata = report.aiMetadata as AIMetadata | null
                const inputTokens = metadata?.inputTokens || 0
                const outputTokens = metadata?.outputTokens || 0
                const cost = calculateCost(inputTokens, outputTokens)
                return (
                  <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <Link
                        href={`/projects/${report.project?.slug}/reports/${report.id}`}
                        className="font-medium text-dark hover:text-primary transition"
                      >
                        {report.title}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">
                        {report.type === 'OVERVIEW' ? 'Overview' : 'Informe'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{report.project?.name}</td>
                    <td className="p-4 text-gray-500 text-sm">
                      {new Date(report.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td className="p-4 text-right text-sm">{formatNumber(inputTokens)}</td>
                    <td className="p-4 text-right text-sm">{formatNumber(outputTokens)}</td>
                    <td className="p-4 text-right font-medium text-green-600">${cost.toFixed(3)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota sobre precios */}
      <div className="mt-4 text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">
        <p>
          <strong>Nota:</strong> Los costes son estimaciones basadas en los precios de Claude Sonnet 3.5
          ($3/MTok entrada, $15/MTok salida). Los costes reales pueden variar según el modelo utilizado.
        </p>
      </div>
    </div>
  )
}
