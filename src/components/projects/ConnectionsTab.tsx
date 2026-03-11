'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Link2,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

// Google Ads icon component
function GoogleAdsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.25 2L2.5 18.5L6.5 21.5L16.25 5L12.25 2Z" fill="#FBBC04"/>
      <path d="M21.5 18.5C21.5 20.433 19.933 22 18 22C16.067 22 14.5 20.433 14.5 18.5C14.5 16.567 16.067 15 18 15C19.933 15 21.5 16.567 21.5 18.5Z" fill="#4285F4"/>
      <path d="M7.75 22L17.5 5.5L13.5 2.5L3.75 19L7.75 22Z" fill="#34A853"/>
    </svg>
  )
}

// Google Analytics icon component
function GoogleAnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" fill="#F9AB00"/>
      <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22V12V2Z" fill="#E37400"/>
      <circle cx="12" cy="17" r="2" fill="white"/>
      <rect x="11" y="6" width="2" height="8" fill="white"/>
      <rect x="6" y="11" width="2" height="6" fill="white"/>
      <rect x="16" y="9" width="2" height="8" fill="white"/>
    </svg>
  )
}

// Google Search Console icon component
function SearchConsoleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="#4285F4"/>
    </svg>
  )
}

interface DataSource {
  id: string
  type: 'GOOGLE_ADS' | 'GOOGLE_ANALYTICS' | 'GOOGLE_SEARCH_CONSOLE' | 'GOOGLE_MERCHANT' | 'META_ADS' | 'INSTAGRAM' | 'YOUTUBE' | 'CUSTOM_API'
  accountId: string
  accountName: string
  mccId?: string | null
  metadata?: {
    currency?: string
    timezone?: string
    isManager?: boolean
    permissionLevel?: string
  } | null
  status: 'CONNECTED' | 'ERROR' | 'EXPIRED' | 'PENDING'
  isActive: boolean
  lastSyncAt?: Date | null
  lastError?: string | null
  createdAt: Date
  updatedAt: Date
}

interface ConnectionsTabProps {
  projectId: string
  projectSlug: string
  dataSources: DataSource[]
}

