/**
 * Google OAuth2 utilities for Google Ads and Google Analytics
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export type GoogleService = 'google_ads' | 'google_analytics' | 'google_search_console'

interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

/**
 * Get OAuth configuration for a specific Google service
 */
export function getOAuthConfig(service: GoogleService): OAuthConfig {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  if (service === 'google_ads') {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Google Ads OAuth credentials not configured')
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}/api/auth/google-ads/callback`,
      scopes: ['https://www.googleapis.com/auth/adwords'],
    }
  }

  if (service === 'google_analytics') {
    const clientId = process.env.GOOGLE_ANALYTICS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ANALYTICS_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Google Analytics OAuth credentials not configured')
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}/api/auth/google-analytics/callback`,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    }
  }

  if (service === 'google_search_console') {
    // Search Console uses the same credentials as Analytics
    const clientId = process.env.GOOGLE_ANALYTICS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ANALYTICS_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Google Search Console OAuth credentials not configured')
    }

    return {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}/api/auth/google-search-console/callback`,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    }
  }

  throw new Error(`Unknown service: ${service}`)
}

/**
 * Generate the OAuth2 authorization URL
 */
export function getAuthorizationUrl(
  service: GoogleService,
  state: string
): string {
  const config = getOAuthConfig(service)

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  service: GoogleService,
  code: string
): Promise<TokenResponse> {
  const config = getOAuthConfig(service)

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  return response.json()
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  service: GoogleService,
  refreshToken: string
): Promise<TokenResponse> {
  const config = getOAuthConfig(service)

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  return response.json()
}

/**
 * Calculate token expiry date from expires_in seconds
 */
export function calculateTokenExpiry(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000)
}

/**
 * Check if token is expired (with 5 minute buffer)
 */
export function isTokenExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) return true
  const bufferMs = 5 * 60 * 1000 // 5 minutes
  return new Date() >= new Date(expiryDate.getTime() - bufferMs)
}
