'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react'
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

interface AccountData {
  projectId: string
  projectSlug: string
  accessToken: string
  refreshToken: string
  tokenExpiry: number
  accounts?: GoogleAdsAccount[]
  properties?: GA4Property[]
}

export default function SelectAccountPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const type = searchParams.get('type') as 'google_ads' | 'google_analytics' | null
  const dataParam = searchParams.get('data')

  const [data, setData] = useState<AccountData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (dataParam) {
      try {
        const decoded = JSON.parse(Buffer.from(dataParam, 'base64url').toString())
        setData(decoded)
      } catch {
        setError('Datos de cuenta inválidos')
      }
    }
  }, [dataParam])

  const handleSave = async () => {
    if (!data || !selectedId || !type) return

    setSaving(true)
    setError(null)

    try {
      const selectedAccount = type === 'google_ads'
        ? data.accounts?.find(a => a.customerId === selectedId)
        : data.properties?.find(p => p.propertyId === selectedId)

      if (!selectedAccount) {
        throw new Error('Cuenta seleccionada no encontrada')
      }

      const payload = type === 'google_ads'
        ? {
            projectId: data.projectId,
            type: 'GOOGLE_ADS',
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            tokenExpiry: data.tokenExpiry,
            accountId: (selectedAccount as GoogleAdsAccount).customerId,
            accountName: (selectedAccount as GoogleAdsAccount).name,
            mccId: (selectedAccount as GoogleAdsAccount).isManager
              ? (selectedAccount as GoogleAdsAccount).customerId
              : null,
            metadata: {
              currency: (selectedAccount as GoogleAdsAccount).currency,
              timezone: (selectedAccount as GoogleAdsAccount).timezone,
              isManager: (selectedAccount as GoogleAdsAccount).isManager,
            },
          }
        : {
            projectId: data.projectId,
            type: 'GOOGLE_ANALYTICS',
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            tokenExpiry: data.tokenExpiry,
            accountId: (selectedAccount as GA4Property).propertyId,
            accountName: (selectedAccount as GA4Property).name,
            metadata: {
              propertyName: (selectedAccount as GA4Property).propertyName,
              currency: (selectedAccount as GA4Property).currency,
              timezone: (selectedAccount as GA4Property).timezone,
            },
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

  const items = type === 'google_ads' ? data.accounts : data.properties
  const isGoogleAds = type === 'google_ads'

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
        <h1 className="text-xl font-bold text-dark mb-2">
          Selecciona {isGoogleAds ? 'una cuenta de Google Ads' : 'una propiedad GA4'}
        </h1>
        <p className="text-gray-600 mb-6">
          Se encontraron múltiples {isGoogleAds ? 'cuentas' : 'propiedades'}. Selecciona la que deseas conectar.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {items?.map((item) => {
            const id = isGoogleAds
              ? (item as GoogleAdsAccount).customerId
              : (item as GA4Property).propertyId
            const name = item.name
            const isManager = isGoogleAds && (item as GoogleAdsAccount).isManager

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
                      {isManager && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          MCC
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {isGoogleAds ? 'ID: ' : 'Property ID: '}
                      {id}
                      {item.currency && ` · ${item.currency}`}
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

        <div className="flex justify-end gap-3">
          <Link
            href={`/projects/${data.projectSlug}?tab=connections`}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancelar
          </Link>
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
