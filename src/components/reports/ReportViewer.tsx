'use client'

import { useEffect, useRef } from 'react'
import { Download, Printer } from 'lucide-react'

interface ReportViewerProps {
  htmlContent: string
  title: string
}

export function ReportViewer({ htmlContent, title }: ReportViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument
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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-end gap-2 p-4 bg-white border-b border-gray-200">
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
      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0 bg-white"
        title={title}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
