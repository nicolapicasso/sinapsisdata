import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ExternalLink, Users } from 'lucide-react'

export default async function AdminProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      members: {
        include: {
          user: {
            select: { name: true },
          },
        },
      },
      _count: {
        select: {
          reports: true,
        },
      },
    },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark">Todos los Proyectos</h1>
          <p className="text-gray-500 mt-1">Gestiona todos los proyectos de la plataforma</p>
        </div>
        <Link
          href="/projects/new"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition"
        >
          Nuevo Proyecto
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Proyecto</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Miembros</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Informes</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Creado</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-dark">{project.name}</p>
                    <p className="text-sm text-gray-500">{project.slug}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
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
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{project.members.length}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{project._count.reports}</td>
                <td className="px-6 py-4 text-gray-500 text-sm">{formatDate(project.createdAt)}</td>
                <td className="px-6 py-4">
                  <div className="flex justify-end">
                    <Link
                      href={`/projects/${project.slug}`}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Ver <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {projects.length === 0 && (
          <div className="text-center py-12 text-gray-500">No hay proyectos</div>
        )}
      </div>
    </div>
  )
}
