/**
 * Google Analytics 4 API utilities
 * Using Google Analytics Admin API and Data API
 */

const GA_ADMIN_API_URL = 'https://analyticsadmin.googleapis.com/v1beta'
const GA_DATA_API_URL = 'https://analyticsdata.googleapis.com/v1beta'

export interface GA4Property {
  name: string // Format: properties/123456789
  propertyId: string
  displayName: string
  timeZone: string
  currencyCode: string
  industryCategory?: string
  propertyType?: string
  parent?: string // Format: accounts/123456789
}

export interface GA4Account {
  name: string // Format: accounts/123456789
  displayName: string
  regionCode?: string
}

/**
 * Make a request to Google Analytics API
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
    console.error('[GA4 API] Error:', error)
    throw new Error(`Google Analytics API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * List all GA4 accounts accessible to the user
 */
export async function listAccounts(accessToken: string): Promise<GA4Account[]> {
  interface AccountsResponse {
    accounts?: GA4Account[]
    nextPageToken?: string
  }

  const accounts: GA4Account[] = []
  let pageToken: string | undefined

  do {
    const url = pageToken
      ? `${GA_ADMIN_API_URL}/accounts?pageToken=${pageToken}`
      : `${GA_ADMIN_API_URL}/accounts`

    const response = await makeRequest<AccountsResponse>(url, accessToken)

    if (response.accounts) {
      accounts.push(...response.accounts)
    }

    pageToken = response.nextPageToken
  } while (pageToken)

  return accounts
}

/**
 * List all GA4 properties accessible to the user
 * Uses accountSummaries endpoint which doesn't require a filter
 */
export async function listProperties(accessToken: string): Promise<GA4Property[]> {
  interface AccountSummariesResponse {
    accountSummaries?: Array<{
      name: string // accounts/123
      account: string // accounts/123
      displayName: string
      propertySummaries?: Array<{
        property: string // properties/456
        displayName: string
        propertyType?: string
        parent?: string
      }>
    }>
    nextPageToken?: string
  }

  const properties: GA4Property[] = []
  let pageToken: string | undefined

  do {
    const url = pageToken
      ? `${GA_ADMIN_API_URL}/accountSummaries?pageToken=${pageToken}`
      : `${GA_ADMIN_API_URL}/accountSummaries`

    const response = await makeRequest<AccountSummariesResponse>(url, accessToken)

    if (response.accountSummaries) {
      for (const account of response.accountSummaries) {
        if (account.propertySummaries) {
          for (const prop of account.propertySummaries) {
            const propertyId = prop.property.replace('properties/', '')
            properties.push({
              name: prop.property,
              propertyId,
              displayName: prop.displayName,
              timeZone: 'UTC', // Will be fetched when needed
              currencyCode: 'USD', // Will be fetched when needed
              propertyType: prop.propertyType,
              parent: account.name,
            })
          }
        }
      }
    }

    pageToken = response.nextPageToken
  } while (pageToken)

  return properties
}

/**
 * Get details for a specific GA4 property
 */
export async function getProperty(
  accessToken: string,
  propertyId: string
): Promise<GA4Property> {
  const response = await makeRequest<{
    name: string
    displayName: string
    timeZone: string
    currencyCode: string
    industryCategory?: string
    propertyType?: string
    parent?: string
  }>(`${GA_ADMIN_API_URL}/properties/${propertyId}`, accessToken)

  return {
    ...response,
    propertyId,
  }
}

/**
 * Validate that we can access a specific GA4 property
 */
export async function validatePropertyAccess(
  accessToken: string,
  propertyId: string
): Promise<boolean> {
  try {
    await getProperty(accessToken, propertyId)
    return true
  } catch {
    return false
  }
}

/**
 * Run a simple report to validate data access
 */
export async function runTestReport(
  accessToken: string,
  propertyId: string
): Promise<boolean> {
  try {
    interface ReportResponse {
      rows?: Array<{
        dimensionValues: Array<{ value: string }>
        metricValues: Array<{ value: string }>
      }>
    }

    await makeRequest<ReportResponse>(
      `${GA_DATA_API_URL}/properties/${propertyId}:runReport`,
      accessToken,
      {
        method: 'POST',
        body: {
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }],
          limit: 1,
        },
      }
    )

    return true
  } catch {
    return false
  }
}

/**
 * Run a report for a GA4 property
 */
export async function runReport(
  accessToken: string,
  propertyId: string,
  options: {
    startDate: string
    endDate: string
    dimensions: string[]
    metrics: string[]
    limit?: number
  }
): Promise<{
  rows: Array<{
    dimensions: Record<string, string>
    metrics: Record<string, string | number>
  }>
}> {
  interface ReportResponse {
    dimensionHeaders?: Array<{ name: string }>
    metricHeaders?: Array<{ name: string; type: string }>
    rows?: Array<{
      dimensionValues: Array<{ value: string }>
      metricValues: Array<{ value: string }>
    }>
  }

  const response = await makeRequest<ReportResponse>(
    `${GA_DATA_API_URL}/properties/${propertyId}:runReport`,
    accessToken,
    {
      method: 'POST',
      body: {
        dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
        dimensions: options.dimensions.map(name => ({ name })),
        metrics: options.metrics.map(name => ({ name })),
        limit: options.limit || 10000,
      },
    }
  )

  if (!response.rows || !response.dimensionHeaders || !response.metricHeaders) {
    return { rows: [] }
  }

  const rows = response.rows.map(row => {
    const dimensions: Record<string, string> = {}
    const metrics: Record<string, string | number> = {}

    response.dimensionHeaders!.forEach((header, i) => {
      dimensions[header.name] = row.dimensionValues[i].value
    })

    response.metricHeaders!.forEach((header, i) => {
      const value = row.metricValues[i].value
      // Convert numeric strings to numbers
      metrics[header.name] =
        header.type === 'TYPE_INTEGER' || header.type === 'TYPE_FLOAT'
          ? parseFloat(value)
          : value
    })

    return { dimensions, metrics }
  })

  return { rows }
}
