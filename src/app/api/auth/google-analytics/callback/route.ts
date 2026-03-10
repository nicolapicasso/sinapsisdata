import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exchangeCodeForTokens, calculateTokenExpiry } from '@/lib/google/oauth'
import { listProperties } from '@/lib/google/analytics'
import { encryptTokens } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/google-analytics/callback
 *
 * OAuth callback after Google authorization.
 * Receives the code, exchanges for tokens, lists GA4 properties,
 * and redirects to property selection page.
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
      console.error('[Google Analytics Callback] OAuth error:', error)
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
    console.log('[Google Analytics Callback] Exchanging code for tokens...')
    const tokens = await exchangeCodeForTokens('google_analytics', code)

    if (!tokens.refresh_token) {
      return redirectWithError(
        'Google no devolvió refresh token. Revoca el acceso en tu cuenta de Google e inténtalo de nuevo.',
        project.slug
      )
    }

    // List accessible GA4 properties
    console.log('[Google Analytics Callback] Listing accessible properties...')
    const properties = await listProperties(tokens.access_token)

    if (properties.length === 0) {
      return redirectWithError(
        'No se encontraron propiedades de GA4 accesibles',
        project.slug
      )
    }

    // Encrypt tokens
    const encrypted = encryptTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    })

    // If only one property, connect it directly
    if (properties.length === 1) {
      const property = properties[0]

      await prisma.dataSource.create({
        data: {
          projectId: stateData.projectId,
          type: 'GOOGLE_ANALYTICS',
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiry: calculateTokenExpiry(tokens.expires_in),
          accountId: property.propertyId,
          accountName: property.displayName,
          mccId: null,
          metadata: {
            propertyName: property.name,
            currency: property.currencyCode,
            timezone: property.timeZone,
            industryCategory: property.industryCategory,
          },
          status: 'CONNECTED',
          isActive: true,
        },
      })

      console.log(`[Google Analytics Callback] Connected property ${property.propertyId}`)

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      return NextResponse.redirect(
        new URL(
          `/projects/${project.slug}?tab=connections&success=google_analytics_connected`,
          baseUrl
        )
      )
    }

    // Multiple properties - redirect to selection page with encoded data
    const propertiesData = Buffer.from(
      JSON.stringify({
        projectId: stateData.projectId,
        projectSlug: project.slug,
        accessToken: encrypted.accessToken,
        refreshToken: encrypted.refreshToken,
        tokenExpiry: tokens.expires_in,
        properties: properties.map(p => ({
          propertyId: p.propertyId,
          name: p.displayName,
          propertyName: p.name,
          currency: p.currencyCode,
          timezone: p.timeZone,
        })),
      })
    ).toString('base64url')

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      new URL(
        `/projects/${project.slug}/connections/select-account?type=google_analytics&data=${propertiesData}`,
        baseUrl
      )
    )
  } catch (error) {
    console.error('[Google Analytics Callback] Error:', error)
    return redirectWithError(
      error instanceof Error ? error.message : 'Error desconocido'
    )
  }
}

function redirectWithError(message: string, projectSlug?: string) {
  const encodedMessage = encodeURIComponent(message)
  const path = projectSlug
    ? `/projects/${projectSlug}?tab=connections&error=${encodedMessage}`
    : `/projects?error=${encodedMessage}`

  return NextResponse.redirect(new URL(path, process.env.NEXTAUTH_URL || 'http://localhost:3000'))
}
