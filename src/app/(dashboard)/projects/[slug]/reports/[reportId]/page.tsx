'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, Trash2, ChevronDown } from 'lucide-react'
import { ReportViewer } from '@/components/reports/ReportViewer'

interface Report {
  id: string
  title: string
  description: string | null
  status: 'DRAFT' | 'PROCESSING' | 'READY' | 'ERROR'
  htmlContent: string | null
  errorMessage: string | null
  executiveSummary: string | null
  strengths: string | null
  opportunities: string | null
}

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const slug = params.slug as string
  const reportId = params.reportId as string

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const canEdit = session?.user?.role === 'ADMIN' || session?.user?.role === 'CONSULTANT'
  const toggleCollapse = () => setIsCollapsed(!isCollapsed)

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/reports/${reportId}`)
      if (!res.ok) {
        throw new Error('Error al cargar el informe')
      }
      const data = await res.json()
      setReport(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async () => {
    setLoading(true)
    try {
      // Reiniciar generacion
      await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      // Refrescar estado
      await fetchReport()
    } catch (err) {
      console.error('Error retrying:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estas seguro de que quieres eliminar este informe? Esta accion no se puede deshacer.')) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Error al eliminar')
      }

      router.push(`/projects/${slug}`)
    } catch (err) {
      alert('Error al eliminar el informe')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [reportId])

  // Polling cuando esta procesando
  useEffect(() => {
    if (report?.status === 'PROCESSING' || report?.status === 'DRAFT') {
      const interval = setInterval(fetchReport, 3000) // Cada 3 segundos
      return () => clearInterval(interval)
    }
  }, [report?.status])

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !report) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-dark">{error}</p>
        </div>
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="h-full flex flex-col -m-6 min-h-0">
      {/* Header colapsable */}
      {!isCollapsed && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
          <Link
            href={`/projects/${slug}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-primary mb-3 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al proyecto
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-dark">{report.title}</h1>
              {report.description && (
                <p className="text-gray-500 text-sm mt-1">{report.description}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {report.status === 'READY' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Generado
                </span>
              )}
              {(report.status === 'PROCESSING' || report.status === 'DRAFT') && (
                <span className="text-sm text-blue-600 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando...
                </span>
              )}
              {report.status === 'ERROR' && (
                <span className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Error
                </span>
              )}
              {canEdit && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 bg-gray-100 min-h-0">
        {report.status === 'READY' && report.htmlContent ? (
          <ReportViewer
            htmlContent={report.htmlContent}
            title={report.title}
            reportId={report.id}
            canEdit={canEdit}
            executiveSummary={report.executiveSummary}
            strengths={report.strengths}
            opportunities={report.opportunities}
            onRefresh={fetchReport}
            isCollapsed={isCollapsed}
            onToggleCollapse={toggleCollapse}
          />
        ) : report.status === 'PROCESSING' || report.status === 'DRAFT' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-medium text-dark">Generando informe con IA...</p>
              <p className="text-gray-500 mt-1">Esto puede tardar entre 30 segundos y 1 minuto</p>
              <p className="text-gray-400 text-sm mt-4">La pagina se actualizara automaticamente</p>
            </div>
          </div>
        ) : report.status === 'ERROR' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-dark">Error al generar el informe</p>
              <p className="text-gray-500 mt-1">{report.errorMessage || 'Ha ocurrido un error inesperado'}</p>
              <button
                onClick={handleRetry}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
