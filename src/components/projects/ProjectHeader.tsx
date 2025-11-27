'use client'

import Link from 'next/link'
import { ArrowLeft, Settings, Globe, ExternalLink } from 'lucide-react'

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
                <Link
                  href={`/projects/${project.slug}/settings`}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Configuracion</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
