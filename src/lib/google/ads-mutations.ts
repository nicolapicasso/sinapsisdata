/**
 * Google Ads Mutations
 * Execute optimization actions via Google Ads API
 */

const GOOGLE_ADS_API_VERSION = 'v23'
const GOOGLE_ADS_API_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`

interface MutateResponse {
  results?: Array<{
    resourceName: string
  }>
  partialFailureError?: {
    code: number
    message: string
    details: unknown[]
  }
}

/**
 * Get developer token from environment
 */
function getDeveloperToken(): string {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!token) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not set')
  }
  return token
}

/**
 * Make a mutation request to Google Ads API
 */
async function makeMutateRequest<T>(
  endpoint: string,
  accessToken: string,
  body: object,
  loginCustomerId?: string
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': getDeveloperToken(),
    'Content-Type': 'application/json',
  }

  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId
  }

  const response = await fetch(`${GOOGLE_ADS_API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('[Google Ads Mutate] Error:', JSON.stringify(data, null, 2))
    throw new Error(
      data.error?.message || `Google Ads API error: ${response.status}`
    )
  }

  return data
}

/**
 * Add a negative keyword to a campaign or ad group
 */
export async function addNegativeKeyword(
  accessToken: string,
  customerId: string,
  options: {
    keyword: string
    matchType: 'EXACT' | 'PHRASE' | 'BROAD'
    campaignId?: string
    adGroupId?: string
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { keyword, matchType, campaignId, adGroupId, loginCustomerId } = options

  if (!campaignId && !adGroupId) {
    throw new Error('Either campaignId or adGroupId must be provided')
  }

  // Determine if it's a campaign or ad group level negative
  if (campaignId && !adGroupId) {
    // Campaign-level negative keyword
    const operations = [
      {
        create: {
          campaign: `customers/${customerId}/campaigns/${campaignId}`,
          keyword: {
            text: keyword,
            matchType: matchType,
          },
          negative: true,
        },
      },
    ]

    const response = await makeMutateRequest<MutateResponse>(
      `/customers/${customerId}/campaignCriteria:mutate`,
      accessToken,
      { operations },
      loginCustomerId
    )

    if (response.partialFailureError) {
      throw new Error(response.partialFailureError.message)
    }

    return { resourceName: response.results?.[0]?.resourceName || '' }
  }

  // Ad group-level negative keyword
  const operations = [
    {
      create: {
        adGroup: `customers/${customerId}/adGroups/${adGroupId}`,
        keyword: {
          text: keyword,
          matchType: matchType,
        },
        negative: true,
      },
    },
  ]

  const response = await makeMutateRequest<MutateResponse>(
    `/customers/${customerId}/adGroupCriteria:mutate`,
    accessToken,
    { operations },
    loginCustomerId
  )

  if (response.partialFailureError) {
    throw new Error(response.partialFailureError.message)
  }

  return { resourceName: response.results?.[0]?.resourceName || '' }
}

/**
 * Exclude a placement from a campaign
 */
export async function excludePlacement(
  accessToken: string,
  customerId: string,
  options: {
    placement: string
    campaignId: string
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { placement, campaignId, loginCustomerId } = options

  // Normalize URL - ensure it's just the domain without protocol
  const normalizedPlacement = placement
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase()

  const operations = [
    {
      create: {
        campaign: `customers/${customerId}/campaigns/${campaignId}`,
        placement: {
          url: normalizedPlacement,
        },
        negative: true,
      },
    },
  ]

  const response = await makeMutateRequest<MutateResponse>(
    `/customers/${customerId}/campaignCriteria:mutate`,
    accessToken,
    { operations },
    loginCustomerId
  )

  if (response.partialFailureError) {
    throw new Error(response.partialFailureError.message)
  }

  return { resourceName: response.results?.[0]?.resourceName || '' }
}

/**
 * Update keyword status (pause/enable)
 */
export async function updateKeywordStatus(
  accessToken: string,
  customerId: string,
  options: {
    adGroupId: string
    criterionId: string
    status: 'ENABLED' | 'PAUSED'
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { adGroupId, criterionId, status, loginCustomerId } = options

  const resourceName = `customers/${customerId}/adGroupCriteria/${adGroupId}~${criterionId}`

  const operations = [
    {
      updateMask: 'status',
      update: {
        resourceName,
        status,
      },
    },
  ]

  const response = await makeMutateRequest<MutateResponse>(
    `/customers/${customerId}/adGroupCriteria:mutate`,
    accessToken,
    { operations },
    loginCustomerId
  )

  if (response.partialFailureError) {
    throw new Error(response.partialFailureError.message)
  }

  return { resourceName: response.results?.[0]?.resourceName || resourceName }
}

/**
 * Update keyword bid
 */
export async function updateKeywordBid(
  accessToken: string,
  customerId: string,
  options: {
    adGroupId: string
    criterionId: string
    bidMicros: number
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { adGroupId, criterionId, bidMicros, loginCustomerId } = options

  const resourceName = `customers/${customerId}/adGroupCriteria/${adGroupId}~${criterionId}`

  const operations = [
    {
      updateMask: 'cpc_bid_micros',
      update: {
        resourceName,
        cpcBidMicros: bidMicros.toString(),
      },
    },
  ]

  const response = await makeMutateRequest<MutateResponse>(
    `/customers/${customerId}/adGroupCriteria:mutate`,
    accessToken,
    { operations },
    loginCustomerId
  )

  if (response.partialFailureError) {
    throw new Error(response.partialFailureError.message)
  }

  return { resourceName: response.results?.[0]?.resourceName || resourceName }
}

/**
 * Update campaign status (pause/enable)
 */
export async function updateCampaignStatus(
  accessToken: string,
  customerId: string,
  options: {
    campaignId: string
    status: 'ENABLED' | 'PAUSED'
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { campaignId, status, loginCustomerId } = options

  const resourceName = `customers/${customerId}/campaigns/${campaignId}`

  const operations = [
    {
      updateMask: 'status',
      update: {
        resourceName,
        status,
      },
    },
  ]

  const response = await makeMutateRequest<MutateResponse>(
    `/customers/${customerId}/campaigns:mutate`,
    accessToken,
    { operations },
    loginCustomerId
  )

  if (response.partialFailureError) {
    throw new Error(response.partialFailureError.message)
  }

  return { resourceName: response.results?.[0]?.resourceName || resourceName }
}

/**
 * Update campaign budget
 */
export async function updateCampaignBudget(
  accessToken: string,
  customerId: string,
  options: {
    campaignId: string
    budgetId: string
    amountMicros: number
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { budgetId, amountMicros, loginCustomerId } = options

  const resourceName = `customers/${customerId}/campaignBudgets/${budgetId}`

  const operations = [
    {
      updateMask: 'amount_micros',
      update: {
        resourceName,
        amountMicros: amountMicros.toString(),
      },
    },
  ]

  const response = await makeMutateRequest<MutateResponse>(
    `/customers/${customerId}/campaignBudgets:mutate`,
    accessToken,
    { operations },
    loginCustomerId
  )

  if (response.partialFailureError) {
    throw new Error(response.partialFailureError.message)
  }

  return { resourceName: response.results?.[0]?.resourceName || resourceName }
}

/**
 * Execute an optimization action based on type and payload
 */
export async function executeOptimizationAction(
  accessToken: string,
  customerId: string,
  action: {
    type: string
    payload: Record<string, unknown>
    targetEntity: {
      campaignId?: string
      adGroupId?: string
      keywordId?: string
      budgetId?: string
    }
  },
  loginCustomerId?: string
): Promise<{ success: boolean; resourceName?: string; error?: string }> {
  try {
    let result: { resourceName: string }

    switch (action.type) {
      case 'NEGATIVE_KEYWORD':
        result = await addNegativeKeyword(accessToken, customerId, {
          keyword: action.payload.keyword as string,
          matchType: action.payload.matchType as 'EXACT' | 'PHRASE' | 'BROAD',
          campaignId: action.targetEntity.campaignId,
          adGroupId: action.targetEntity.adGroupId,
          loginCustomerId,
        })
        break

      case 'EXCLUDE_PLACEMENT':
        if (!action.targetEntity.campaignId) {
          throw new Error('Campaign ID required for placement exclusion')
        }
        result = await excludePlacement(accessToken, customerId, {
          placement: action.payload.placement as string,
          campaignId: action.targetEntity.campaignId,
          loginCustomerId,
        })
        break

      case 'PAUSE_KEYWORD':
        if (!action.targetEntity.adGroupId || !action.targetEntity.keywordId) {
          throw new Error('AdGroup ID and Keyword ID required')
        }
        result = await updateKeywordStatus(accessToken, customerId, {
          adGroupId: action.targetEntity.adGroupId,
          criterionId: action.targetEntity.keywordId,
          status: 'PAUSED',
          loginCustomerId,
        })
        break

      case 'ENABLE_KEYWORD':
        if (!action.targetEntity.adGroupId || !action.targetEntity.keywordId) {
          throw new Error('AdGroup ID and Keyword ID required')
        }
        result = await updateKeywordStatus(accessToken, customerId, {
          adGroupId: action.targetEntity.adGroupId,
          criterionId: action.targetEntity.keywordId,
          status: 'ENABLED',
          loginCustomerId,
        })
        break

      case 'UPDATE_KEYWORD_BID':
        if (!action.targetEntity.adGroupId || !action.targetEntity.keywordId) {
          throw new Error('AdGroup ID and Keyword ID required')
        }
        result = await updateKeywordBid(accessToken, customerId, {
          adGroupId: action.targetEntity.adGroupId,
          criterionId: action.targetEntity.keywordId,
          bidMicros: action.payload.bidMicros as number,
          loginCustomerId,
        })
        break

      case 'PAUSE_CAMPAIGN':
        if (!action.targetEntity.campaignId) {
          throw new Error('Campaign ID required')
        }
        result = await updateCampaignStatus(accessToken, customerId, {
          campaignId: action.targetEntity.campaignId,
          status: 'PAUSED',
          loginCustomerId,
        })
        break

      case 'ENABLE_CAMPAIGN':
        if (!action.targetEntity.campaignId) {
          throw new Error('Campaign ID required')
        }
        result = await updateCampaignStatus(accessToken, customerId, {
          campaignId: action.targetEntity.campaignId,
          status: 'ENABLED',
          loginCustomerId,
        })
        break

      case 'UPDATE_CAMPAIGN_BUDGET':
        if (!action.targetEntity.campaignId || !action.targetEntity.budgetId) {
          throw new Error('Campaign ID and Budget ID required')
        }
        if (!action.payload.amountMicros) {
          throw new Error('Budget amount required')
        }
        result = await updateCampaignBudget(accessToken, customerId, {
          campaignId: action.targetEntity.campaignId,
          budgetId: action.targetEntity.budgetId,
          amountMicros: action.payload.amountMicros as number,
          loginCustomerId,
        })
        break

      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }

    return { success: true, resourceName: result.resourceName }
  } catch (error) {
    console.error('[Google Ads] Action execution failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
