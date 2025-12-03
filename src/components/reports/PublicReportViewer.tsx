'use client'

import { useCallback, useRef } from 'react'
import { Printer, Download } from 'lucide-react'

interface PublicReportViewerProps {
  htmlContent: string
  title: string
  projectName: string
}

export function PublicReportViewer({ htmlContent, title, projectName }: PublicReportViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const iframeRefCallback = useCallback((iframe: HTMLIFrameElement | null) => {
    if (iframe) {
      iframeRef.current = iframe
      const doc = iframe.contentDocument
      if (doc) {
        doc.open()
        doc.write(htmlContent)
        doc.close()
      }
    }
  }, [htmlContent])

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print()
    }
  }

  const handleDownload = () => {
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header minimalista */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">{projectName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Descargar</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-[#215A6B] text-white rounded-lg hover:bg-[#1a4a58] transition text-sm"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </header>

      {/* Contenido del informe */}
      <main className="flex-1">
        <iframe
          ref={iframeRefCallback}
          className="w-full h-full min-h-[calc(100vh-64px)] bg-white"
          title={title}
          sandbox="allow-scripts allow-same-origin allow-modals"
        />
      </main>

      {/* Footer con branding */}
      <footer className="bg-white border-t border-gray-200 px-4 py-2 text-center text-xs text-gray-400">
        Generado con Sinapsis Data
      </footer>
    </div>
  )
}
