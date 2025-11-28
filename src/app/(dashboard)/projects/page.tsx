import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Plus, FolderKanban } from 'lucide-react'

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions)

  const isClient = session?.user.role === 'CLIENT'

  const projects = await prisma.project.findMany({
    where: session?.user.role === 'ADMIN'
      ? {}
      : {
          members: {
            some: {
              userId: session?.user.id,
            },
          },
        },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      logo: true,
      coverImage: true,
      members: {
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      },
      _count: {
        select: {
          reports: true,
          questions: { where: { status: 'PENDING' } },
          proposals: { where: { status: 'PENDING' } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const canCreate = session?.user.role === 'ADMIN' || session?.user.role === 'CONSULTANT'

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark">Proyectos</h1>
          <p className="text-gray-500 mt-1">
            {projects.length} proyecto{projects.length !== 1 ? 's' : ''} disponible{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/projects/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition"
          >
            <Plus className="w-5 h-5" />
            Nuevo Proyecto
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center">
          <FolderKanban className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No tienes proyectos asignados</p>
          {canCreate && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition"
            >
              <Plus className="w-5 h-5" />
              Crear tu primer proyecto
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="bg-white rounded-lg overflow-hidden hover:shadow-lg transition border border-gray-100 group"
            >
              {/* Cover with centered logo */}
              <div className="relative">
                {project.coverImage ? (
                  <div className="h-28 bg-gray-200">
                    <img
                      src={project.coverImage}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-28 bg-gradient-to-br from-primary to-primary-700" />
                )}
                {/* Centered logo */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {project.logo ? (
                    <div className="w-14 h-14 bg-white rounded-xl shadow-lg overflow-hidden p-1">
                      <img
                        src={project.logo}
                        alt={project.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 bg-white rounded-xl shadow-lg flex items-center justify-center text-xl font-bold text-primary">
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-dark group-hover:text-primary transition">
                    {project.name}
                  </h3>
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

                <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                  {project.description || 'Sin descripcion'}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {project.members.slice(0, 4).map((member) => (
                      <div
                        key={member.id}
                        className="w-8 h-8 bg-primary rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                        title={member.user.name}
                      >
                        {member.user.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {project.members.length > 4 && (
                      <div className="w-8 h-8 bg-gray-200 rounded-full border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium">
                        +{project.members.length - 4}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 text-sm">
                    <span className="text-gray-500">{project._count.reports} informes</span>
                    {!isClient && project._count.questions > 0 && (
                      <span className="text-accent font-medium">{project._count.questions} pendientes</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
