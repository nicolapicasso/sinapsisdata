'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Download, Printer, Wand2, Save, X, Edit2, Loader2 } from 'lucide-react'

interface ReportViewerProps {
  htmlContent: string
  title: string
  reportId: string
  canEdit: boolean
  executiveSummary?: string | null
  strengths?: string | null
  opportunities?: string | null
  onRefresh?: () => void
}

export function ReportViewer({
  htmlContent,
  title,
  reportId,
  canEdit,
  executiveSummary,
  strengths,
  opportunities,
  onRefresh,
}: ReportViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Estados para pedir cambios
  const [showRefineModal, setShowRefineModal] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refining, setRefining] = useState(false)

  // Estados para edicion de secciones
  const [editingSection, setEditingSection] = useState<'summary' | 'strengths' | 'opportunities' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Generar el HTML combinado con las secciones editables inyectadas
  const finalHtml = useMemo(() => {
    // Si no hay ninguna seccion personalizada, devolver el HTML original
    if (!executiveSummary && !strengths && !opportunities) {
      return htmlContent
    }

    // Crear el bloque de secciones personalizadas
    const customSectionsHtml = `
      <div style="margin-top: 40px; padding: 30px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border-left: 4px solid #215A6B;">
        <h2 style="color: #215A6B; margin: 0 0 20px 0; font-size: 1.5rem; font-weight: 600;">Notas del Equipo</h2>

        ${executiveSummary ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #1A1A1A; margin: 0 0 10px 0; font-size: 1.1rem; font-weight: 600;">Resumen Ejecutivo</h3>
            <p style="color: #4a5568; margin: 0; line-height: 1.6; white-space: pre-wrap;">${executiveSummary}</p>
          </div>
        ` : ''}

        ${strengths ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #1A1A1A; margin: 0 0 10px 0; font-size: 1.1rem; font-weight: 600;">Fortalezas Identificadas</h3>
            <p style="color: #4a5568; margin: 0; line-height: 1.6; white-space: pre-wrap;">${strengths}</p>
          </div>
        ` : ''}

        ${opportunities ? `
          <div style="margin-bottom: 0;">
            <h3 style="color: #1A1A1A; margin: 0 0 10px 0; font-size: 1.1rem; font-weight: 600;">Oportunidades de Mejora</h3>
            <p style="color: #4a5568; margin: 0; line-height: 1.6; white-space: pre-wrap;">${opportunities}</p>
          </div>
        ` : ''}
      </div>
    `

    // Inyectar las secciones antes del cierre de </body>
    if (htmlContent.includes('</body>')) {
      return htmlContent.replace('</body>', `${customSectionsHtml}</body>`)
    }

    // Si no tiene </body>, agregar al final
    return htmlContent + customSectionsHtml
  }, [htmlContent, executiveSummary, strengths, opportunities])

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(finalHtml)
        doc.close()
      }
    }
  }, [finalHtml])

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print()
    }
  }

  const handleDownload = () => {
    // Descargar el HTML con las secciones personalizadas incluidas
    const blob = new Blob([finalHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleRefine = async () => {
    if (!refinePrompt.trim()) return

    setRefining(true)
    try {
      const res = await fetch(`/api/reports/${reportId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: refinePrompt }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al refinar')
      }

      setShowRefineModal(false)
      setRefinePrompt('')
      onRefresh?.()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al refinar el informe')
    } finally {
      setRefining(false)
    }
  }

  const handleStartEdit = (section: 'summary' | 'strengths' | 'opportunities') => {
    setEditingSection(section)
    if (section === 'summary') {
      setEditValue(executiveSummary || '')
    } else if (section === 'strengths') {
      setEditValue(strengths || '')
    } else {
      setEditValue(opportunities || '')
    }
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = {}
      if (editingSection === 'summary') {
        body.executiveSummary = editValue
      } else if (editingSection === 'strengths') {
        body.strengths = editValue
      } else if (editingSection === 'opportunities') {
        body.opportunities = editValue
      }

      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error('Error al guardar')
      }

      setEditingSection(null)
      onRefresh?.()
    } catch (error) {
      alert('Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const getSectionLabel = (section: 'summary' | 'strengths' | 'opportunities') => {
    switch (section) {
      case 'summary': return 'Resumen Ejecutivo'
      case 'strengths': return 'Fortalezas Identificadas'
      case 'opportunities': return 'Oportunidades de Mejora'
    }
  }

  const getSectionValue = (section: 'summary' | 'strengths' | 'opportunities') => {
    switch (section) {
      case 'summary': return executiveSummary
      case 'strengths': return strengths
      case 'opportunities': return opportunities
    }
  }

  const sections: ('summary' | 'strengths' | 'opportunities')[] = ['summary', 'strengths', 'opportunities']

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => setShowRefineModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition text-sm"
            >
              <Wand2 className="w-4 h-4" />
              Pedir cambios a la IA
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm"
          >
            <Download className="w-4 h-4" />
            Descargar HTML
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition text-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Secciones editables - Panel lateral colapsable */}
      {canEdit && (
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Notas del equipo <span className="font-normal text-gray-500">(se incluiran al final del informe)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sections.map((section) => (
              <div key={section} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-dark">{getSectionLabel(section)}</h4>
                  {editingSection !== section && (
                    <button
                      onClick={() => handleStartEdit(section)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      {getSectionValue(section) ? 'Editar' : 'Añadir'}
                    </button>
                  )}
                </div>
                {editingSection === section ? (
                  <div className="space-y-2">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full h-24 p-2 border border-gray-300 rounded text-xs resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder={`Escribe ${getSectionLabel(section).toLowerCase()}...`}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingSection(null)}
                        className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 line-clamp-3">
                    {getSectionValue(section) || <span className="italic">Sin contenido</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Iframe del informe */}
      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0 bg-white"
        title={title}
        sandbox="allow-scripts allow-same-origin"
      />

      {/* Modal de refinamiento */}
      {showRefineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-dark">Pedir cambios a la IA</h2>
              <button
                onClick={() => setShowRefineModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Describe los cambios que quieres hacer al informe. La IA modificara el HTML manteniendo la estructura y estilos.
            </p>

            <textarea
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              placeholder="Ej: Cambia el titulo a 'Informe Q4 2024', anade una seccion de recomendaciones al final, cambia el grafico de barras por uno de lineas..."
              className="w-full h-40 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRefineModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleRefine}
                disabled={refining || !refinePrompt.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {refining && <Loader2 className="w-4 h-4 animate-spin" />}
                <Wand2 className="w-4 h-4" />
                Aplicar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
