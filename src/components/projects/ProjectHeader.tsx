'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Settings, Globe, ExternalLink, Trash2, Loader2, AlertTriangle } from 'lucide-react'

interface ProjectHeaderProps {
  project: {
    id: string
    name: string
    slug: string
    description: string | null
    status: string
    websiteUrl: string | null
    coverImage: string | null
  }
  canEdit: boolean
}

export function ProjectHeader({ project, canEdit }: ProjectHeaderProps) {
  const router = useRouter()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (confirmText !== 'ELIMINAR') {
      setError('Debes escribir ELIMINAR para confirmar')
      return
    }

    setDeleting(true)
    setError('')

    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: confirmText }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar')
      }

      router.push('/projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el proyecto')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mb-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-primary mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a proyectos
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {project.coverImage ? (
          <div className="h-40 bg-gray-200">
            <img
              src={project.coverImage}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="h-40 bg-gradient-to-br from-primary to-primary-700" />
        )}

        <div className="p-6 -mt-12 relative">
          <div className="flex items-end justify-between">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 bg-white rounded-xl shadow-lg flex items-center justify-center text-2xl font-bold text-primary border-4 border-white">
                {project.name.charAt(0).toUpperCase()}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-dark">{project.name}</h1>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      project.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : project.status === 'PAUSED'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {project.status === 'ACTIVE' ? 'Activo' : project.status === 'PAUSED' ? 'Pausado' : 'Archivado'}
                  </span>
                </div>
                {project.description && (
                  <p className="text-gray-500 mt-1">{project.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {project.websiteUrl && (
                <a
                  href={project.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">Web</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {canEdit && (
                <>
                  <Link
                    href={`/projects/${project.slug}/settings`}
                    className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Configuracion</span>
                  </Link>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Eliminar</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmacion de eliminacion */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark">Eliminar proyecto</h2>
                <p className="text-sm text-gray-500">Esta accion no se puede deshacer</p>
              </div>
            </div>

            <div className="mb-4 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800">
                Se eliminaran permanentemente:
              </p>
              <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                <li>Todos los informes del proyecto</li>
                <li>Todas las preguntas y propuestas de IA</li>
                <li>Todos los archivos subidos</li>
                <li>El historial completo del proyecto</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              Para confirmar, escribe <strong>ELIMINAR</strong> en el campo de abajo:
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value.toUpperCase())
                setError('')
              }}
              placeholder="Escribe ELIMINAR"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />

            {error && (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setConfirmText('')
                  setError('')
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText !== 'ELIMINAR'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <Trash2 className="w-4 h-4" />
                Eliminar proyecto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
