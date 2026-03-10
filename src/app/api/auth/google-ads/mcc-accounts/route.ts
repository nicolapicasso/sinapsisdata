import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listMccClientAccounts } from '@/lib/google/ads'
import { decryptTokens } from '@/lib/encryption'

/**
 * POST /api/auth/google-ads/mcc-accounts
 *
 * List client accounts under an MCC (Manager) account.
 * Used in the two-step account selection flow.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { mccCustomerId, encryptedAccessToken, encryptedRefreshToken } = await request.json()

    if (!mccCustomerId || !encryptedAccessToken || !encryptedRefreshToken) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    // Decrypt the access token
    const { accessToken } = decryptTokens({
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
    })

    // List client accounts under the MCC
    console.log(`[Google Ads MCC] Listing clients for MCC ${mccCustomerId}...`)
    const clientAccounts = await listMccClientAccounts(accessToken, mccCustomerId)

    // Filter out manager accounts (we only want client accounts)
    const clients = clientAccounts
      .filter(c => !c.manager)
      .map(c => ({
        customerId: c.id,
        name: c.descriptiveName || `Account ${c.id}`,
        currency: c.currencyCode,
        timezone: c.timeZone,
        isManager: false,
      }))

    console.log(`[Google Ads MCC] Found ${clients.length} client accounts`)

    return NextResponse.json({ clients })
  } catch (error) {
    console.error('[Google Ads MCC] Error:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
