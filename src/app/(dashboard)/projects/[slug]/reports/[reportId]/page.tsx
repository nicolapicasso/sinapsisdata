import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ReportViewer } from '@/components/reports/ReportViewer'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

interface ReportPageProps {
  params: { slug: string; reportId: string }
}

export default async function ReportPage({ params }: ReportPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    include: {
      project: {
        include: {
          members: true,
        },
      },
      createdBy: {
        select: { name: true },
      },
      files: true,
    },
  })

  if (!report) {
    notFound()
  }

  // Verificar acceso
  if (session.user.role !== 'ADMIN') {
    const isMember = report.project.members.some((m) => m.userId === session.user.id)
    if (!isMember) {
      redirect('/projects')
    }
  }

  return (
    <div className="h-full flex flex-col -m-6">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <Link
          href={`/projects/${params.slug}`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-primary mb-3 transition text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al proyecto
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-dark">{report.title}</h1>
            {report.description && (
              <p className="text-gray-500 text-sm mt-1">{report.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {report.status === 'READY' && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Generado
              </span>
            )}
            {report.status === 'PROCESSING' && (
              <span className="text-sm text-blue-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </span>
            )}
            {report.status === 'ERROR' && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Error
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-100">
        {report.status === 'READY' && report.htmlContent ? (
          <ReportViewer htmlContent={report.htmlContent} title={report.title} />
        ) : report.status === 'PROCESSING' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-medium text-dark">Generando informe...</p>
              <p className="text-gray-500 mt-1">Esto puede tardar unos segundos</p>
            </div>
          </div>
        ) : report.status === 'ERROR' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-dark">Error al generar el informe</p>
              <p className="text-gray-500 mt-1">{report.errorMessage || 'Ha ocurrido un error inesperado'}</p>
              <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition">
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500">Este informe aun no ha sido generado</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
