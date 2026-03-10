/**
 * Google Search Console API utilities
 * Using Search Console API for search analytics data
 */

const SEARCH_CONSOLE_API_URL = 'https://www.googleapis.com/webmasters/v3'

export interface SearchConsoleSite {
  siteUrl: string
  permissionLevel: string
}

/**
 * Make a request to Google Search Console API
 */
async function makeRequest<T>(
  url: string,
  accessToken: string,
  options: {
    method?: string
    body?: object
  } = {}
): Promise<T> {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[Search Console API] Error:', error)
    throw new Error(`Search Console API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * List all sites accessible to the user
 */
export async function listSites(accessToken: string): Promise<SearchConsoleSite[]> {
  interface SitesResponse {
    siteEntry?: SearchConsoleSite[]
  }

  const response = await makeRequest<SitesResponse>(
    `${SEARCH_CONSOLE_API_URL}/sites`,
    accessToken
  )

  return response.siteEntry || []
}

/**
 * Get details for a specific site
 */
export async function getSite(
  accessToken: string,
  siteUrl: string
): Promise<SearchConsoleSite> {
  const encodedUrl = encodeURIComponent(siteUrl)
  return makeRequest<SearchConsoleSite>(
    `${SEARCH_CONSOLE_API_URL}/sites/${encodedUrl}`,
    accessToken
  )
}

/**
 * Validate access to a site
 */
export async function validateSiteAccess(
  accessToken: string,
  siteUrl: string
): Promise<boolean> {
  try {
    await getSite(accessToken, siteUrl)
    return true
  } catch {
    return false
  }
}

export interface SearchAnalyticsRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchAnalyticsResponse {
  rows?: SearchAnalyticsRow[]
  responseAggregationType?: string
}

/**
 * Query search analytics data
 */
export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  options: {
    startDate: string
    endDate: string
    dimensions: ('query' | 'page' | 'country' | 'device' | 'date')[]
    rowLimit?: number
    startRow?: number
    dimensionFilterGroups?: Array<{
      groupType?: 'AND' | 'OR'
      filters: Array<{
        dimension: string
        operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS'
        expression: string
      }>
    }>
  }
): Promise<SearchAnalyticsResponse> {
  const encodedUrl = encodeURIComponent(siteUrl)

  return makeRequest<SearchAnalyticsResponse>(
    `${SEARCH_CONSOLE_API_URL}/sites/${encodedUrl}/searchAnalytics/query`,
    accessToken,
    {
      method: 'POST',
      body: {
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: options.dimensions,
        rowLimit: options.rowLimit || 1000,
        startRow: options.startRow || 0,
        dimensionFilterGroups: options.dimensionFilterGroups,
      },
    }
  )
}

/**
 * Run a test query to validate data access
 */
export async function runTestQuery(
  accessToken: string,
  siteUrl: string
): Promise<boolean> {
  try {
    await querySearchAnalytics(accessToken, siteUrl, {
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      dimensions: ['date'],
      rowLimit: 1,
    })
    return true
  } catch {
    return false
  }
}
