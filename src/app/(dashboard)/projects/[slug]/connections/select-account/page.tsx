'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GoogleAdsAccount {
  customerId: string
  name: string
  currency: string
  timezone: string
  isManager: boolean
}

interface GA4Property {
  propertyId: string
  name: string
  propertyName: string
  currency: string
  timezone: string
}

interface SearchConsoleSite {
  siteUrl: string
  name: string
  permissionLevel: string
}

interface AccountData {
  projectId: string
  projectSlug: string
  accessToken: string
  refreshToken: string
  tokenExpiry: number
  accounts?: GoogleAdsAccount[]
  properties?: GA4Property[]
  sites?: SearchConsoleSite[]
}

export default function SelectAccountPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const type = searchParams.get('type') as 'google_ads' | 'google_analytics' | 'google_search_console' | null
  const dataParam = searchParams.get('data')

  const [data, setData] = useState<AccountData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // MCC flow state
  const [selectedMcc, setSelectedMcc] = useState<GoogleAdsAccount | null>(null)
  const [clientAccounts, setClientAccounts] = useState<GoogleAdsAccount[] | null>(null)
  const [loadingClients, setLoadingClients] = useState(false)

  useEffect(() => {
    if (dataParam) {
      try {
        // Convert base64url to standard base64
        const base64 = dataParam.replace(/-/g, '+').replace(/_/g, '/')
        // Decode base64 and parse JSON
        const decoded = JSON.parse(atob(base64))
        setData(decoded)
      } catch {
        setError('Datos de cuenta inválidos')
      }
    }
  }, [dataParam])

  // Handle MCC selection - load client accounts
  const handleMccSelect = async (mcc: GoogleAdsAccount) => {
    setSelectedMcc(mcc)
    setSelectedId(null)
    setClientAccounts(null)
    setLoadingClients(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/google-ads/mcc-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mccCustomerId: mcc.customerId,
          encryptedAccessToken: data?.accessToken,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error al cargar cuentas cliente')
      }

      const { clients } = await res.json()
      setClientAccounts(clients)

      if (clients.length === 0) {
        setError('Este MCC no tiene cuentas cliente accesibles')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cuentas cliente')
      setSelectedMcc(null)
    } finally {
      setLoadingClients(false)
    }
  }

  // Go back to MCC selection
  const handleBackToMcc = () => {
    setSelectedMcc(null)
    setClientAccounts(null)
    setSelectedId(null)
    setError(null)
  }

  const handleSave = async () => {
    if (!data || !selectedId || !type) return

    setSaving(true)
    setError(null)

    try {
      let selectedAccount
      let payload

      if (type === 'google_ads') {
        // If we selected from MCC clients, use that
        if (clientAccounts) {
          selectedAccount = clientAccounts.find(a => a.customerId === selectedId)
        } else {
          selectedAccount = data.accounts?.find(a => a.customerId === selectedId)
        }

        if (!selectedAccount) {
          throw new Error('Cuenta seleccionada no encontrada')
        }

        const acc = selectedAccount as GoogleAdsAccount
        payload = {
          projectId: data.projectId,
          type: 'GOOGLE_ADS',
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tokenExpiry: data.tokenExpiry,
          accountId: acc.customerId,
          accountName: acc.name,
          // If selected from MCC flow, include MCC ID
          mccId: selectedMcc ? selectedMcc.customerId : (acc.isManager ? acc.customerId : null),
          metadata: {
            currency: acc.currency,
            timezone: acc.timezone,
            isManager: acc.isManager,
            parentMcc: selectedMcc ? {
              customerId: selectedMcc.customerId,
              name: selectedMcc.name,
            } : null,
          },
        }
      } else if (type === 'google_analytics') {
        selectedAccount = data.properties?.find(p => p.propertyId === selectedId)
        if (!selectedAccount) {
          throw new Error('Cuenta seleccionada no encontrada')
        }
        const prop = selectedAccount as GA4Property
        payload = {
          projectId: data.projectId,
          type: 'GOOGLE_ANALYTICS',
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tokenExpiry: data.tokenExpiry,
          accountId: prop.propertyId,
          accountName: prop.name,
          metadata: {
            propertyName: prop.propertyName,
            currency: prop.currency,
            timezone: prop.timezone,
          },
        }
      } else {
        selectedAccount = data.sites?.find(s => s.siteUrl === selectedId)
        if (!selectedAccount) {
          throw new Error('Cuenta seleccionada no encontrada')
        }
        const site = selectedAccount as SearchConsoleSite
        payload = {
          projectId: data.projectId,
          type: 'GOOGLE_SEARCH_CONSOLE',
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tokenExpiry: data.tokenExpiry,
          accountId: site.siteUrl,
          accountName: site.name,
          metadata: {
            permissionLevel: site.permissionLevel,
          },
        }
      }

      const res = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error al guardar la conexión')
      }

      // Redirect back to project with success message
      router.push(`/projects/${data.projectSlug}?tab=connections&success=${type}_connected`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  if (!type || !dataParam) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h1 className="text-xl font-bold text-dark mb-2">Error</h1>
          <p className="text-gray-600">Parámetros de conexión inválidos</p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 mt-4 text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a proyectos
          </Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        <p className="mt-4 text-gray-600">Cargando cuentas...</p>
      </div>
    )
  }

  const isGoogleAds = type === 'google_ads'
  const isSearchConsole = type === 'google_search_console'

  // For Google Ads with MCC selected, show client accounts
  const showingClientAccounts = isGoogleAds && selectedMcc && clientAccounts

  // Determine which items to show
  let items: (GoogleAdsAccount | GA4Property | SearchConsoleSite)[] | undefined
  if (showingClientAccounts) {
    items = clientAccounts
  } else if (isGoogleAds) {
    items = data.accounts
  } else if (type === 'google_analytics') {
    items = data.properties
  } else {
    items = data.sites
  }

  // Check if we have any MCC accounts (for Google Ads)
  const hasMccAccounts = isGoogleAds && data.accounts?.some(a => a.isManager)

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link
        href={`/projects/${data.projectSlug}?tab=connections`}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-dark mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al proyecto
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Breadcrumb for MCC flow */}
        {selectedMcc && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <button
              onClick={handleBackToMcc}
              className="hover:text-primary hover:underline"
            >
              Cuentas MCC
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-dark font-medium">{selectedMcc.name}</span>
          </div>
        )}

        <h1 className="text-xl font-bold text-dark mb-2">
          {showingClientAccounts
            ? 'Selecciona una cuenta cliente'
            : isGoogleAds
              ? hasMccAccounts
                ? 'Selecciona una cuenta MCC o cuenta directa'
                : 'Selecciona una cuenta de Google Ads'
              : isSearchConsole
                ? 'Selecciona un sitio de Search Console'
                : 'Selecciona una propiedad GA4'}
        </h1>
        <p className="text-gray-600 mb-6">
          {showingClientAccounts
            ? `Cuentas cliente bajo ${selectedMcc?.name}`
            : hasMccAccounts
              ? 'Selecciona un MCC para ver sus cuentas cliente, o elige una cuenta directa.'
              : `Se encontraron múltiples ${isGoogleAds ? 'cuentas' : isSearchConsole ? 'sitios' : 'propiedades'}. Selecciona la que deseas conectar.`}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Loading state for client accounts */}
        {loadingClients && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="mt-4 text-gray-600">Cargando cuentas cliente...</p>
          </div>
        )}

        {/* Account list */}
        {!loadingClients && (
          <div className="space-y-3 mb-6">
            {items?.map((item) => {
              const id = isGoogleAds
                ? (item as GoogleAdsAccount).customerId
                : isSearchConsole
                  ? (item as SearchConsoleSite).siteUrl
                  : (item as GA4Property).propertyId
              const name = item.name
              const isManager = isGoogleAds && (item as GoogleAdsAccount).isManager

              // For MCC accounts in first step, show different behavior
              if (isManager && !showingClientAccounts) {
                return (
                  <button
                    key={id}
                    onClick={() => handleMccSelect(item as GoogleAdsAccount)}
                    className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-dark">{name}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            MCC
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          ID: {id}
                          {(item as GoogleAdsAccount).currency && ` · ${(item as GoogleAdsAccount).currency}`}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition" />
                    </div>
                  </button>
                )
              }

              // Regular account selection
              return (
                <button
                  key={id}
                  onClick={() => setSelectedId(id)}
                  className={cn(
                    'w-full p-4 text-left border rounded-lg transition',
                    selectedId === id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-dark">{name}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {isGoogleAds ? 'ID: ' : isSearchConsole ? '' : 'Property ID: '}
                        {id}
                        {!isSearchConsole && (item as GoogleAdsAccount | GA4Property).currency && ` · ${(item as GoogleAdsAccount | GA4Property).currency}`}
                      </p>
                    </div>
                    {selectedId === id && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex justify-end gap-3">
          {selectedMcc ? (
            <button
              onClick={handleBackToMcc}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Volver a MCCs
            </button>
          ) : (
            <Link
              href={`/projects/${data.projectSlug}?tab=connections`}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancelar
            </Link>
          )}
          <button
            onClick={handleSave}
            disabled={!selectedId || saving}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Conectar
          </button>
        </div>
      </div>
    </div>
  )
}
