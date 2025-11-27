'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Settings, Globe, ExternalLink, Trash2, Loader2, AlertTriangle, Calendar } from 'lucide-react'

interface SocialLinks {
  instagram?: string
  youtube?: string
  facebook?: string
  linkedin?: string
  twitter?: string
}

interface ProjectHeaderProps {
  project: {
    id: string
    name: string
    slug: string
    description: string | null
    status: string
    websiteUrl: string | null
    coverImage: string | null
    logo: string | null
    mondayBoardUrl: string | null
    socialLinks: SocialLinks | null
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
        {/* Cover Image with centered logo */}
        <div className="relative">
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

          {/* Logo positioned at bottom center of cover */}
          <div className="absolute -bottom-10 left-6">
            {project.logo ? (
              <div className="w-20 h-20 bg-white rounded-xl shadow-lg border-4 border-white overflow-hidden">
                <img
                  src={project.logo}
                  alt={project.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-20 h-20 bg-white rounded-xl shadow-lg flex items-center justify-center text-2xl font-bold text-primary border-4 border-white">
                {project.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Content area - with proper spacing for logo */}
        <div className="pt-14 px-6 pb-6">
          <div className="flex items-start justify-between">
            <div>
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
              {/* Social Links */}
              {project.socialLinks && Object.values(project.socialLinks).some(v => v) && (
                <div className="flex items-center gap-2 mt-2">
                  {project.socialLinks.instagram && (
                    <a
                      href={project.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-pink-500 transition"
                      title="Instagram"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </a>
                  )}
                  {project.socialLinks.youtube && (
                    <a
                      href={project.socialLinks.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-red-500 transition"
                      title="YouTube"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    </a>
                  )}
                  {project.socialLinks.facebook && (
                    <a
                      href={project.socialLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600 transition"
                      title="Facebook"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </a>
                  )}
                  {project.socialLinks.linkedin && (
                    <a
                      href={project.socialLinks.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-700 transition"
                      title="LinkedIn"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </a>
                  )}
                  {project.socialLinks.twitter && (
                    <a
                      href={project.socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-900 transition"
                      title="X (Twitter)"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </a>
                  )}
                </div>
              )}
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
              {project.mondayBoardUrl && (
                <a
                  href={project.mondayBoardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Monday</span>
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
