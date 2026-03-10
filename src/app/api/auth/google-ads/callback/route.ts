import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exchangeCodeForTokens, calculateTokenExpiry } from '@/lib/google/oauth'
import { listAccessibleAccounts } from '@/lib/google/ads'
import { encryptTokens } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/google-ads/callback
 *
 * OAuth callback after Google authorization.
 * Receives the code, exchanges for tokens, lists accounts,
 * and redirects to account selection page.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return redirectWithError('No autenticado')
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('[Google Ads Callback] OAuth error:', error)
      return redirectWithError(`Error de Google: ${error}`)
    }

    if (!code || !state) {
      return redirectWithError('Faltan parámetros de OAuth')
    }

    // Decode state
    let stateData: { projectId: string; userId: string; timestamp: number }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    } catch {
      return redirectWithError('Estado de OAuth inválido')
    }

    // Verify timestamp (max 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return redirectWithError('La sesión de OAuth ha expirado')
    }

    // Verify user matches
    if (stateData.userId !== session.user.id) {
      return redirectWithError('Usuario no coincide')
    }

    // Get project to redirect back
    const project = await prisma.project.findUnique({
      where: { id: stateData.projectId },
      select: { slug: true },
    })

    if (!project) {
      return redirectWithError('Proyecto no encontrado')
    }

    // Exchange code for tokens
    console.log('[Google Ads Callback] Exchanging code for tokens...')
    const tokens = await exchangeCodeForTokens('google_ads', code)

    if (!tokens.refresh_token) {
      return redirectWithError(
        'Google no devolvió refresh token. Revoca el acceso en tu cuenta de Google e inténtalo de nuevo.',
        project.slug
      )
    }

    // List accessible accounts
    console.log('[Google Ads Callback] Listing accessible accounts...')
    const accounts = await listAccessibleAccounts(tokens.access_token)

    if (accounts.length === 0) {
      return redirectWithError(
        'No se encontraron cuentas de Google Ads accesibles',
        project.slug
      )
    }

    // Encrypt tokens
    const encrypted = encryptTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    })

    // Store tokens temporarily in session or use a temp table
    // For simplicity, we'll store all accessible accounts and let user pick
    // In production, you might want to use a more secure temp storage

    // If only one account, connect it directly
    if (accounts.length === 1) {
      const account = accounts[0]

      await prisma.dataSource.create({
        data: {
          projectId: stateData.projectId,
          type: 'GOOGLE_ADS',
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiry: calculateTokenExpiry(tokens.expires_in),
          accountId: account.customerId,
          accountName: account.descriptiveName,
          mccId: account.manager ? account.customerId : null,
          metadata: {
            currency: account.currencyCode,
            timezone: account.timeZone,
            isManager: account.manager,
          },
          status: 'CONNECTED',
          isActive: true,
        },
      })

      console.log(`[Google Ads Callback] Connected account ${account.customerId}`)

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      return NextResponse.redirect(
        new URL(
          `/projects/${project.slug}?tab=connections&success=google_ads_connected`,
          baseUrl
        )
      )
    }

    // Multiple accounts - redirect to selection page with encoded data
    const accountsData = Buffer.from(
      JSON.stringify({
        projectId: stateData.projectId,
        projectSlug: project.slug,
        accessToken: encrypted.accessToken,
        refreshToken: encrypted.refreshToken,
        tokenExpiry: tokens.expires_in,
        accounts: accounts.map(a => ({
          customerId: a.customerId,
          name: a.descriptiveName,
          currency: a.currencyCode,
          timezone: a.timeZone,
          isManager: a.manager,
        })),
      })
    ).toString('base64url')

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      new URL(
        `/projects/${project.slug}/connections/select-account?type=google_ads&data=${accountsData}`,
        baseUrl
      )
    )
  } catch (error) {
    console.error('[Google Ads Callback] Error:', error)
    const errorMessage = error instanceof Error
      ? `${error.message}${error.stack ? ` | Stack: ${error.stack.split('\n')[1]?.trim()}` : ''}`
      : 'Error desconocido'
    return redirectWithError(errorMessage)
  }
}

function redirectWithError(message: string, projectSlug?: string) {
  const encodedMessage = encodeURIComponent(message)
  const path = projectSlug
    ? `/projects/${projectSlug}?tab=connections&error=${encodedMessage}`
    : `/projects?error=${encodedMessage}`

  return NextResponse.redirect(new URL(path, process.env.NEXTAUTH_URL || 'http://localhost:3000'))
}
