'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { FileUploader } from '@/components/reports/FileUploader'

export default function NewReportPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prompt: '',
    periodFrom: '',
    periodTo: '',
  })

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

      // 3. Generar el informe con IA
      setGenerating(true)
      const generateRes = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id }),
      })

      if (!generateRes.ok) {
        // Si falla la generacion, aun asi redirigir al informe
        console.error('Error generating report')
      }

      router.push(`/projects/${slug}/reports/${report.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el informe')
      setLoading(false)
      setGenerating(false)
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

        {generating && (
          <div className="bg-blue-50 text-blue-700 p-4 rounded-lg mb-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <div>
              <p className="font-medium">Generando informe con IA...</p>
              <p className="text-sm">Esto puede tardar unos segundos</p>
            </div>
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
              onFilesChange={setFiles}
              disabled={loading}
            />
          </div>

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
                  {generating ? 'Generando...' : 'Creando...'}
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
