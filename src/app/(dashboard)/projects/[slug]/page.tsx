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
        include: {
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

  const userRole = project.members.find((m) => m.userId === session.user.id)?.role
  const canEdit = session.user.role === 'ADMIN' || userRole === 'OWNER' || userRole === 'CONSULTANT'

  return (
    <div>
      <ProjectHeader project={project} canEdit={canEdit} />
      <ProjectTabs
        project={project}
        reports={project.reports}
        questions={project.questions}
        proposals={project.proposals}
        canEdit={canEdit}
      />
    </div>
  )
}
