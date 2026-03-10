'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Square,
  CheckSquare,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

interface OptimizationAction {
  id: string
  type: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED'
  claudeReason: string
  payload: Record<string, unknown>
  targetEntity: {
    campaignId?: string
    campaignName?: string
    adGroupId?: string
    adGroupName?: string
    keywordId?: string
    keywordText?: string
    searchTerm?: string
    placement?: string
  }
  metrics?: {
    cost?: number
    conversions?: number
    ctr?: number
  }
  userComment?: string | null
  errorMessage?: string | null
  reviewedAt?: string | null
  executedAt?: string | null
  createdAt: string
  dataSource: {
    accountId: string
    accountName: string
  }
  user?: {
    name: string
  }
}

interface OptimizationActionsTabProps {
  projectId: string
  projectSlug: string
}

export function OptimizationActionsTab({ projectId, projectSlug }: OptimizationActionsTabProps) {
  const [actions, setActions] = useState<OptimizationAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'history'>('pending')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => {
    fetchActions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function fetchActions() {
    try {
      setLoading(true)
      const res = await fetch(`/api/optimization/actions?projectId=${projectId}`)
      if (!res.ok) throw new Error('Error al cargar acciones')
      const data = await res.json()
      setActions(data.actions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(actionId: string) {
    setProcessingId(actionId)
    try {
      const res = await fetch(`/api/optimization/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al aprobar')
      }
      await fetchActions()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al aprobar')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(actionId: string) {
    setProcessingId(actionId)
    try {
      const res = await fetch(`/api/optimization/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al rechazar')
      }
      await fetchActions()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al rechazar')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleExecute(actionId: string) {
    if (!confirm('¿Ejecutar esta acción en Google Ads? Esta acción modificará la cuenta.')) {
      return
    }

    setProcessingId(actionId)
    try {
      const res = await fetch(`/api/optimization/actions/${actionId}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al ejecutar')
      }
      alert('Acción ejecutada correctamente en Google Ads')
      await fetchActions()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al ejecutar')
      await fetchActions()
    } finally {
      setProcessingId(null)
    }
  }

  async function handleDelete(actionId: string) {
    if (!confirm('¿Eliminar esta acción?')) return

    setProcessingId(actionId)
    try {
      const res = await fetch(`/api/optimization/actions/${actionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar')
      }
      await fetchActions()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setProcessingId(null)
    }
  }

  function toggleSelect(actionId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(actionId)) {
        next.delete(actionId)
      } else {
        next.add(actionId)
      }
      return next
    })
  }

  function toggleSelectAll() {
    const selectableActions = filteredActions.filter(
      (a) => a.status === 'APPROVED' || a.status === 'PENDING'
    )
    const allSelected = selectableActions.every((a) => selectedIds.has(a.id))

    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableActions.map((a) => a.id)))
    }
  }

  async function handleBulkApprove() {
    const pendingSelected = Array.from(selectedIds).filter((id) => {
      const action = actions.find((a) => a.id === id)
      return action?.status === 'PENDING'
    })

    if (pendingSelected.length === 0) {
      alert('No hay acciones pendientes seleccionadas para aprobar')
      return
    }

    if (!confirm(`¿Aprobar ${pendingSelected.length} acciones seleccionadas?`)) {
      return
    }

    setBulkProcessing(true)
    let successCount = 0
    let errorCount = 0

    for (const actionId of pendingSelected) {
      try {
        const res = await fetch(`/api/optimization/actions/${actionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'APPROVED' }),
        })
        if (res.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    setBulkProcessing(false)
    setSelectedIds(new Set())
    await fetchActions()
    alert(`Aprobadas: ${successCount}, Errores: ${errorCount}`)
  }

  async function handleBulkExecute() {
    const approvedSelected = Array.from(selectedIds).filter((id) => {
      const action = actions.find((a) => a.id === id)
      return action?.status === 'APPROVED'
    })

    if (approvedSelected.length === 0) {
      alert('No hay acciones aprobadas seleccionadas para ejecutar')
      return
    }

    if (!confirm(`¿Ejecutar ${approvedSelected.length} acciones en Google Ads? Esta acción modificará la cuenta.`)) {
      return
    }

    setBulkProcessing(true)
    let successCount = 0
    let errorCount = 0

    for (const actionId of approvedSelected) {
      try {
        const res = await fetch(`/api/optimization/actions/${actionId}`, {
          method: 'POST',
        })
        if (res.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    setBulkProcessing(false)
    setSelectedIds(new Set())
    await fetchActions()
    alert(`Ejecutadas: ${successCount}, Errores: ${errorCount}`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
            <Clock className="w-3 h-3" /> Pendiente
          </span>
        )
      case 'APPROVED':
        return (
          <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
            <ThumbsUp className="w-3 h-3" /> Aprobada
          </span>
        )
      case 'REJECTED':
        return (
          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
            <ThumbsDown className="w-3 h-3" /> Rechazada
          </span>
        )
      case 'EXECUTED':
        return (
          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
            <CheckCircle className="w-3 h-3" /> Ejecutada
          </span>
        )
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
            <XCircle className="w-3 h-3" /> Error
          </span>
        )
      default:
        return null
    }
  }

  const getTypeBadge = (type: string) => {
    const typeLabels: Record<string, string> = {
      NEGATIVE_KEYWORD: 'Keyword negativa',
      EXCLUDE_PLACEMENT: 'Excluir placement',
      PAUSE_KEYWORD: 'Pausar keyword',
      ENABLE_KEYWORD: 'Activar keyword',
      UPDATE_KEYWORD_BID: 'Cambiar puja',
      UPDATE_CAMPAIGN_BUDGET: 'Cambiar presupuesto',
      PAUSE_CAMPAIGN: 'Pausar campaña',
      ENABLE_CAMPAIGN: 'Activar campaña',
    }
    return (
      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
        {typeLabels[type] || type}
      </span>
    )
  }

  // Filter actions
  const filteredActions = actions.filter((a) => {
    if (filter === 'pending') return a.status === 'PENDING'
    if (filter === 'approved') return a.status === 'APPROVED'
    if (filter === 'history') return ['EXECUTED', 'FAILED', 'REJECTED'].includes(a.status)
    return true
  })

  const pendingCount = actions.filter((a) => a.status === 'PENDING').length
  const approvedCount = actions.filter((a) => a.status === 'APPROVED').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-500" />
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-dark">Acciones de Optimización</h3>
          <p className="text-sm text-gray-500">
            Revisa y ejecuta las acciones sugeridas por la IA
          </p>
        </div>
        <Link
          href={`/projects/${projectSlug}/optimize`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition text-sm"
        >
          <Zap className="w-4 h-4" />
          Nueva optimización
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition',
              filter === 'pending'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition',
              filter === 'approved'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Aprobadas ({approvedCount})
          </button>
          <button
            onClick={() => setFilter('history')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition',
              filter === 'history'
                ? 'bg-gray-200 text-gray-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Historial
          </button>
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition',
              filter === 'all'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Todas ({actions.length})
          </button>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {selectedIds.size} seleccionadas
            </span>
            {filter === 'pending' && (
              <button
                onClick={handleBulkApprove}
                disabled={bulkProcessing}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition disabled:opacity-50"
              >
                {bulkProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ThumbsUp className="w-4 h-4" />
                )}
                Aprobar seleccionadas
              </button>
            )}
            {filter === 'approved' && (
              <button
                onClick={handleBulkExecute}
                disabled={bulkProcessing}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-600 transition disabled:opacity-50"
              >
                {bulkProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Ejecutar seleccionadas
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1.5 text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Actions list */}
      {filteredActions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No hay acciones {filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobadas' : ''}</p>
          {filter === 'pending' && (
            <Link
              href={`/projects/${projectSlug}/optimize`}
              className="text-primary hover:underline text-sm mt-2 inline-block"
            >
              Ejecutar un nuevo análisis
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select all header */}
          {(filter === 'pending' || filter === 'approved') && filteredActions.length > 1 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              >
                {filteredActions.every((a) => selectedIds.has(a.id)) ? (
                  <CheckSquare className="w-5 h-5 text-primary" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
                Seleccionar todas ({filteredActions.length})
              </button>
            </div>
          )}

          {filteredActions.map((action) => (
            <div
              key={action.id}
              className={cn(
                'border rounded-lg overflow-hidden',
                selectedIds.has(action.id) ? 'border-primary bg-primary/5' : 'border-gray-200'
              )}
            >
              {/* Main row */}
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Checkbox for selectable actions */}
                  {(action.status === 'PENDING' || action.status === 'APPROVED') && (
                    <button
                      onClick={() => toggleSelect(action.id)}
                      className="mt-1 flex-shrink-0"
                    >
                      {selectedIds.has(action.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getStatusBadge(action.status)}
                      {getTypeBadge(action.type)}
                      <span className="text-xs text-gray-400">
                        {action.dataSource.accountName}
                      </span>
                    </div>

                    {/* Target entity */}
                    <div className="text-sm text-gray-700 mb-1">
                      {action.targetEntity.campaignName && (
                        <span className="font-medium">{action.targetEntity.campaignName}</span>
                      )}
                      {action.targetEntity.adGroupName && (
                        <span className="text-gray-500">
                          {' > '}{action.targetEntity.adGroupName}
                        </span>
                      )}
                    </div>

                    {/* Specific target */}
                    <div className="text-sm">
                      {action.targetEntity.searchTerm && (
                        <span className="text-dark">
                          Termino: <strong>&quot;{action.targetEntity.searchTerm}&quot;</strong>
                        </span>
                      )}
                      {action.targetEntity.keywordText && (
                        <span className="text-dark">
                          Keyword: <strong>&quot;{action.targetEntity.keywordText}&quot;</strong>
                        </span>
                      )}
                      {action.targetEntity.placement && (
                        <span className="text-dark">
                          Placement: <strong>{action.targetEntity.placement}</strong>
                        </span>
                      )}
                    </div>

                    {/* Metrics */}
                    {action.metrics && Object.keys(action.metrics).length > 0 && (
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        {action.metrics.cost !== undefined && (
                          <span>Coste: {action.metrics.cost.toFixed(2)}€</span>
                        )}
                        {action.metrics.conversions !== undefined && (
                          <span>Conv: {action.metrics.conversions}</span>
                        )}
                        {action.metrics.ctr !== undefined && (
                          <span>CTR: {action.metrics.ctr.toFixed(2)}%</span>
                        )}
                      </div>
                    )}

                    {/* Error message */}
                    {action.status === 'FAILED' && action.errorMessage && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        {action.errorMessage}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {action.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(action.id)}
                          disabled={processingId === action.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {processingId === action.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ThumbsUp className="w-4 h-4" />
                          )}
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleReject(action.id)}
                          disabled={processingId === action.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition disabled:opacity-50"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {action.status === 'APPROVED' && (
                      <>
                        <button
                          onClick={() => handleExecute(action.id)}
                          disabled={processingId === action.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-600 transition disabled:opacity-50"
                        >
                          {processingId === action.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Ejecutar
                        </button>
                        <button
                          onClick={() => handleDelete(action.id)}
                          disabled={processingId === action.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded text-sm transition"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => setExpandedId(expandedId === action.id ? null : action.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === action.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === action.id && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50">
                  <div className="mt-3 space-y-3">
                    {/* Claude reason */}
                    <div>
                      <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">
                        Razonamiento IA
                      </h5>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {action.claudeReason}
                      </p>
                    </div>

                    {/* Payload */}
                    <div>
                      <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">
                        Datos de la accion
                      </h5>
                      <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                        {JSON.stringify(action.payload, null, 2)}
                      </pre>
                    </div>

                    {/* Timestamps */}
                    <div className="flex gap-6 text-xs text-gray-500">
                      <span>Creada: {formatDate(action.createdAt)}</span>
                      {action.reviewedAt && (
                        <span>Revisada: {formatDate(action.reviewedAt)}</span>
                      )}
                      {action.executedAt && (
                        <span>Ejecutada: {formatDate(action.executedAt)}</span>
                      )}
                    </div>

                    {/* IDs for debugging */}
                    <div className="flex gap-4 text-xs text-gray-400">
                      {action.targetEntity.campaignId && (
                        <span>Campaign ID: {action.targetEntity.campaignId}</span>
                      )}
                      {action.targetEntity.adGroupId && (
                        <span>AdGroup ID: {action.targetEntity.adGroupId}</span>
                      )}
                      {action.targetEntity.keywordId && (
                        <span>Keyword ID: {action.targetEntity.keywordId}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bulk action hint */}
      {filter === 'approved' && approvedCount > 1 && selectedIds.size === 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-800">
                {approvedCount} acciones aprobadas listas para ejecutar
              </p>
              <p className="text-sm text-blue-600">
                Selecciona las acciones que quieras ejecutar o haz clic en &quot;Seleccionar todas&quot;
              </p>
            </div>
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition text-sm"
            >
              <CheckSquare className="w-4 h-4" />
              Seleccionar todas
            </button>
          </div>
        </div>
      )}

      {filter === 'pending' && pendingCount > 1 && selectedIds.size === 0 && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-yellow-800">
                {pendingCount} acciones pendientes de revisión
              </p>
              <p className="text-sm text-yellow-600">
                Selecciona las acciones que quieras aprobar en lote
              </p>
            </div>
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
            >
              <CheckSquare className="w-4 h-4" />
              Seleccionar todas
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
