import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PublicReportViewer } from '@/components/reports/PublicReportViewer'

interface Props {
  params: { projectSlug: string; reportSlug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectSlug, reportSlug } = params

  const report = await prisma.report.findFirst({
    where: {
      slug: reportSlug,
      project: { slug: projectSlug },
      status: 'READY',
    },
    select: {
      title: true,
      description: true,
      project: { select: { name: true } },
    },
  })

  if (!report) {
    return { title: 'Informe no encontrado' }
  }

  return {
    title: `${report.title} | ${report.project.name}`,
    description: report.description || `Informe de ${report.project.name}`,
  }
}

export default async function PublicReportPage({ params }: Props) {
  const { projectSlug, reportSlug } = params

  // Buscar el informe
  const report = await prisma.report.findFirst({
    where: {
      slug: reportSlug,
      project: { slug: projectSlug },
      status: 'READY',
    },
    select: {
      id: true,
      title: true,
      htmlContent: true,
      isPublic: true,
      isPublished: true,
      executiveSummary: true,
      strengths: true,
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  // Si no existe el informe
  if (!report || !report.htmlContent) {
    notFound()
  }

  // Si no está publicado, no mostrar
  if (!report.isPublished) {
    notFound()
  }

  // Si no es público, verificar autenticación
  if (!report.isPublic) {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      // Redirigir a login con return URL
      const returnUrl = `/r/${projectSlug}/${reportSlug}`
      const loginUrl = `/login?callbackUrl=${encodeURIComponent(returnUrl)}`

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Acceso restringido</h1>
            <p className="text-gray-600 mb-6">
              Este informe requiere autenticación para ser visualizado.
            </p>
            <a
              href={loginUrl}
              className="inline-block px-6 py-3 bg-[#215A6B] text-white rounded-lg hover:bg-[#1a4a58] transition"
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      )
    }

    // Verificar que el usuario tiene acceso al proyecto
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: report.project.id,
          userId: session.user.id,
        },
      },
    })

    // Admins siempre tienen acceso
    const isAdmin = session.user.role === 'ADMIN'

    if (!membership && !isAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Sin acceso</h1>
            <p className="text-gray-600 mb-6">
              No tienes permisos para ver este informe.
            </p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-3 bg-[#215A6B] text-white rounded-lg hover:bg-[#1a4a58] transition"
            >
              Ir al dashboard
            </a>
          </div>
        </div>
      )
    }
  }

  // Generar HTML final con notas inyectadas
  let finalHtml = report.htmlContent
  if (report.strengths) {
    const notesTitleText = report.executiveSummary || 'Notas del Equipo'
    const customNotesHtml = `
      <div style="margin-top: 40px; padding: 30px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border-left: 4px solid #215A6B; page-break-inside: avoid;">
        <h2 style="color: #215A6B; margin: 0 0 20px 0; font-size: 1.5rem; font-weight: 600;">${notesTitleText}</h2>
        <div style="color: #4a5568; line-height: 1.8; white-space: pre-wrap;">${report.strengths}</div>
      </div>
    `
    if (finalHtml.includes('</body>')) {
      finalHtml = finalHtml.replace('</body>', `${customNotesHtml}</body>`)
    } else {
      finalHtml = finalHtml + customNotesHtml
    }
  }

  return (
    <PublicReportViewer
      htmlContent={finalHtml}
      title={report.title}
      projectName={report.project.name}
    />
  )
}
