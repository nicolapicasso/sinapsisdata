'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Download, Printer, Wand2, Save, X, Edit2, Loader2, ChevronUp, ChevronDown } from 'lucide-react'

interface ReportViewerProps {
  htmlContent: string
  title: string
  reportId: string
  canEdit: boolean
  // Usamos executiveSummary para el título y strengths para el contenido
  executiveSummary?: string | null  // Título de las notas
  strengths?: string | null         // Contenido de las notas
  opportunities?: string | null     // No usado (reservado)
  onRefresh?: () => void
  // Control externo del estado colapsado
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function ReportViewer({
  htmlContent,
  title,
  reportId,
  canEdit,
  executiveSummary,
  strengths,
  onRefresh,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
}: ReportViewerProps) {
  // Ref para el iframe actual (para imprimir)
  const currentIframeRef = useRef<HTMLIFrameElement | null>(null)

  // Estados para pedir cambios
  const [showRefineModal, setShowRefineModal] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refining, setRefining] = useState(false)

  // Estados para notas del equipo
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesTitle, setNotesTitle] = useState(executiveSummary || 'Notas del Equipo')
  const [notesContent, setNotesContent] = useState(strengths || '')
  const [saving, setSaving] = useState(false)

  // Estado para colapsar la barra de herramientas (usa externo si está disponible)
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  const isCollapsed = externalIsCollapsed ?? internalIsCollapsed
  const toggleCollapse = onToggleCollapse ?? (() => setInternalIsCollapsed(!internalIsCollapsed))

  // Actualizar estados cuando cambien las props
  useEffect(() => {
    setNotesTitle(executiveSummary || 'Notas del Equipo')
    setNotesContent(strengths || '')
  }, [executiveSummary, strengths])

  // Generar el HTML combinado con las notas inyectadas
  const finalHtml = useMemo(() => {
    // Si no hay contenido de notas, devolver el HTML original
    if (!strengths) {
      return htmlContent
    }

    const notesTitleText = executiveSummary || 'Notas del Equipo'

    // Crear el bloque de notas personalizadas
    const customNotesHtml = `
      <div style="margin-top: 40px; padding: 30px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border-left: 4px solid #215A6B; page-break-inside: avoid;">
        <h2 style="color: #215A6B; margin: 0 0 20px 0; font-size: 1.5rem; font-weight: 600;">${notesTitleText}</h2>
        <div style="color: #4a5568; line-height: 1.8; white-space: pre-wrap;">${strengths}</div>
      </div>
    `

    // Inyectar las notas antes del cierre de </body>
    if (htmlContent.includes('</body>')) {
      return htmlContent.replace('</body>', `${customNotesHtml}</body>`)
    }

    // Si no tiene </body>, agregar al final
    return htmlContent + customNotesHtml
  }, [htmlContent, executiveSummary, strengths])

  // Callback ref que escribe el contenido cuando el iframe se monta
  const iframeRefCallback = useCallback((iframe: HTMLIFrameElement | null) => {
    if (iframe) {
      currentIframeRef.current = iframe
      const doc = iframe.contentDocument
      if (doc) {
        doc.open()
        doc.write(finalHtml)
        doc.close()
      }
    }
  }, [finalHtml])

  const handlePrint = () => {
    if (currentIframeRef.current?.contentWindow) {
      currentIframeRef.current.contentWindow.print()
    }
  }

  const handleDownload = () => {
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

  const handleSaveNotes = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executiveSummary: notesTitle,
          strengths: notesContent,
        }),
      })

      if (!res.ok) {
        throw new Error('Error al guardar')
      }

      setEditingNotes(false)
      onRefresh?.()
    } catch {
      alert('Error al guardar las notas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Barra colapsable */}
      {isCollapsed ? (
        /* Barra minimizada */
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200 shrink-0">
          <button
            onClick={toggleCollapse}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition"
          >
            <ChevronDown className="w-4 h-4" />
            Mostrar herramientas
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:bg-gray-200 rounded transition text-sm"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2 py-1 bg-primary text-white rounded hover:bg-primary-600 transition text-sm"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Barra expandida */
        <>
          <div className="flex items-center justify-between gap-2 p-4 bg-white border-b border-gray-200 shrink-0">
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
                onClick={toggleCollapse}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm"
              >
                <ChevronUp className="w-4 h-4" />
                Ocultar
              </button>
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

      {/* Panel de notas del equipo (solo para editores) */}
      {canEdit && (
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Notas del equipo <span className="font-normal text-gray-500">(se incluiran al final del informe)</span>
            </h3>
            {!editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                {strengths ? 'Editar notas' : 'Añadir notas'}
              </button>
            )}
          </div>

          {editingNotes ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Titulo de la seccion
                </label>
                <input
                  type="text"
                  value={notesTitle}
                  onChange={(e) => setNotesTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Notas del Equipo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Contenido
                </label>
                <textarea
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Escribe aqui las notas, conclusiones o recomendaciones del equipo..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  Puedes usar saltos de linea para separar parrafos o crear listas.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingNotes(false)
                    setNotesTitle(executiveSummary || 'Notas del Equipo')
                    setNotesContent(strengths || '')
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-600 disabled:opacity-50 flex items-center gap-1"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  <Save className="w-3 h-3" />
                  Guardar notas
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              {strengths ? (
                <div>
                  <p className="text-xs font-medium text-primary mb-1">{executiveSummary || 'Notas del Equipo'}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">{strengths}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Sin notas. Haz clic en &quot;Añadir notas&quot; para agregar contenido.</p>
              )}
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* Iframe del informe */}
      <iframe
        key="normal-iframe"
        ref={iframeRefCallback}
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
