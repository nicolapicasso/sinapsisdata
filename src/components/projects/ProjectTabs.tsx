'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, MessageSquareMore, Lightbulb, Plus, Clock, CheckCircle, XCircle, BookOpen } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

interface Report {
  id: string
  title: string
  status: string
  createdAt: Date
  createdBy: { name: string }
}

interface Question {
  id: string
  question: string
  status: string
  createdAt: Date
}

interface Proposal {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  createdAt: Date
}

interface ProjectTabsProps {
  project: {
    slug: string
    _count: {
      reports: number
      questions: number
      proposals: number
    }
  }
  reports: Report[]
  questions: Question[]
  proposals: Proposal[]
  approvedProposals?: Proposal[]
  canEdit: boolean
  userRole: 'ADMIN' | 'CONSULTANT' | 'CLIENT'
}

export function ProjectTabs({
  project,
  reports,
  questions,
  proposals,
  approvedProposals = [],
  canEdit,
  userRole
}: ProjectTabsProps) {
  const isClient = userRole === 'CLIENT'

  // Filtrar informes para clientes: solo mostrar READY
  const visibleReports = isClient
    ? reports.filter(r => r.status === 'READY')
    : reports

  const [activeTab, setActiveTab] = useState('reports')

  // Tabs diferentes segun el rol
  const tabs = isClient
    ? [
        {
          id: 'reports',
          label: 'Informes',
          icon: FileText,
          count: visibleReports.length,
        },
        {
          id: 'conclusions',
          label: 'Conclusiones',
          icon: BookOpen,
          count: approvedProposals.length,
        },
      ]
    : [
        {
          id: 'reports',
          label: 'Informes',
          icon: FileText,
          count: project._count.reports,
        },
        {
          id: 'questions',
          label: 'Preguntas IA',
          icon: MessageSquareMore,
          count: project._count.questions,
          highlight: project._count.questions > 0,
        },
        {
          id: 'proposals',
          label: 'Propuestas IA',
          icon: Lightbulb,
          count: project._count.proposals,
          highlight: project._count.proposals > 0,
        },
      ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" /> Listo</span>
      case 'PROCESSING':
        return <span className="flex items-center gap-1 text-xs text-blue-600"><Clock className="w-3 h-3" /> Procesando</span>
      case 'ERROR':
        return <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3 h-3" /> Error</span>
      default:
        return <span className="text-xs text-gray-500">Borrador</span>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Critico</span>
      case 'HIGH':
        return <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Alto</span>
      case 'MEDIUM':
        return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Medio</span>
      default:
        return <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Bajo</span>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'ACTION':
        return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Accion</span>
      case 'INSIGHT':
        return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Insight</span>
      case 'RISK':
        return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Riesgo</span>
      case 'OPPORTUNITY':
        return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Oportunidad</span>
      default:
        return null
    }
  }

  // Labels amigables para clientes (sin mencionar IA)
  const getTypeLabelForClient = (type: string) => {
    switch (type) {
      case 'ACTION':
        return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Recomendacion</span>
      case 'INSIGHT':
        return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Hallazgo</span>
      case 'RISK':
        return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Alerta</span>
      case 'OPPORTUNITY':
        return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Oportunidad</span>
      default:
        return null
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="border-b border-gray-200">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs rounded-full',
                    'highlight' in tab && tab.highlight ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'reports' && (
          <div>
            {canEdit && (
              <div className="mb-6">
                <Link
                  href={`/projects/${project.slug}/reports/new`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Informe
                </Link>
              </div>
            )}

            {visibleReports.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay informes disponibles</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleReports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/projects/${project.slug}/reports/${report.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-primary hover:shadow-sm transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-dark">{report.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {isClient ? formatDate(report.createdAt) : `Por ${report.createdBy.name} · ${formatDate(report.createdAt)}`}
                        </p>
                      </div>
                      {!isClient && getStatusBadge(report.status)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab de Conclusiones (solo para clientes) */}
        {activeTab === 'conclusions' && isClient && (
          <div>
            {approvedProposals.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay conclusiones disponibles</p>
                <p className="text-sm mt-1">Las conclusiones apareceran cuando el equipo las valide</p>
              </div>
            ) : (
              <div className="space-y-4">
                {approvedProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeLabelForClient(proposal.type)}
                          {getPriorityBadge(proposal.priority)}
                        </div>
                        <h3 className="font-medium text-dark">{proposal.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{proposal.description}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">{formatDate(proposal.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab de Preguntas IA (solo para admin/consultor) */}
        {activeTab === 'questions' && !isClient && (
          <div>
            {questions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquareMore className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay preguntas pendientes</p>
                <p className="text-sm mt-1">Las preguntas apareceran cuando la IA necesite mas informacion</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className="p-4 border border-gray-200 rounded-lg"
                  >
                    <p className="text-dark">{question.question}</p>
                    <p className="text-sm text-gray-500 mt-2">{formatDate(question.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab de Propuestas IA (solo para admin/consultor) */}
        {activeTab === 'proposals' && !isClient && (
          <div>
            {proposals.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay propuestas pendientes</p>
                <p className="text-sm mt-1">Las propuestas apareceran al generar informes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeBadge(proposal.type)}
                          {getPriorityBadge(proposal.priority)}
                        </div>
                        <h3 className="font-medium text-dark">{proposal.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{proposal.description}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{formatDate(proposal.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
