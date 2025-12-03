'use client'

import { useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Coins, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { FileUploader } from '@/components/reports/FileUploader'

// Precios de Claude Sonnet 3.5 (por millón de tokens)
const PRICE_INPUT_PER_MILLION = 3 // $3 por millón de tokens de entrada
const PRICE_OUTPUT_PER_MILLION = 15 // $15 por millón de tokens de salida

// Estimación: ~3.5 caracteres por token para texto en español
// Para CSV, estimamos ~4 caracteres por token (más estructurado)
const CHARS_PER_TOKEN_TEXT = 3.5
const CHARS_PER_TOKEN_CSV = 4

// Estimación de tokens de salida basada en input (ratio típico)
const OUTPUT_TO_INPUT_RATIO = 0.5 // El output suele ser ~50% del input para análisis

function estimateTokens(text: string, charsPerToken: number): number {
  return Math.ceil(text.length / charsPerToken)
}

function estimateCost(inputTokens: number, outputTokens: number): number {
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

export default function NewReportPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileSizes, setFileSizes] = useState<number[]>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prompt: '',
    periodFrom: '',
    periodTo: '',
  })

  // Calcular estimación de tokens en tiempo real
  const tokenEstimate = useMemo(() => {
    // Tokens del prompt del usuario
    const promptTokens = estimateTokens(formData.prompt, CHARS_PER_TOKEN_TEXT)

    // Tokens de la descripción y título (se incluyen en el contexto)
    const metaTokens = estimateTokens(
      formData.title + ' ' + formData.description,
      CHARS_PER_TOKEN_TEXT
    )

    // Estimación de tokens de los archivos CSV (basado en tamaño de archivo)
    // Asumimos que el archivo es texto plano, ~1 byte por carácter
    const totalFileSize = fileSizes.reduce((acc, size) => acc + size, 0)
    const fileTokens = Math.ceil(totalFileSize / CHARS_PER_TOKEN_CSV)

    // System prompt base estimado (~500 tokens)
    const systemPromptTokens = 500

    // Total tokens de entrada
    const totalInputTokens = promptTokens + metaTokens + fileTokens + systemPromptTokens

    // Estimación de tokens de salida (informe generado)
    const estimatedOutputTokens = Math.ceil(totalInputTokens * OUTPUT_TO_INPUT_RATIO)

    // Coste estimado
    const cost = estimateCost(totalInputTokens, estimatedOutputTokens)

    return {
      inputTokens: totalInputTokens,
      outputTokens: estimatedOutputTokens,
      totalTokens: totalInputTokens + estimatedOutputTokens,
      cost,
      fileTokens,
      promptTokens,
    }
  }, [formData.prompt, formData.title, formData.description, fileSizes])

  // Actualizar tamaños de archivos cuando cambien
  const handleFilesChange = (newFiles: File[]) => {
    setFiles(newFiles)
    setFileSizes(newFiles.map(f => f.size))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (files.length === 0) {
      setError('Debes subir al menos un archivo CSV')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. Crear el informe
      const reportRes = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: slug,
          ...formData,
        }),
      })

      if (!reportRes.ok) {
        const data = await reportRes.json()
        throw new Error(data.error || 'Error al crear el informe')
      }

      const report = await reportRes.json()

      // 2. Subir los archivos
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

      // 3. Iniciar generacion en background (NO esperamos)
      fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id }),
      }).catch(err => {
        console.error('Error iniciando generacion:', err)
      })

      // 4. Redirigir inmediatamente al informe
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
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
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
              placeholder="Ej: Informe Mensual Enero 2024"
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
                Periodo desde
              </label>
              <input
                type="date"
                value={formData.periodFrom}
                onChange={(e) => setFormData({ ...formData, periodFrom: e.target.value })}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Periodo hasta
              </label>
              <input
                type="date"
                value={formData.periodTo}
                onChange={(e) => setFormData({ ...formData, periodTo: e.target.value })}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instrucciones para la IA *
            </label>
            <textarea
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              rows={4}
              required
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none disabled:bg-gray-100"
              placeholder="Describe que tipo de analisis quieres que la IA realice. Por ejemplo: 'Analiza los datos de ventas del mes, identifica tendencias y compara con el mes anterior. Destaca los productos mas vendidos y las areas de mejora.'"
            />
            <p className="text-xs text-gray-500 mt-1">
              Se mas especifico para obtener mejores resultados
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivos de datos (CSV) *
            </label>
            <FileUploader
              files={files}
              onFilesChange={handleFilesChange}
              disabled={loading}
            />
          </div>

          {/* Estimación de consumo */}
          {(formData.prompt.length > 0 || files.length > 0) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">
                    Estimación de consumo
                  </h4>
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
                      <span>Este informe puede tener un coste elevado debido al tamaño de los datos</span>
                    </div>
                  )}
                  <p className="text-blue-500 text-xs mt-2">
                    * Estimación aproximada basada en Claude Sonnet 3.5. El coste real puede variar.
                  </p>
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
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
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
