/**
 * Google Ads API utilities
 * Using REST API directly instead of the npm package for more control
 */

const GOOGLE_ADS_API_VERSION = 'v23'
const GOOGLE_ADS_API_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`

interface GoogleAdsAccount {
  customerId: string
  descriptiveName: string
  currencyCode: string
  timeZone: string
  manager: boolean
}

interface CustomerClient {
  clientCustomer: string
  level: string
  manager: boolean
  descriptiveName: string
  currencyCode: string
  timeZone: string
  id: string
}

/**
 * Get the developer token from environment
 */
function getDeveloperToken(): string {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!token) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN environment variable is not set')
  }
  return token
}

/**
 * Make a request to the Google Ads API
 */
async function makeRequest<T>(
  endpoint: string,
  accessToken: string,
  options: {
    method?: string
    body?: object
    loginCustomerId?: string
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': getDeveloperToken(),
    'Content-Type': 'application/json',
  }

  if (options.loginCustomerId) {
    headers['login-customer-id'] = options.loginCustomerId
  }

  const response = await fetch(`${GOOGLE_ADS_API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[Google Ads API] Error:', error)
    throw new Error(`Google Ads API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * List all accessible Google Ads accounts for the authenticated user.
 * This uses the listAccessibleCustomers endpoint which returns all accounts
 * the user has access to, including MCC accounts.
 */
export async function listAccessibleAccounts(
  accessToken: string
): Promise<GoogleAdsAccount[]> {
  interface ListCustomersResponse {
    resourceNames: string[]
  }

  // First, get all accessible customer IDs
  const response = await makeRequest<ListCustomersResponse>(
    '/customers:listAccessibleCustomers',
    accessToken
  )

  if (!response.resourceNames || response.resourceNames.length === 0) {
    return []
  }

  // Fetch details for each customer
  const accounts: GoogleAdsAccount[] = []

  for (const resourceName of response.resourceNames) {
    const customerId = resourceName.replace('customers/', '')

    try {
      // Query customer details
      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.manager
        FROM customer
        LIMIT 1
      `

      interface SearchResponse {
        results: Array<{
          customer: {
            id: string
            descriptiveName: string
            currencyCode: string
            timeZone: string
            manager: boolean
          }
        }>
      }

      const searchResponse = await makeRequest<SearchResponse>(
        `/customers/${customerId}/googleAds:search`,
        accessToken,
        {
          method: 'POST',
          body: { query },
          loginCustomerId: customerId,
        }
      )

      if (searchResponse.results && searchResponse.results.length > 0) {
        const customer = searchResponse.results[0].customer
        accounts.push({
          customerId: customer.id,
          descriptiveName: customer.descriptiveName || `Account ${customer.id}`,
          currencyCode: customer.currencyCode || 'USD',
          timeZone: customer.timeZone || 'America/New_York',
          manager: customer.manager || false,
        })
      }
    } catch (error) {
      // If we can't access this account, skip it
      console.warn(`[Google Ads] Could not fetch details for ${customerId}:`, error)
    }
  }

  return accounts
}

/**
 * List all client accounts under an MCC (Manager) account.
 */
export async function listMccClientAccounts(
  accessToken: string,
  mccCustomerId: string
): Promise<CustomerClient[]> {
  const query = `
    SELECT
      customer_client.client_customer,
      customer_client.level,
      customer_client.manager,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.id
    FROM customer_client
    WHERE customer_client.level <= 1
  `

  interface SearchResponse {
    results: Array<{
      customerClient: CustomerClient
    }>
  }

  const response = await makeRequest<SearchResponse>(
    `/customers/${mccCustomerId}/googleAds:search`,
    accessToken,
    {
      method: 'POST',
      body: { query },
      loginCustomerId: mccCustomerId,
    }
  )

  if (!response.results) {
    return []
  }

  return response.results.map(r => r.customerClient)
}

/**
 * Validate that we can access a specific Google Ads account
 */
export async function validateAccountAccess(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string
): Promise<boolean> {
  try {
    const query = `SELECT customer.id FROM customer LIMIT 1`

    await makeRequest(
      `/customers/${customerId}/googleAds:search`,
      accessToken,
      {
        method: 'POST',
        body: { query },
        loginCustomerId: loginCustomerId || customerId,
      }
    )

    return true
  } catch {
    return false
  }
}

/**
 * Execute a GAQL query against a Google Ads account
 */
export async function executeGaqlQuery<T>(
  accessToken: string,
  customerId: string,
  query: string,
  loginCustomerId?: string
): Promise<T[]> {
  interface SearchResponse {
    results?: T[]
  }

  const response = await makeRequest<SearchResponse>(
    `/customers/${customerId}/googleAds:search`,
    accessToken,
    {
      method: 'POST',
      body: { query },
      loginCustomerId: loginCustomerId || customerId,
    }
  )

  return response.results || []
}
