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
 * Update ad group status (pause/enable)
 */
export async function updateAdGroupStatus(
  accessToken: string,
  customerId: string,
  options: {
    adGroupId: string
    status: 'ENABLED' | 'PAUSED'
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { adGroupId, status, loginCustomerId } = options

  const resourceName = `customers/${customerId}/adGroups/${adGroupId}`

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
    `/customers/${customerId}/adGroups:mutate`,
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
 * Update ad group default CPC bid
 */
export async function updateAdGroupBid(
  accessToken: string,
  customerId: string,
  options: {
    adGroupId: string
    bidMicros: number
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { adGroupId, bidMicros, loginCustomerId } = options

  const resourceName = `customers/${customerId}/adGroups/${adGroupId}`

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
    `/customers/${customerId}/adGroups:mutate`,
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
 * Update ad status (pause/enable)
 */
export async function updateAdStatus(
  accessToken: string,
  customerId: string,
  options: {
    adGroupId: string
    adId: string
    status: 'ENABLED' | 'PAUSED'
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { adGroupId, adId, status, loginCustomerId } = options

  const resourceName = `customers/${customerId}/adGroupAds/${adGroupId}~${adId}`

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
    `/customers/${customerId}/adGroupAds:mutate`,
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
 * Update device bid modifier for a campaign
 * bidModifier: 1.0 = no change, 0.5 = -50%, 1.5 = +50%, 0 = exclude device
 */
export async function updateDeviceBidModifier(
  accessToken: string,
  customerId: string,
  options: {
    campaignId: string
    device: 'MOBILE' | 'DESKTOP' | 'TABLET'
    bidModifier: number // 0 to exclude, 0.1-10.0 for adjustment
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { campaignId, device, bidModifier, loginCustomerId } = options

  // Device criterion IDs: MOBILE = 30001, DESKTOP = 30000, TABLET = 30002
  const deviceCriterionIds: Record<string, number> = {
    MOBILE: 30001,
    DESKTOP: 30000,
    TABLET: 30002,
  }

  const criterionId = deviceCriterionIds[device]
  const resourceName = `customers/${customerId}/campaignCriteria/${campaignId}~${criterionId}`

  const operations = [
    {
      updateMask: 'bid_modifier',
      update: {
        resourceName,
        bidModifier: bidModifier,
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

  return { resourceName: response.results?.[0]?.resourceName || resourceName }
}

/**
 * Exclude a location from a campaign
 */
export async function excludeLocation(
  accessToken: string,
  customerId: string,
  options: {
    campaignId: string
    locationId: string // Geo target constant ID
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { campaignId, locationId, loginCustomerId } = options

  const operations = [
    {
      create: {
        campaign: `customers/${customerId}/campaigns/${campaignId}`,
        location: {
          geoTargetConstant: `geoTargetConstants/${locationId}`,
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
 * Update location bid modifier for a campaign
 */
export async function updateLocationBidModifier(
  accessToken: string,
  customerId: string,
  options: {
    campaignId: string
    criterionId: string // The campaign criterion ID for this location
    bidModifier: number // 0.1-10.0
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { campaignId, criterionId, bidModifier, loginCustomerId } = options

  const resourceName = `customers/${customerId}/campaignCriteria/${campaignId}~${criterionId}`

  const operations = [
    {
      updateMask: 'bid_modifier',
      update: {
        resourceName,
        bidModifier: bidModifier,
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

  return { resourceName: response.results?.[0]?.resourceName || resourceName }
}

/**
 * Add ad schedule (day/time targeting) to a campaign
 */
export async function addAdSchedule(
  accessToken: string,
  customerId: string,
  options: {
    campaignId: string
    dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
    startHour: number // 0-23
    endHour: number // 0-24
    bidModifier?: number // Optional bid adjustment
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { campaignId, dayOfWeek, startHour, endHour, bidModifier, loginCustomerId } = options

  const adSchedule: Record<string, unknown> = {
    dayOfWeek,
    startHour,
    startMinute: 'ZERO',
    endHour,
    endMinute: 'ZERO',
  }

  const criterion: Record<string, unknown> = {
    campaign: `customers/${customerId}/campaigns/${campaignId}`,
    adSchedule,
  }

  if (bidModifier !== undefined) {
    criterion.bidModifier = bidModifier
  }

  const operations = [{ create: criterion }]

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
 * Exclude age range from a campaign
 */
export async function excludeAgeRange(
  accessToken: string,
  customerId: string,
  options: {
    campaignId: string
    ageRange: 'AGE_RANGE_18_24' | 'AGE_RANGE_25_34' | 'AGE_RANGE_35_44' | 'AGE_RANGE_45_54' | 'AGE_RANGE_55_64' | 'AGE_RANGE_65_UP' | 'AGE_RANGE_UNDETERMINED'
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { campaignId, ageRange, loginCustomerId } = options

  const operations = [
    {
      create: {
        campaign: `customers/${customerId}/campaigns/${campaignId}`,
        ageRange: {
          type: ageRange,
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
 * Exclude gender from a campaign
 */
export async function excludeGender(
  accessToken: string,
  customerId: string,
  options: {
    campaignId: string
    gender: 'MALE' | 'FEMALE' | 'UNDETERMINED'
    loginCustomerId?: string
  }
): Promise<{ resourceName: string }> {
  const { campaignId, gender, loginCustomerId } = options

  const operations = [
    {
      create: {
        campaign: `customers/${customerId}/campaigns/${campaignId}`,
        gender: {
          type: gender,
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
      adId?: string
      locationCriterionId?: string
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

      case 'PAUSE_AD_GROUP':
        if (!action.targetEntity.adGroupId) {
          throw new Error('AdGroup ID required')
        }
        result = await updateAdGroupStatus(accessToken, customerId, {
          adGroupId: action.targetEntity.adGroupId,
          status: 'PAUSED',
          loginCustomerId,
        })
        break

      case 'ENABLE_AD_GROUP':
        if (!action.targetEntity.adGroupId) {
          throw new Error('AdGroup ID required')
        }
        result = await updateAdGroupStatus(accessToken, customerId, {
          adGroupId: action.targetEntity.adGroupId,
          status: 'ENABLED',
          loginCustomerId,
        })
        break

      case 'UPDATE_AD_GROUP_BID':
        if (!action.targetEntity.adGroupId) {
          throw new Error('AdGroup ID required')
        }
        if (!action.payload.bidMicros) {
          throw new Error('Bid amount required')
        }
        result = await updateAdGroupBid(accessToken, customerId, {
          adGroupId: action.targetEntity.adGroupId,
          bidMicros: action.payload.bidMicros as number,
          loginCustomerId,
        })
        break

      case 'PAUSE_AD':
        if (!action.targetEntity.adGroupId || !action.targetEntity.adId) {
          throw new Error('AdGroup ID and Ad ID required')
        }
        result = await updateAdStatus(accessToken, customerId, {
          adGroupId: action.targetEntity.adGroupId,
          adId: action.targetEntity.adId,
          status: 'PAUSED',
          loginCustomerId,
        })
        break

      case 'ENABLE_AD':
        if (!action.targetEntity.adGroupId || !action.targetEntity.adId) {
          throw new Error('AdGroup ID and Ad ID required')
        }
        result = await updateAdStatus(accessToken, customerId, {
          adGroupId: action.targetEntity.adGroupId,
          adId: action.targetEntity.adId,
          status: 'ENABLED',
          loginCustomerId,
        })
        break

      case 'UPDATE_DEVICE_BID_MODIFIER':
        if (!action.targetEntity.campaignId) {
          throw new Error('Campaign ID required')
        }
        if (!action.payload.device || action.payload.bidModifier === undefined) {
          throw new Error('Device and bid modifier required')
        }
        result = await updateDeviceBidModifier(accessToken, customerId, {
          campaignId: action.targetEntity.campaignId,
          device: action.payload.device as 'MOBILE' | 'DESKTOP' | 'TABLET',
          bidModifier: action.payload.bidModifier as number,
          loginCustomerId,
        })
        break

      case 'EXCLUDE_LOCATION':
        if (!action.targetEntity.campaignId) {
          throw new Error('Campaign ID required')
        }
        if (!action.payload.locationId) {
          throw new Error('Location ID required')
        }
        result = await excludeLocation(accessToken, customerId, {
          campaignId: action.targetEntity.campaignId,
          locationId: action.payload.locationId as string,
          loginCustomerId,
        })
        break

      case 'UPDATE_LOCATION_BID_MODIFIER':
        if (!action.targetEntity.campaignId || !action.targetEntity.locationCriterionId) {
          throw new Error('Campaign ID and Location Criterion ID required')
        }
        if (action.payload.bidModifier === undefined) {
          throw new Error('Bid modifier required')
        }
        result = await updateLocationBidModifier(accessToken, customerId, {
          campaignId: action.targetEntity.campaignId,
          criterionId: action.targetEntity.locationCriterionId,
          bidModifier: action.payload.bidModifier as number,
          loginCustomerId,
        })
        break

      case 'ADD_AD_SCHEDULE':
        if (!action.targetEntity.campaignId) {
          throw new Error('Campaign ID required')
        }
        if (!action.payload.dayOfWeek || action.payload.startHour === undefined || action.payload.endHour === undefined) {
          throw new Error('Day of week, start hour and end hour required')
        }
        result = await addAdSchedule(accessToken, customerId, {
          campaignId: action.targetEntity.campaignId,
          dayOfWeek: action.payload.dayOfWeek as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY',
          startHour: action.payload.startHour as number,
          endHour: action.payload.endHour as number,
          bidModifier: action.payload.bidModifier as number | undefined,
          loginCustomerId,
        })
        break

      case 'EXCLUDE_AGE_RANGE':
        if (!action.targetEntity.campaignId) {
          throw new Error('Campaign ID required')
        }
        if (!action.payload.ageRange) {
          throw new Error('Age range required')
        }
        result = await excludeAgeRange(accessToken, customerId, {
          campaignId: action.targetEntity.campaignId,
          ageRange: action.payload.ageRange as 'AGE_RANGE_18_24' | 'AGE_RANGE_25_34' | 'AGE_RANGE_35_44' | 'AGE_RANGE_45_54' | 'AGE_RANGE_55_64' | 'AGE_RANGE_65_UP' | 'AGE_RANGE_UNDETERMINED',
          loginCustomerId,
        })
        break

      case 'EXCLUDE_GENDER':
        if (!action.targetEntity.campaignId) {
          throw new Error('Campaign ID required')
        }
        if (!action.payload.gender) {
          throw new Error('Gender required')
        }
        result = await excludeGender(accessToken, customerId, {
          campaignId: action.targetEntity.campaignId,
          gender: action.payload.gender as 'MALE' | 'FEMALE' | 'UNDETERMINED',
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
