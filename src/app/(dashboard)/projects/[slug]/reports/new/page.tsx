'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Coins,
  AlertCircle,
  FileCode,
  Upload,
  BarChart3,
  CheckCircle2,
  Database,
} from 'lucide-react'
import Link from 'next/link'
import { FileUploader } from '@/components/reports/FileUploader'
import { cn } from '@/lib/utils'

// Precios de Claude Sonnet 3.5 (por millon de tokens)
const PRICE_INPUT_PER_MILLION = 3
const PRICE_OUTPUT_PER_MILLION = 15
const CHARS_PER_TOKEN_TEXT = 3.5
const CHARS_PER_TOKEN_CSV = 4
const OUTPUT_TO_INPUT_RATIO = 0.5

function estimateTokens(text: string, charsPerToken: number): number {
  return Math.ceil(text.length / charsPerToken)
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRICE_INPUT_PER_MILLION
  const outputCost = (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_MILLION
  return inputCost + outputCost
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toString()
}

function hasHtmlFile(files: File[]): boolean {
  return files.some((f) => f.name.endsWith('.html') || f.name.endsWith('.htm'))
}

interface DataSource {
  id: string
  type: 'GOOGLE_ANALYTICS' | 'GOOGLE_ADS' | 'GOOGLE_SEARCH_CONSOLE'
  accountId: string
  accountName: string
  status: string
  isActive: boolean
}

export default function NewReportPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(false)
  const [loadingDataSources, setLoadingDataSources] = useState(true)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileSizes, setFileSizes] = useState<number[]>([])
  const [useHtmlDirectly, setUseHtmlDirectly] = useState(false)

  // Data sources del proyecto
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prompt: '',
    periodFrom: '',
    periodTo: '',
  })

  // Cargar data sources del proyecto
  useEffect(() => {
    const fetchDataSources = async () => {
      try {
        const res = await fetch(`/api/projects/${slug}/datasources`)
        if (res.ok) {
          const data = await res.json()
          setDataSources(data.filter((ds: DataSource) => ds.status === 'CONNECTED' && ds.isActive))
        }
      } catch (err) {
        console.error('Error loading data sources:', err)
      } finally {
        setLoadingDataSources(false)
      }
    }
    fetchDataSources()
  }, [slug])

  const htmlUploaded = useMemo(() => hasHtmlFile(files), [files])

  const analyticsConnected = dataSources.filter((ds) => ds.type === 'GOOGLE_ANALYTICS')
  const adsConnected = dataSources.filter((ds) => ds.type === 'GOOGLE_ADS')
  const searchConsoleConnected = dataSources.filter((ds) => ds.type === 'GOOGLE_SEARCH_CONSOLE')

  const hasAnyDataSource = selectedDataSources.length > 0 || files.length > 0

  // Calcular estimacion de tokens
  const tokenEstimate = useMemo(() => {
    if (htmlUploaded && useHtmlDirectly) {
      return { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 }
    }

    const promptTokens = estimateTokens(formData.prompt, CHARS_PER_TOKEN_TEXT)
    const metaTokens = estimateTokens(formData.title + ' ' + formData.description, CHARS_PER_TOKEN_TEXT)
    const totalFileSize = fileSizes.reduce((acc, size) => acc + size, 0)
    const fileTokens = Math.ceil(totalFileSize / CHARS_PER_TOKEN_CSV)

    // Estimar tokens de Analytics/Ads (~5000 tokens por conexion)
    const dataSourceTokens = selectedDataSources.length * 5000

    const systemPromptTokens = 500
    const totalInputTokens = promptTokens + metaTokens + fileTokens + dataSourceTokens + systemPromptTokens
    const estimatedOutputTokens = Math.ceil(totalInputTokens * OUTPUT_TO_INPUT_RATIO)
    const cost = estimateCost(totalInputTokens, estimatedOutputTokens)

    return {
      inputTokens: totalInputTokens,
      outputTokens: estimatedOutputTokens,
      totalTokens: totalInputTokens + estimatedOutputTokens,
      cost,
    }
  }, [formData.prompt, formData.title, formData.description, fileSizes, htmlUploaded, useHtmlDirectly, selectedDataSources])

  const handleFilesChange = (newFiles: File[]) => {
    setFiles(newFiles)
    setFileSizes(newFiles.map((f) => f.size))
    if (!hasHtmlFile(newFiles)) setUseHtmlDirectly(false)
  }

  const toggleDataSource = (id: string) => {
    setSelectedDataSources((prev) =>
      prev.includes(id) ? prev.filter((dsId) => dsId !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasAnyDataSource) {
      setError('Debes seleccionar al menos una fuente de datos (conexion o archivo)')
      return
    }

    // Si usamos Analytics/Ads, el periodo es requerido
    if (selectedDataSources.length > 0 && (!formData.periodFrom || !formData.periodTo)) {
      setError('El periodo es requerido cuando usas datos de Analytics o Ads')
      return
    }

    if (!htmlUploaded || !useHtmlDirectly) {
      if (!formData.prompt.trim()) {
        setError('Las instrucciones para la IA son requeridas')
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      const htmlFile = files.find((f) => f.name.endsWith('.html') || f.name.endsWith('.htm'))
      let htmlContent: string | undefined
      if (htmlUploaded && useHtmlDirectly && htmlFile) {
        htmlContent = await htmlFile.text()
      }

      // 1. Crear el informe
      const reportRes = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: slug,
          ...formData,
          useHtmlDirectly: htmlUploaded && useHtmlDirectly,
          htmlContent,
          dataSourceIds: selectedDataSources,
        }),
      })

      if (!reportRes.ok) {
        const data = await reportRes.json()
        throw new Error(data.error || 'Error al crear el informe')
      }

      const report = await reportRes.json()

      // 2. Subir archivos CSV si los hay
      for (const file of files) {
        const formDataUpload = new FormData()
        formDataUpload.append('file', file)
        formDataUpload.append('reportId', report.id)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload,
        })

        if (!uploadRes.ok) {
          throw new Error('Error al subir archivo')
        }
      }

      // 3. Si NO usamos HTML directamente, iniciar generacion
      if (!htmlUploaded || !useHtmlDirectly) {
        fetch('/api/reports/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId: report.id,
            dataSourceIds: selectedDataSources,
          }),
        }).catch((err) => {
          console.error('Error iniciando generacion:', err)
        })
      }

      router.push(`/projects/${slug}/reports/${report.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el informe')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/projects/${slug}`}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-primary mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al proyecto
      </Link>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-dark mb-6">Nuevo Informe</h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titulo del informe *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-100"
              placeholder="Ej: Informe Mensual Febrero 2024"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none disabled:bg-gray-100"
              placeholder="Breve descripcion del informe..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Periodo desde {selectedDataSources.length > 0 && '*'}
              </label>
              <input
                type="date"
                value={formData.periodFrom}
                onChange={(e) => setFormData({ ...formData, periodFrom: e.target.value })}
                disabled={loading}
                required={selectedDataSources.length > 0}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Periodo hasta {selectedDataSources.length > 0 && '*'}
              </label>
              <input
                type="date"
                value={formData.periodTo}
                onChange={(e) => setFormData({ ...formData, periodTo: e.target.value })}
                disabled={loading}
                required={selectedDataSources.length > 0}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Fuentes de datos conectadas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Database className="w-4 h-4 inline mr-1" />
              Fuentes de datos conectadas
            </label>

            {loadingDataSources ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando conexiones...
              </div>
            ) : dataSources.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
                No hay conexiones configuradas.{' '}
                <Link href={`/projects/${slug}/settings`} className="text-primary hover:underline">
                  Conectar Analytics o Ads
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {analyticsConnected.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Google Analytics</p>
                    {analyticsConnected.map((ds) => (
                      <label
                        key={ds.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition',
                          selectedDataSources.includes(ds.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDataSources.includes(ds.id)}
                          onChange={() => toggleDataSource(ds.id)}
                          disabled={loading}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center transition',
                            selectedDataSources.includes(ds.id)
                              ? 'border-primary bg-primary'
                              : 'border-gray-300'
                          )}
                        >
                          {selectedDataSources.includes(ds.id) && (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <BarChart3 className="w-5 h-5 text-orange-500" />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-dark">{ds.accountName}</p>
                          <p className="text-xs text-gray-500">Property ID: {ds.accountId}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {adsConnected.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Google Ads</p>
                    {adsConnected.map((ds) => (
                      <label
                        key={ds.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition',
                          selectedDataSources.includes(ds.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDataSources.includes(ds.id)}
                          onChange={() => toggleDataSource(ds.id)}
                          disabled={loading}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center transition',
                            selectedDataSources.includes(ds.id)
                              ? 'border-primary bg-primary'
                              : 'border-gray-300'
                          )}
                        >
                          {selectedDataSources.includes(ds.id) && (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-dark">{ds.accountName}</p>
                          <p className="text-xs text-gray-500">Customer ID: {ds.accountId}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {searchConsoleConnected.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Google Search Console</p>
                    {searchConsoleConnected.map((ds) => (
                      <label
                        key={ds.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition',
                          selectedDataSources.includes(ds.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDataSources.includes(ds.id)}
                          onChange={() => toggleDataSource(ds.id)}
                          disabled={loading}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center transition',
                            selectedDataSources.includes(ds.id)
                              ? 'border-primary bg-primary'
                              : 'border-gray-300'
                          )}
                        >
                          {selectedDataSources.includes(ds.id) && (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <BarChart3 className="w-5 h-5 text-green-500" />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-dark">{ds.accountName}</p>
                          <p className="text-xs text-gray-500">{ds.accountId}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Archivos adicionales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivos adicionales (CSV/HTML)
              {selectedDataSources.length === 0 && ' *'}
            </label>
            <FileUploader
              files={files}
              onFilesChange={handleFilesChange}
              disabled={loading}
              acceptedTypes="both"
            />
            <p className="text-xs text-gray-500 mt-1">
              Puedes combinar datos de Analytics/Ads/Search Console con CSVs adicionales
            </p>
          </div>

          {/* Toggle para modo HTML */}
          {htmlUploaded && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                  <FileCode className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-orange-900 mb-3">
                    Has subido un archivo HTML
                  </h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition',
                          !useHtmlDirectly ? 'border-primary bg-primary' : 'border-gray-300'
                        )}
                      >
                        {!useHtmlDirectly && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <input
                        type="radio"
                        name="htmlMode"
                        checked={!useHtmlDirectly}
                        onChange={() => setUseHtmlDirectly(false)}
                        className="sr-only"
                      />
                      <span className="text-sm text-gray-700">
                        <strong>Usar HTML como fuente de datos</strong> — La IA analizara el
                        contenido
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition',
                          useHtmlDirectly ? 'border-primary bg-primary' : 'border-gray-300'
                        )}
                      >
                        {useHtmlDirectly && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <input
                        type="radio"
                        name="htmlMode"
                        checked={useHtmlDirectly}
                        onChange={() => setUseHtmlDirectly(true)}
                        className="sr-only"
                      />
                      <span className="text-sm text-gray-700">
                        <strong>Usar HTML sin modificaciones</strong> — Se subira tal cual
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instrucciones para la IA {!(htmlUploaded && useHtmlDirectly) && '*'}
            </label>
            <textarea
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              rows={4}
              required={!(htmlUploaded && useHtmlDirectly)}
              disabled={loading || (htmlUploaded && useHtmlDirectly)}
              className={cn(
                'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none disabled:bg-gray-100',
                htmlUploaded && useHtmlDirectly && 'opacity-50'
              )}
              placeholder={
                htmlUploaded && useHtmlDirectly
                  ? 'No se requieren instrucciones cuando se sube el HTML sin modificaciones'
                  : "Describe que tipo de analisis quieres. Ej: 'Analiza el rendimiento del sitio web y las campanas de Google Ads. Identifica las fuentes de trafico mas efectivas y oportunidades de mejora.'"
              }
            />
          </div>

          {/* Estimacion de consumo */}
          {(formData.prompt.length > 0 || hasAnyDataSource) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Estimacion de consumo</h4>
                  {htmlUploaded && useHtmlDirectly ? (
                    <div className="flex items-center gap-2 text-green-700 text-sm">
                      <Upload className="w-4 h-4" />
                      <span>
                        <strong>Sin consumo de IA</strong> — El HTML se subira directamente
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-blue-600 text-xs">Tokens entrada</p>
                          <p className="font-semibold text-blue-900">
                            ~{formatNumber(tokenEstimate.inputTokens)}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-600 text-xs">Tokens salida</p>
                          <p className="font-semibold text-blue-900">
                            ~{formatNumber(tokenEstimate.outputTokens)}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-600 text-xs">Total tokens</p>
                          <p className="font-semibold text-blue-900">
                            ~{formatNumber(tokenEstimate.totalTokens)}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-600 text-xs">Coste estimado</p>
                          <p className="font-semibold text-green-600">
                            ~${tokenEstimate.cost.toFixed(4)}
                          </p>
                        </div>
                      </div>
                      {tokenEstimate.cost > 0.1 && (
                        <div className="mt-3 flex items-center gap-2 text-amber-700 text-xs">
                          <AlertCircle className="w-3 h-3" />
                          <span>Este informe puede tener un coste elevado</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Link
              href={`/projects/${slug}`}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-center"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading || !hasAnyDataSource}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {htmlUploaded && useHtmlDirectly ? 'Subiendo...' : 'Creando...'}
                </>
              ) : htmlUploaded && useHtmlDirectly ? (
                'Subir Informe HTML'
              ) : (
                'Crear y Generar Informe'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