export function ConnectionsTab({ projectId, projectSlug, dataSources: initialDataSources }: ConnectionsTabProps) {
  const [dataSources, setDataSources] = useState(initialDataSources)
  const [loading, setLoading] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
            <CheckCircle className="w-3 h-3" /> Conectado
          </span>
        )
      case 'EXPIRED':
        return (
          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" /> Token expirado
          </span>
        )
      case 'ERROR':
        return (
          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
            <AlertCircle className="w-3 h-3" /> Error
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" /> Pendiente
          </span>
        )
    }
  }

  const handleConnectGoogleAds = () => {
    window.location.href = `/api/auth/google-ads/connect?projectId=${projectId}`
  }

  const handleConnectGoogleAnalytics = () => {
    window.location.href = `/api/auth/google-analytics/connect?projectId=${projectId}`
  }

  const handleConnectSearchConsole = () => {
    window.location.href = `/api/auth/google-search-console/connect?projectId=${projectId}`
  }

  const handleToggleActive = async (dataSourceId: string, currentActive: boolean) => {
    setLoading(dataSourceId)
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })

      if (!res.ok) throw new Error('Error al actualizar')

      setDataSources(prev =>
        prev.map(ds =>
          ds.id === dataSourceId ? { ...ds, isActive: !currentActive } : ds
        )
      )
    } catch {
      alert('Error al cambiar estado de la conexión')
    } finally {
      setLoading(null)
    }
  }

  const handleRefreshToken = async (dataSourceId: string) => {
    setLoading(dataSourceId)
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al refrescar token')
      }

      await res.json()
      setDataSources(prev =>
        prev.map(ds =>
          ds.id === dataSourceId ? { ...ds, status: 'CONNECTED' as const } : ds
        )
      )
      alert('Token actualizado correctamente')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al refrescar token')
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async (dataSourceId: string) => {
    if (!confirm('¿Estás seguro de desconectar esta fuente de datos?')) return

    setDeletingId(dataSourceId)
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Error al eliminar')

      setDataSources(prev => prev.filter(ds => ds.id !== dataSourceId))
    } catch {
      alert('Error al eliminar la conexión')
    } finally {
      setDeletingId(null)
    }
  }

  const googleAdsConnections = dataSources.filter(ds => ds.type === 'GOOGLE_ADS')
  const analyticsConnections = dataSources.filter(ds => ds.type === 'GOOGLE_ANALYTICS')
  const searchConsoleConnections = dataSources.filter(ds => ds.type === 'GOOGLE_SEARCH_CONSOLE')

  return (
    <div className="space-y-8">
      {/* Google Ads Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <GoogleAdsIcon className="w-6 h-6" />
            <div>
              <h3 className="font-semibold text-dark">Google Ads</h3>
              <p className="text-sm text-gray-500">Conecta tus cuentas de Google Ads para analizar y optimizar campañas</p>
            </div>
          </div>
          <button
            onClick={handleConnectGoogleAds}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Conectar cuenta
          </button>
        </div>

        {googleAdsConnections.length === 0 ? (
          <div className="p-6 border border-dashed border-gray-300 rounded-lg text-center">
            <Link2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No hay cuentas de Google Ads conectadas</p>
            <p className="text-gray-400 text-xs mt-1">
              Conecta una cuenta para acceder a la herramienta de optimización
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {googleAdsConnections.map(ds => (
              <div
                key={ds.id}
                className={cn(
                  'p-4 border rounded-lg transition',
                  ds.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <GoogleAdsIcon className="w-8 h-8" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-dark">{ds.accountName}</h4>
                        {getStatusBadge(ds.status)}
                        {ds.metadata?.isManager && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">MCC</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        ID: {ds.accountId}
                        {ds.metadata?.currency && ` · ${ds.metadata.currency}`}
                        {ds.metadata?.timezone && ` · ${ds.metadata.timezone}`}
                      </p>
                      {ds.lastSyncAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Última sincronización: {formatDate(ds.lastSyncAt)}
                        </p>
                      )}
                      {ds.lastError && (
                        <p className="text-xs text-red-500 mt-1">{ds.lastError}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggleActive(ds.id, ds.isActive)}
                      disabled={loading === ds.id}
                      className={cn(
                        'p-2 rounded-lg transition',
                        ds.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                      )}
                      title={ds.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {loading === ds.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : ds.isActive ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>

                    {/* Refresh token */}
                    {(ds.status === 'EXPIRED' || ds.status === 'ERROR') && (
                      <button
                        onClick={() => handleRefreshToken(ds.id)}
                        disabled={loading === ds.id}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Refrescar token"
                      >
                        {loading === ds.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(ds.id)}
                      disabled={deletingId === ds.id}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Desconectar"
                    >
                      {deletingId === ds.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Optimization Tool Link */}
            <div className="mt-4 p-4 bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-dark">Herramienta de Optimización</h4>
                    <p className="text-sm text-gray-500">
                      Analiza tus campañas con IA y obtén sugerencias de optimización
                    </p>
                  </div>
                </div>
                <Link
                  href={`/projects/${projectSlug}/optimize`}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition text-sm"
                >
                  <Zap className="w-4 h-4" />
                  Abrir herramienta
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Google Analytics Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <GoogleAnalyticsIcon className="w-6 h-6" />
            <div>
              <h3 className="font-semibold text-dark">Google Analytics 4</h3>
              <p className="text-sm text-gray-500">Conecta propiedades GA4 para cruzar datos con campañas</p>
            </div>
          </div>
          <button
            onClick={handleConnectGoogleAnalytics}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Conectar propiedad
          </button>
        </div>

        {analyticsConnections.length === 0 ? (
          <div className="p-6 border border-dashed border-gray-300 rounded-lg text-center">
            <Link2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No hay propiedades de GA4 conectadas</p>
            <p className="text-gray-400 text-xs mt-1">
              Conecta GA4 para enriquecer el análisis con datos de comportamiento web
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {analyticsConnections.map(ds => (
              <div
                key={ds.id}
                className={cn(
                  'p-4 border rounded-lg transition',
                  ds.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <GoogleAnalyticsIcon className="w-8 h-8" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-dark">{ds.accountName}</h4>
                        {getStatusBadge(ds.status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        Property ID: {ds.accountId}
                        {ds.metadata?.currency && ` · ${ds.metadata.currency}`}
                      </p>
                      {ds.lastSyncAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Última sincronización: {formatDate(ds.lastSyncAt)}
                        </p>
                      )}
                      {ds.lastError && (
                        <p className="text-xs text-red-500 mt-1">{ds.lastError}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(ds.id, ds.isActive)}
                      disabled={loading === ds.id}
                      className={cn(
                        'p-2 rounded-lg transition',
                        ds.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                      )}
                      title={ds.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {loading === ds.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : ds.isActive ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>

                    {(ds.status === 'EXPIRED' || ds.status === 'ERROR') && (
                      <button
                        onClick={() => handleRefreshToken(ds.id)}
                        disabled={loading === ds.id}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Refrescar token"
                      >
                        {loading === ds.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(ds.id)}
                      disabled={deletingId === ds.id}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Desconectar"
                    >
                      {deletingId === ds.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google Search Console Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <SearchConsoleIcon className="w-6 h-6" />
            <div>
              <h3 className="font-semibold text-dark">Google Search Console</h3>
              <p className="text-sm text-gray-500">Conecta Search Console para analizar el rendimiento SEO</p>
            </div>
          </div>
          <button
            onClick={handleConnectSearchConsole}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Conectar sitio
          </button>
        </div>

        {searchConsoleConnections.length === 0 ? (
          <div className="p-6 border border-dashed border-gray-300 rounded-lg text-center">
            <Link2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No hay sitios de Search Console conectados</p>
            <p className="text-gray-400 text-xs mt-1">
              Conecta Search Console para analizar consultas de busqueda, posiciones y CTR
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {searchConsoleConnections.map(ds => (
              <div
                key={ds.id}
                className={cn(
                  'p-4 border rounded-lg transition',
                  ds.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <SearchConsoleIcon className="w-8 h-8" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-dark">{ds.accountName}</h4>
                        {getStatusBadge(ds.status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        {ds.accountId}
                        {ds.metadata?.permissionLevel && ` · ${ds.metadata.permissionLevel}`}
                      </p>
                      {ds.lastSyncAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Ultima sincronizacion: {formatDate(ds.lastSyncAt)}
                        </p>
                      )}
                      {ds.lastError && (
                        <p className="text-xs text-red-500 mt-1">{ds.lastError}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(ds.id, ds.isActive)}
                      disabled={loading === ds.id}
                      className={cn(
                        'p-2 rounded-lg transition',
                        ds.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                      )}
                      title={ds.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {loading === ds.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : ds.isActive ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>

                    {(ds.status === 'EXPIRED' || ds.status === 'ERROR') && (
                      <button
                        onClick={() => handleRefreshToken(ds.id)}
                        disabled={loading === ds.id}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Refrescar token"
                      >
                        {loading === ds.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(ds.id)}
                      disabled={deletingId === ds.id}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Desconectar"
                    >
                      {deletingId === ds.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Sobre las conexiones</h4>
            <ul className="mt-2 text-sm text-blue-800 space-y-1">
              <li>• Los tokens se refrescan automaticamente cuando estan proximos a expirar</li>
              <li>• Los datos de acceso estan cifrados con AES-256</li>
              <li>• Puedes desactivar temporalmente una conexion sin perder la configuracion</li>
              <li>• Con Google Ads conectado, tendras acceso a la herramienta de Optimizacion</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
