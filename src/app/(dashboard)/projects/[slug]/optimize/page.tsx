'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Play,
  Loader2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  MousePointer,
  Target,
  ThumbsUp,
  Zap,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataSource {
  id: string
  accountId: string
  accountName: string
  status: string
  isActive: boolean
}

interface Suggestion {
  type: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  description: string
  reason: string
  impact: string
  targetEntity: {
    campaignId?: string
    campaignName?: string
    adGroupId?: string
    adGroupName?: string
    keywordText?: string
    searchTerm?: string
    placement?: string
  }
  payload: Record<string, unknown>
  metrics: {
    cost?: number
    conversions?: number
    ctr?: number
  }
}

interface AnalysisResult {
  summary: string
  healthScore: number
  suggestions: Suggestion[]
  insights: string[]
  warnings: string[]
}

interface AnalysisData {
  accountId: string
  accountName: string
  dateRange: { startDate: string; endDate: string }
  summary: {
    totalCost: number
    totalImpressions: number
    totalClicks: number
    totalConversions: number
    totalConversionValue: number
    averageCtr: number
    averageCpc: number
    averageCostPerConversion: number
    roas: number
  }
}

export default function OptimizePage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [project, setProject] = useState<{ id: string; name: string } | null>(null)
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [selectedDataSource, setSelectedDataSource] = useState<string>('')
  const [dateRange, setDateRange] = useState({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  })

  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set())
  const [savingActions, setSavingActions] = useState(false)
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null)

  useEffect(() => {
    fetchProjectData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  function getDefaultStartDate(): string {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }

  function getDefaultEndDate(): string {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    return date.toISOString().split('T')[0]
  }

  async function fetchProjectData() {
    try {
      // Fetch project info
      const projectRes = await fetch(`/api/projects/${slug}`)
      if (!projectRes.ok) {
        router.push('/projects')
        return
      }
      const projectData = await projectRes.json()
      setProject({ id: projectData.project.id, name: projectData.project.name })

      // Fetch data sources
      const dsRes = await fetch(`/api/datasources?projectId=${projectData.project.id}`)
      if (dsRes.ok) {
        const dsData = await dsRes.json()
        const googleAds = dsData.dataSources.filter(
          (ds: DataSource) => ds.status === 'CONNECTED' && ds.isActive
        )
        setDataSources(googleAds)
        if (googleAds.length > 0) {
          setSelectedDataSource(googleAds[0].id)
        }
      }
    } catch (err) {
      console.error('Error fetching project:', err)
      setError('Error al cargar el proyecto')
    } finally {
      setLoading(false)
    }
  }

  async function runAnalysis() {
    if (!selectedDataSource) return

    setAnalyzing(true)
    setError(null)
    setAnalysis(null)
    setSelectedSuggestions(new Set())

    try {
      const res = await fetch('/api/optimization/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSourceId: selectedDataSource,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al analizar')
      }

      const data = await res.json()
      setAnalysis(data.analysis)
      setAnalysisData(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al analizar')
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveSelectedActions() {
    if (!project || selectedSuggestions.size === 0 || !analysis) return

    setSavingActions(true)
    try {
      const suggestions = Array.from(selectedSuggestions).map(
        (idx) => analysis.suggestions[idx]
      )

      const res = await fetch('/api/optimization/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          dataSourceId: selectedDataSource,
          suggestions,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }

      const data = await res.json()
      alert(`Se guardaron ${data.count} acciones. Ve a la pestaña de Propuestas IA para revisarlas.`)
      setSelectedSuggestions(new Set())
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar acciones')
    } finally {
      setSavingActions(false)
    }
  }

  function toggleSuggestion(idx: number) {
    const newSelected = new Set(selectedSuggestions)
    if (newSelected.has(idx)) {
      newSelected.delete(idx)
    } else {
      newSelected.add(idx)
    }
    setSelectedSuggestions(newSelected)
  }

  function selectAllSuggestions() {
    if (!analysis) return
    const all = new Set(analysis.suggestions.map((_, idx) => idx))
    setSelectedSuggestions(all)
  }

  function deselectAllSuggestions() {
    setSelectedSuggestions(new Set())
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'NEGATIVE_KEYWORD':
        return <XCircle className="w-4 h-4" />
      case 'EXCLUDE_PLACEMENT':
        return <XCircle className="w-4 h-4" />
      case 'PAUSE_KEYWORD':
      case 'PAUSE_CAMPAIGN':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Zap className="w-4 h-4" />
    }
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/projects/${slug}?tab=connections`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-dark mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al proyecto
        </Link>
        <h1 className="text-2xl font-bold text-dark">Herramienta de Optimización</h1>
        <p className="text-gray-600 mt-1">
          Analiza tu cuenta de Google Ads y obtén sugerencias de optimización con IA
        </p>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-dark mb-4">Configuración del análisis</h2>

        {dataSources.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
            <p className="text-gray-600 mb-4">No hay cuentas de Google Ads conectadas</p>
            <Link
              href={`/projects/${slug}?tab=connections`}
              className="text-primary hover:underline"
            >
              Conectar cuenta de Google Ads
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {/* Account selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cuenta de Google Ads
              </label>
              <select
                value={selectedDataSource}
                onChange={(e) => setSelectedDataSource(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {dataSources.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.accountName} ({ds.accountId})
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Desde
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hasta
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        )}

        {dataSources.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={runAnalysis}
              disabled={analyzing || !selectedDataSource}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-600 transition disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Ejecutar análisis
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Analysis Results */}
      {analysis && analysisData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Puntuación</p>
                  <p className={cn('text-2xl font-bold', getHealthScoreColor(analysis.healthScore))}>
                    {analysis.healthScore}/100
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Coste total</p>
                  <p className="text-2xl font-bold text-dark">
                    {analysisData.summary.totalCost.toFixed(2)}€
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Conversiones</p>
                  <p className="text-2xl font-bold text-dark">
                    {analysisData.summary.totalConversions.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <MousePointer className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">CTR promedio</p>
                  <p className="text-2xl font-bold text-dark">
                    {analysisData.summary.averageCtr.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-dark mb-3">Resumen del análisis</h3>
            <p className="text-gray-700">{analysis.summary}</p>

            {analysis.warnings.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium text-amber-800 mb-2">Alertas</h4>
                <ul className="space-y-1">
                  {analysis.warnings.map((w, idx) => (
                    <li key={idx} className="text-amber-700 text-sm flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.insights.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Insights</h4>
                <ul className="space-y-1">
                  {analysis.insights.map((i, idx) => (
                    <li key={idx} className="text-blue-700 text-sm flex items-start gap-2">
                      <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-dark">
                Acciones sugeridas ({analysis.suggestions.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllSuggestions}
                  className="text-sm text-primary hover:underline"
                >
                  Seleccionar todas
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAllSuggestions}
                  className="text-sm text-gray-500 hover:underline"
                >
                  Deseleccionar
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {analysis.suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'border rounded-lg transition cursor-pointer',
                    selectedSuggestions.has(idx)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div
                    className="p-4 flex items-start gap-4"
                    onClick={() => toggleSuggestion(idx)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSuggestions.has(idx)}
                      onChange={() => toggleSuggestion(idx)}
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded border',
                            getPriorityColor(suggestion.priority)
                          )}
                        >
                          {suggestion.priority}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          {getTypeIcon(suggestion.type)}
                          {suggestion.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h4 className="font-medium text-dark">{suggestion.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>

                      {suggestion.metrics && Object.keys(suggestion.metrics).length > 0 && (
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          {suggestion.metrics.cost !== undefined && (
                            <span>Coste: {suggestion.metrics.cost.toFixed(2)}€</span>
                          )}
                          {suggestion.metrics.conversions !== undefined && (
                            <span>Conv: {suggestion.metrics.conversions}</span>
                          )}
                          {suggestion.metrics.ctr !== undefined && (
                            <span>CTR: {suggestion.metrics.ctr.toFixed(2)}%</span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedSuggestion(expandedSuggestion === idx ? null : idx)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedSuggestion === idx ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {expandedSuggestion === idx && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                      <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-1">Razón</h5>
                          <p className="text-sm text-gray-600">{suggestion.reason}</p>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-1">
                            Impacto esperado
                          </h5>
                          <p className="text-sm text-gray-600">{suggestion.impact}</p>
                        </div>
                      </div>
                      {suggestion.targetEntity && (
                        <div className="mt-3">
                          <h5 className="text-sm font-medium text-gray-700 mb-1">Entidad</h5>
                          <div className="text-sm text-gray-600">
                            {suggestion.targetEntity.campaignName && (
                              <span>Campaña: {suggestion.targetEntity.campaignName}</span>
                            )}
                            {suggestion.targetEntity.adGroupName && (
                              <span> / Grupo: {suggestion.targetEntity.adGroupName}</span>
                            )}
                            {suggestion.targetEntity.searchTerm && (
                              <span> / Término: &quot;{suggestion.targetEntity.searchTerm}&quot;</span>
                            )}
                            {suggestion.targetEntity.keywordText && (
                              <span> / Keyword: &quot;{suggestion.targetEntity.keywordText}&quot;</span>
                            )}
                            {suggestion.targetEntity.placement && (
                              <span> / Placement: {suggestion.targetEntity.placement}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {selectedSuggestions.size > 0 && (
              <div className="mt-6 flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">
                  {selectedSuggestions.size} acción(es) seleccionada(s)
                </span>
                <button
                  onClick={saveSelectedActions}
                  disabled={savingActions}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {savingActions ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="w-4 h-4" />
                  )}
                  Guardar para revisión
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
