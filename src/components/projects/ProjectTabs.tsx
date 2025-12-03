'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  MessageSquareMore,
  Lightbulb,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  BookOpen,
  Send,
  ThumbsUp,
  ThumbsDown,
  X,
  Loader2,
  LayoutDashboard,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

interface Report {
  id: string
  title: string
  status: string
  isPublished: boolean
  createdAt: Date
  createdBy: { name: string }
}

interface Question {
  id: string
  question: string
  context: string | null
  status: string
  answer: string | null
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

interface Overview {
  id: string
  title: string
  status: string
  htmlContent: string | null
  executiveSummary: string | null
  aiMetadata: {
    projectStatus?: 'GREEN' | 'YELLOW' | 'RED'
    model?: string
    inputTokens?: number
    outputTokens?: number
    duration?: number
  } | null
  createdAt: Date
  updatedAt: Date
  createdBy: { name: string }
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
  userRole,
}: ProjectTabsProps) {
  const router = useRouter()
  const isClient = userRole === 'CLIENT'

  // Filtrar informes para clientes: solo mostrar READY
  const visibleReports = isClient ? reports.filter((r) => r.status === 'READY') : reports

  // Filtrar preguntas y propuestas pendientes
  const pendingQuestions = questions.filter((q) => q.status === 'PENDING')
  const answeredQuestions = questions.filter((q) => q.status === 'ANSWERED')
  const pendingProposals = proposals.filter((p) => p.status === 'PENDING')

  const [activeTab, setActiveTab] = useState('reports')

  // Estado para responder preguntas
  const [answeringQuestion, setAnsweringQuestion] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Estado para votar propuestas
  const [votingProposal, setVotingProposal] = useState<string | null>(null)

  // Estado para Overview
  const [overview, setOverview] = useState<Overview | null>(null)
  const [generatingOverview, setGeneratingOverview] = useState(false)

  // Estado para publicar/despublicar informes
  const [togglingPublish, setTogglingPublish] = useState<string | null>(null)

  // Cargar overview al montar
  useEffect(() => {
    if (!isClient) {
      fetchOverview()
    }
  }, [project.slug, isClient])

  // Polling cuando el overview esta procesando
  useEffect(() => {
    if (overview?.status === 'PROCESSING') {
      const interval = setInterval(fetchOverview, 3000)
      return () => clearInterval(interval)
    }
  }, [overview?.status])

  const fetchOverview = async () => {
    try {
      const res = await fetch(`/api/projects/${project.slug}/overview`)
      if (res.ok) {
        const data = await res.json()
        setOverview(data.overview)
      }
    } catch (error) {
      console.error('Error fetching overview:', error)
    }
  }

  const handleGenerateOverview = async () => {
    setGeneratingOverview(true)
    try {
      const res = await fetch(`/api/projects/${project.slug}/overview`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al generar')
      }
      // Refrescar para mostrar el estado PROCESSING
      await fetchOverview()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al generar overview')
    } finally {
      setGeneratingOverview(false)
    }
  }

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
          id: 'overview',
          label: 'Overview',
          icon: LayoutDashboard,
          count: 0,
        },
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
          count: pendingQuestions.length,
          highlight: pendingQuestions.length > 0,
        },
        {
          id: 'proposals',
          label: 'Propuestas IA',
          icon: Lightbulb,
          count: pendingProposals.length,
          highlight: pendingProposals.length > 0,
        },
      ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" /> Listo
          </span>
        )
      case 'PROCESSING':
        return (
          <span className="flex items-center gap-1 text-xs text-blue-600">
            <Clock className="w-3 h-3" /> Procesando
          </span>
        )
      case 'ERROR':
        return (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <XCircle className="w-3 h-3" /> Error
          </span>
        )
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

  const handleAnswerQuestion = async (questionId: string) => {
    if (!answerText.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerText }),
      })

      if (!res.ok) throw new Error('Error al responder')

      setAnsweringQuestion(null)
      setAnswerText('')
      router.refresh()
    } catch {
      alert('Error al enviar la respuesta')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismissQuestion = async (questionId: string) => {
    if (!confirm('¿Descartar esta pregunta?')) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/questions/${questionId}/dismiss`, {
        method: 'POST',
      })

      if (!res.ok) throw new Error('Error al descartar')

      router.refresh()
    } catch {
      alert('Error al descartar la pregunta')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVoteProposal = async (proposalId: string, action: 'approve' | 'reject') => {
    setVotingProposal(proposalId)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) throw new Error('Error al votar')

      router.refresh()
    } catch {
      alert('Error al procesar el voto')
    } finally {
      setVotingProposal(null)
    }
  }

  const handleTogglePublish = async (e: React.MouseEvent, reportId: string, currentStatus: boolean) => {
    e.preventDefault()
    e.stopPropagation()

    setTogglingPublish(reportId)
    try {
      const res = await fetch(`/api/reports/${reportId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !currentStatus }),
      })

      if (!res.ok) throw new Error('Error al cambiar estado')

      router.refresh()
    } catch {
      alert('Error al cambiar estado de publicación')
    } finally {
      setTogglingPublish(null)
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
        {/* Tab de Overview (solo para admin/consultor) */}
        {activeTab === 'overview' && !isClient && (
          <div>
            {!overview ? (
              // No hay overview
              <div className="text-center py-12">
                <LayoutDashboard className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-dark mb-2">Overview del Proyecto</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  El Overview es un resumen ejecutivo generado por IA que sintetiza todos los informes,
                  tendencias y propuestas del proyecto.
                </p>
                {visibleReports.filter(r => r.status === 'READY').length === 0 ? (
                  <p className="text-sm text-amber-600">
                    Necesitas al menos un informe generado para crear el Overview
                  </p>
                ) : (
                  <button
                    onClick={handleGenerateOverview}
                    disabled={generatingOverview}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-600 transition disabled:opacity-50"
                  >
                    {generatingOverview ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <LayoutDashboard className="w-5 h-5" />
                    )}
                    Generar Overview
                  </button>
                )}
              </div>
            ) : overview.status === 'PROCESSING' ? (
              // Overview procesando
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                <h3 className="text-lg font-medium text-dark mb-2">Generando Overview...</h3>
                <p className="text-gray-500">
                  Esto puede tardar entre 30 segundos y 1 minuto
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  La página se actualizará automáticamente
                </p>
              </div>
            ) : overview.status === 'READY' ? (
              // Overview listo
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    {/* Badge de estado del proyecto */}
                    {overview.aiMetadata?.projectStatus && (
                      <div
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
                          overview.aiMetadata.projectStatus === 'GREEN'
                            ? 'bg-green-100 text-green-700'
                            : overview.aiMetadata.projectStatus === 'YELLOW'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        )}
                      >
                        <span>
                          {overview.aiMetadata.projectStatus === 'GREEN'
                            ? '🟢'
                            : overview.aiMetadata.projectStatus === 'YELLOW'
                            ? '🟡'
                            : '🔴'}
                        </span>
                        {overview.aiMetadata.projectStatus === 'GREEN'
                          ? 'En buen camino'
                          : overview.aiMetadata.projectStatus === 'YELLOW'
                          ? 'Requiere atención'
                          : 'En riesgo'}
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-medium text-dark">{overview.title}</h3>
                      <p className="text-sm text-gray-500">
                        Actualizado: {formatDate(overview.updatedAt || overview.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGenerateOverview}
                      disabled={generatingOverview}
                      className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm"
                    >
                      {generatingOverview ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Regenerar
                    </button>
                    <Link
                      href={`/projects/${project.slug}/reports/${overview.id}`}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition text-sm"
                    >
                      Ver Overview
                    </Link>
                  </div>
                </div>

                {/* Summary */}
                {overview.executiveSummary && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-700">{overview.executiveSummary}</p>
                  </div>
                )}

                {/* Preview del overview */}
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <p className="text-sm text-gray-600">
                      Vista previa del dashboard ejecutivo
                    </p>
                  </div>
                  <div className="h-96 overflow-hidden">
                    <iframe
                      srcDoc={overview.htmlContent || ''}
                      className="w-full h-full border-0 transform scale-75 origin-top-left"
                      style={{ width: '133%', height: '133%' }}
                      title="Overview preview"
                      sandbox="allow-scripts"
                    />
                  </div>
                </div>
              </div>
            ) : overview.status === 'ERROR' ? (
              // Overview con error
              <div className="text-center py-12">
                <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <h3 className="text-lg font-medium text-dark mb-2">Error al generar Overview</h3>
                <p className="text-gray-500 mb-6">Hubo un problema al generar el overview</p>
                <button
                  onClick={handleGenerateOverview}
                  disabled={generatingOverview}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition disabled:opacity-50"
                >
                  {generatingOverview ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Reintentar
                </button>
              </div>
            ) : null}
          </div>
        )}

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
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-dark">{report.title}</h3>
                          {!isClient && (
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full',
                                report.isPublished
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              )}
                            >
                              {report.isPublished ? 'Publicado' : 'Borrador'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {isClient
                            ? formatDate(report.createdAt)
                            : `Por ${report.createdBy.name} · ${formatDate(report.createdAt)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {!isClient && getStatusBadge(report.status)}
                        {!isClient && report.status === 'READY' && (
                          <button
                            onClick={(e) => handleTogglePublish(e, report.id, report.isPublished)}
                            disabled={togglingPublish === report.id}
                            className={cn(
                              'flex items-center gap-1 px-2 py-1 text-xs rounded transition',
                              report.isPublished
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-green-600 hover:bg-green-50'
                            )}
                            title={report.isPublished ? 'Despublicar' : 'Publicar'}
                          >
                            {togglingPublish === report.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : report.isPublished ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
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
                  <div key={proposal.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
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
            {pendingQuestions.length === 0 && answeredQuestions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquareMore className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay preguntas</p>
                <p className="text-sm mt-1">Las preguntas apareceran cuando la IA necesite mas informacion</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Preguntas pendientes */}
                {pendingQuestions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Pendientes de responder</h3>
                    <div className="space-y-3">
                      {pendingQuestions.map((question) => (
                        <div
                          key={question.id}
                          className="p-4 border border-accent/30 bg-accent/5 rounded-lg"
                        >
                          <p className="text-dark font-medium">{question.question}</p>
                          {question.context && (
                            <p className="text-sm text-gray-500 mt-1 italic">{question.context}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">{formatDate(question.createdAt)}</p>

                          {answeringQuestion === question.id ? (
                            <div className="mt-4 space-y-3">
                              <textarea
                                value={answerText}
                                onChange={(e) => setAnswerText(e.target.value)}
                                placeholder="Escribe tu respuesta..."
                                className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAnswerQuestion(question.id)}
                                  disabled={submitting || !answerText.trim()}
                                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition disabled:opacity-50 text-sm"
                                >
                                  {submitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                  Enviar respuesta
                                </button>
                                <button
                                  onClick={() => {
                                    setAnsweringQuestion(null)
                                    setAnswerText('')
                                  }}
                                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => setAnsweringQuestion(question.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-600 transition"
                              >
                                <Send className="w-3 h-3" />
                                Responder
                              </button>
                              <button
                                onClick={() => handleDismissQuestion(question.id)}
                                disabled={submitting}
                                className="flex items-center gap-1 px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded text-sm transition"
                              >
                                <X className="w-3 h-3" />
                                Descartar
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preguntas respondidas */}
                {answeredQuestions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Respondidas</h3>
                    <div className="space-y-3">
                      {answeredQuestions.map((question) => (
                        <div key={question.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <p className="text-dark">{question.question}</p>
                          {question.answer && (
                            <div className="mt-2 p-3 bg-white rounded border-l-4 border-green-500">
                              <p className="text-sm text-gray-700">{question.answer}</p>
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-2">{formatDate(question.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab de Propuestas IA (solo para admin/consultor) */}
        {activeTab === 'proposals' && !isClient && (
          <div>
            {pendingProposals.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay propuestas pendientes</p>
                <p className="text-sm mt-1">Las propuestas apareceran al generar informes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingProposals.map((proposal) => (
                  <div key={proposal.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeBadge(proposal.type)}
                          {getPriorityBadge(proposal.priority)}
                        </div>
                        <h3 className="font-medium text-dark">{proposal.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{proposal.description}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{formatDate(proposal.createdAt)}</p>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleVoteProposal(proposal.id, 'approve')}
                        disabled={votingProposal === proposal.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm"
                      >
                        {votingProposal === proposal.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ThumbsUp className="w-4 h-4" />
                        )}
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleVoteProposal(proposal.id, 'reject')}
                        disabled={votingProposal === proposal.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm"
                      >
                        {votingProposal === proposal.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ThumbsDown className="w-4 h-4" />
                        )}
                        Rechazar
                      </button>
                    </div>
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
