import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProjectHeader } from '@/components/projects/ProjectHeader'
import { ProjectTabs } from '@/components/projects/ProjectTabs'

interface ProjectPageProps {
  params: { slug: string }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const project = await prisma.project.findUnique({
    where: { slug: params.slug },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      },
      reports: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          isPublished: true,
          isPublic: true,
          slug: true,
          createdAt: true,
          createdBy: {
            select: { id: true, name: true },
          },
        },
      },
      questions: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      },
      proposals: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          reports: true,
          questions: { where: { status: 'PENDING' } },
          proposals: { where: { status: 'PENDING' } },
        },
      },
    },
  })

  if (!project) {
    notFound()
  }

  // Verificar acceso
  if (session.user.role !== 'ADMIN') {
    const isMember = project.members.some((m) => m.userId === session.user.id)
    if (!isMember) {
      redirect('/projects')
    }
  }

  // Obtener propuestas aprobadas para mostrar a clientes
  const approvedProposals = await prisma.aIProposal.findMany({
    where: {
      projectId: project.id,
      status: 'APPROVED',
    },
    orderBy: { createdAt: 'desc' },
  })

  // Determinar rol del usuario en el proyecto
  const memberRole = project.members.find((m) => m.userId === session.user.id)?.role

  // El rol efectivo: si es ADMIN del sistema, tiene acceso completo
  // Si no, usar el rol del miembro en el proyecto
  const effectiveRole: 'ADMIN' | 'CONSULTANT' | 'CLIENT' =
    session.user.role === 'ADMIN'
      ? 'ADMIN'
      : memberRole === 'OWNER' || memberRole === 'CONSULTANT'
        ? 'CONSULTANT'
        : 'CLIENT'

  const canEdit = effectiveRole !== 'CLIENT'
  const isClient = effectiveRole === 'CLIENT'

  // Filtrar informes para clientes: solo publicados y listos
  const visibleReports = isClient
    ? project.reports.filter((r) => r.isPublished && r.status === 'READY')
    : project.reports

  // Cast socialLinks to proper type for ProjectHeader
  const projectForHeader = {
    ...project,
    socialLinks: project.socialLinks as {
      instagram?: string
      youtube?: string
      facebook?: string
      linkedin?: string
      twitter?: string
    } | null,
  }

  return (
    <div>
      <ProjectHeader project={projectForHeader} canEdit={canEdit} />
      <ProjectTabs
        project={project}
        reports={visibleReports}
        questions={project.questions}
        proposals={project.proposals}
        approvedProposals={approvedProposals}
        canEdit={canEdit}
        userRole={effectiveRole}
      />
    </div>
  )
}
