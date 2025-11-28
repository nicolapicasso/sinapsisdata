import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const isClient = session?.user.role === 'CLIENT'

  // Obtener proyectos según el rol del usuario
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
      _count: {
        select: {
          reports: true,
          questions: { where: { status: 'PENDING' } },
          proposals: { where: { status: 'PENDING' } },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dark">Dashboard</h1>
          <p className="text-gray-500 mt-1">Bienvenido de vuelta, {session?.user.name}</p>
        </div>
        {(session?.user.role === 'ADMIN' || session?.user.role === 'CONSULTANT') && (
          <Link
            href="/projects/new"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition"
          >
            Nuevo Proyecto
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center">
          <p className="text-gray-500">No tienes proyectos asignados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="bg-white rounded-lg hover:shadow-md transition border border-gray-100 overflow-hidden"
            >
              {/* Header with logo */}
              <div className="h-16 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                {project.logo ? (
                  <img
                    src={project.logo}
                    alt={project.name}
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-lg font-bold text-primary">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-dark">{project.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {project.description || 'Sin descripción'}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full shrink-0 ${
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
                <div className="flex gap-4 mt-4 text-sm">
                  <span className="text-gray-500">
                    <span className="font-medium text-dark">{project._count.reports}</span> informes
                  </span>
                  {!isClient && project._count.questions > 0 && (
                    <span className="text-accent">
                      {project._count.questions} preguntas pendientes
                    </span>
                  )}
                  {!isClient && project._count.proposals > 0 && (
                    <span className="text-primary">
                      {project._count.proposals} propuestas
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
