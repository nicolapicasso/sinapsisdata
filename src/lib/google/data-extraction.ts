/**
 * Google Ads Data Extraction Service
 * Extracts campaign, ad group, keyword, and search term data for analysis
 */

import { executeGaqlQuery } from './ads'
import { prisma } from '@/lib/prisma'
import { decryptTokens } from '@/lib/encryption'
import { refreshAccessToken, calculateTokenExpiry, isTokenExpired } from './oauth'
import { encryptTokens } from '@/lib/encryption'

// Types for extracted data
export interface CampaignData {
  campaignId: string
  campaignName: string
  campaignType: string // SEARCH, DISPLAY, PERFORMANCE_MAX, VIDEO, SHOPPING, etc.
  status: string
  budget: number
  budgetId: string
  budgetType: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  conversionValue: number
  ctr: number
  cpc: number
  costPerConversion: number
  roas: number
}

export interface AdGroupData {
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  status: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
}

export interface KeywordData {
  keywordId: string
  keywordText: string
  matchType: string
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  status: string
  qualityScore: number | null
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
  costPerConversion: number
}

export interface SearchTermData {
  searchTerm: string
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  keywordText: string
  matchType: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
  costPerConversion: number
}

export interface PlacementData {
  placement: string
  displayName: string
  targetUrl: string
  adGroupId: string
  campaignId: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
}

export interface DeviceData {
  device: 'MOBILE' | 'DESKTOP' | 'TABLET' | 'OTHER'
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
  costPerConversion: number
  conversionRate: number
}

export interface LocationData {
  locationId: string
  locationName: string
  countryCode: string
  locationType: string
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
  costPerConversion: number
}

export interface AdData {
  adId: string
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  adType: string
  status: string
  headlines: string[]
  descriptions: string[]
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  cpc: number
  costPerConversion: number
}

export interface HourData {
  hour: number
  dayOfWeek: number // 0 = Monday, 6 = Sunday
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  conversionRate: number
}

export interface AgeRangeData {
  ageRange: string
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  costPerConversion: number
}

export interface GenderData {
  gender: string
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  ctr: number
  costPerConversion: number
}

export interface GoogleAdsAnalysisData {
  accountId: string
  accountName: string
  dateRange: { startDate: string; endDate: string }
  campaigns: CampaignData[]
  adGroups: AdGroupData[]
  keywords: KeywordData[]
  searchTerms: SearchTermData[]
  placements: PlacementData[]
  devices: DeviceData[]
  locations: LocationData[]
  ads: AdData[]
  hourlyPerformance: HourData[]
  ageRanges: AgeRangeData[]
  genders: GenderData[]
  // Existing exclusions (to avoid duplicate suggestions)
  existingNegativeKeywords: ExistingNegativeKeyword[]
  existingExcludedPlacements: ExistingPlacementExclusion[]
  summary: {
    totalCost: number
    totalImpressions: number
    totalClicks: number
    totalConversions: number
    totalConversionValue: number
    averageCtr: number
    averageCpc: number
    averageCostPerConversion: number
    roas: number
  }
}

/**
 * Get valid access token for a data source, refreshing if needed
 */
export async function getValidAccessToken(dataSourceId: string): Promise<{
  accessToken: string
  customerId: string
  loginCustomerId?: string
}> {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  })

  if (!dataSource) {
    throw new Error('Data source not found')
  }

  if (dataSource.type !== 'GOOGLE_ADS') {
    throw new Error('Data source is not Google Ads')
  }

  // Decrypt tokens
  const tokens = decryptTokens({
    accessToken: dataSource.accessToken,
    refreshToken: dataSource.refreshToken,
  })

  // Check if token needs refresh
  if (isTokenExpired(dataSource.tokenExpiry)) {
    console.log(`[Google Ads] Token expired for ${dataSource.accountId}, refreshing...`)

    const newTokens = await refreshAccessToken('google_ads', tokens.refreshToken)

    // Encrypt and save new tokens
    const encrypted = encryptTokens({
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || tokens.refreshToken,
    })

    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        accessToken: encrypted.accessToken,
        refreshToken: encrypted.refreshToken,
        tokenExpiry: calculateTokenExpiry(newTokens.expires_in),
        status: 'CONNECTED',
        lastError: null,
      },
    })

    return {
      accessToken: newTokens.access_token,
      customerId: dataSource.accountId,
      loginCustomerId: dataSource.mccId || undefined,
    }
  }

  return {
    accessToken: tokens.accessToken,
    customerId: dataSource.accountId,
    loginCustomerId: dataSource.mccId || undefined,
  }
}

/**
 * Extract campaign performance data
 */
export async function extractCampaigns(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<CampaignData[]> {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.campaign_budget,
      campaign_budget.amount_micros,
      campaign_budget.type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `

  interface CampaignRow {
    campaign: {
      id: string
      name: string
      status: string
      advertisingChannelType: string // SEARCH, DISPLAY, PERFORMANCE_MAX, VIDEO, SHOPPING, etc.
      campaignBudget: string // resource name: customers/{customer_id}/campaignBudgets/{budget_id}
    }
    campaignBudget: {
      amountMicros: string
      type: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
      conversionsValue: string
    }
  }

  const results = await executeGaqlQuery<CampaignRow>(
    accessToken,
    customerId,
    query,
    loginCustomerId
  )

  return results.map((row) => {
    const impressions = parseInt(row.metrics.impressions) || 0
    const clicks = parseInt(row.metrics.clicks) || 0
    const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
    const conversions = parseFloat(row.metrics.conversions) || 0
    const conversionValue = parseFloat(row.metrics.conversionsValue) || 0
    // Extract budget ID from resource name: customers/{customer_id}/campaignBudgets/{budget_id}
    const budgetResourceName = row.campaign.campaignBudget || ''
    const budgetId = budgetResourceName.split('/').pop() || ''

    return {
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      campaignType: row.campaign.advertisingChannelType || 'UNKNOWN',
      status: row.campaign.status,
      budget: parseInt(row.campaignBudget?.amountMicros || '0') / 1_000_000,
      budgetId,
      budgetType: row.campaignBudget?.type || 'UNKNOWN',
      impressions,
      clicks,
      cost,
      conversions,
      conversionValue,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      costPerConversion: conversions > 0 ? cost / conversions : 0,
      roas: cost > 0 ? conversionValue / cost : 0,
    }
  })
}

/**
 * Extract ad group performance data
 */
export async function extractAdGroups(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<AdGroupData[]> {
  const query = `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM ad_group
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND ad_group.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 500
  `

  interface AdGroupRow {
    adGroup: {
      id: string
      name: string
      status: string
    }
    campaign: {
      id: string
      name: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  const results = await executeGaqlQuery<AdGroupRow>(
    accessToken,
    customerId,
    query,
    loginCustomerId
  )

  return results.map((row) => {
    const impressions = parseInt(row.metrics.impressions) || 0
    const clicks = parseInt(row.metrics.clicks) || 0
    const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
    const conversions = parseFloat(row.metrics.conversions) || 0

    return {
      adGroupId: row.adGroup.id,
      adGroupName: row.adGroup.name,
      status: row.adGroup.status,
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      impressions,
      clicks,
      cost,
      conversions,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
    }
  })
}

/**
 * Extract keyword performance data
 */
export async function extractKeywords(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<KeywordData[]> {
  const query = `
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 1000
  `

  interface KeywordRow {
    adGroupCriterion: {
      criterionId: string
      keyword: {
        text: string
        matchType: string
      }
      status: string
      qualityInfo?: {
        qualityScore?: number
      }
    }
    adGroup: {
      id: string
      name: string
    }
    campaign: {
      id: string
      name: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  const results = await executeGaqlQuery<KeywordRow>(
    accessToken,
    customerId,
    query,
    loginCustomerId
  )

  return results.map((row) => {
    const impressions = parseInt(row.metrics.impressions) || 0
    const clicks = parseInt(row.metrics.clicks) || 0
    const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
    const conversions = parseFloat(row.metrics.conversions) || 0

    return {
      keywordId: row.adGroupCriterion.criterionId,
      keywordText: row.adGroupCriterion.keyword.text,
      matchType: row.adGroupCriterion.keyword.matchType,
      status: row.adGroupCriterion.status,
      qualityScore: row.adGroupCriterion.qualityInfo?.qualityScore || null,
      adGroupId: row.adGroup.id,
      adGroupName: row.adGroup.name,
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      impressions,
      clicks,
      cost,
      conversions,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      costPerConversion: conversions > 0 ? cost / conversions : 0,
    }
  })
}

/**
 * Extract search terms report
 */
export async function extractSearchTerms(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<SearchTermData[]> {
  const query = `
    SELECT
      search_term_view.search_term,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      segments.keyword.info.text,
      segments.keyword.info.match_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 2000
  `

  interface SearchTermRow {
    searchTermView: {
      searchTerm: string
    }
    adGroup: {
      id: string
      name: string
    }
    campaign: {
      id: string
      name: string
    }
    segments: {
      keyword?: {
        info?: {
          text?: string
          matchType?: string
        }
      }
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  const results = await executeGaqlQuery<SearchTermRow>(
    accessToken,
    customerId,
    query,
    loginCustomerId
  )

  return results.map((row) => {
    const impressions = parseInt(row.metrics.impressions) || 0
    const clicks = parseInt(row.metrics.clicks) || 0
    const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
    const conversions = parseFloat(row.metrics.conversions) || 0

    return {
      searchTerm: row.searchTermView.searchTerm,
      adGroupId: row.adGroup.id,
      adGroupName: row.adGroup.name,
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      keywordText: row.segments?.keyword?.info?.text || '',
      matchType: row.segments?.keyword?.info?.matchType || '',
      impressions,
      clicks,
      cost,
      conversions,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      costPerConversion: conversions > 0 ? cost / conversions : 0,
    }
  })
}

/**
 * Extract placement performance (Display/Video campaigns)
 */
export async function extractPlacements(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<PlacementData[]> {
  const query = `
    SELECT
      group_placement_view.placement,
      group_placement_view.display_name,
      group_placement_view.target_url,
      ad_group.id,
      campaign.id,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM group_placement_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 500
  `

  interface PlacementRow {
    groupPlacementView: {
      placement: string
      displayName: string
      targetUrl: string
    }
    adGroup: {
      id: string
    }
    campaign: {
      id: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  try {
    const results = await executeGaqlQuery<PlacementRow>(
      accessToken,
      customerId,
      query,
      loginCustomerId
    )

    return results.map((row) => {
      const impressions = parseInt(row.metrics.impressions) || 0
      const clicks = parseInt(row.metrics.clicks) || 0
      const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
      const conversions = parseFloat(row.metrics.conversions) || 0

      return {
        placement: row.groupPlacementView.placement,
        displayName: row.groupPlacementView.displayName,
        targetUrl: row.groupPlacementView.targetUrl,
        adGroupId: row.adGroup.id,
        campaignId: row.campaign.id,
        impressions,
        clicks,
        cost,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? cost / clicks : 0,
      }
    })
  } catch {
    // Placements may not exist for Search-only accounts
    console.log('[Google Ads] No placement data available')
    return []
  }
}

/**
 * Extract device performance data
 */
export async function extractDevicePerformance(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<DeviceData[]> {
  const query = `
    SELECT
      segments.device,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status = 'ENABLED'
    ORDER BY metrics.cost_micros DESC
  `

  interface DeviceRow {
    segments: {
      device: string
    }
    campaign: {
      id: string
      name: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  try {
    const results = await executeGaqlQuery<DeviceRow>(
      accessToken,
      customerId,
      query,
      loginCustomerId
    )

    return results.map((row) => {
      const impressions = parseInt(row.metrics.impressions) || 0
      const clicks = parseInt(row.metrics.clicks) || 0
      const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
      const conversions = parseFloat(row.metrics.conversions) || 0

      return {
        device: row.segments.device as DeviceData['device'],
        campaignId: row.campaign.id,
        campaignName: row.campaign.name,
        impressions,
        clicks,
        cost,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? cost / clicks : 0,
        costPerConversion: conversions > 0 ? cost / conversions : 0,
        conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      }
    })
  } catch {
    console.log('[Google Ads] No device data available')
    return []
  }
}

/**
 * Extract location performance data
 */
export async function extractLocationPerformance(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<LocationData[]> {
  const query = `
    SELECT
      geographic_view.country_criterion_id,
      geographic_view.location_type,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM geographic_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 200
  `

  interface LocationRow {
    geographicView: {
      countryCriterionId: string
      locationType: string
    }
    campaign: {
      id: string
      name: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  try {
    const results = await executeGaqlQuery<LocationRow>(
      accessToken,
      customerId,
      query,
      loginCustomerId
    )

    return results.map((row) => {
      const impressions = parseInt(row.metrics.impressions) || 0
      const clicks = parseInt(row.metrics.clicks) || 0
      const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
      const conversions = parseFloat(row.metrics.conversions) || 0

      return {
        locationId: row.geographicView.countryCriterionId,
        locationName: row.geographicView.countryCriterionId, // Will be resolved later if needed
        countryCode: '',
        locationType: row.geographicView.locationType,
        campaignId: row.campaign.id,
        campaignName: row.campaign.name,
        impressions,
        clicks,
        cost,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? cost / clicks : 0,
        costPerConversion: conversions > 0 ? cost / conversions : 0,
      }
    })
  } catch {
    console.log('[Google Ads] No location data available')
    return []
  }
}

/**
 * Extract ad performance data
 */
export async function extractAdPerformance(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<AdData[]> {
  const query = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.type,
      ad_group_ad.status,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND ad_group_ad.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 200
  `

  interface AdRow {
    adGroupAd: {
      ad: {
        id: string
        type: string
        responsiveSearchAd?: {
          headlines?: Array<{ text: string }>
          descriptions?: Array<{ text: string }>
        }
      }
      status: string
    }
    adGroup: {
      id: string
      name: string
    }
    campaign: {
      id: string
      name: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  try {
    const results = await executeGaqlQuery<AdRow>(
      accessToken,
      customerId,
      query,
      loginCustomerId
    )

    return results.map((row) => {
      const impressions = parseInt(row.metrics.impressions) || 0
      const clicks = parseInt(row.metrics.clicks) || 0
      const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
      const conversions = parseFloat(row.metrics.conversions) || 0

      return {
        adId: row.adGroupAd.ad.id,
        adType: row.adGroupAd.ad.type,
        status: row.adGroupAd.status,
        headlines: row.adGroupAd.ad.responsiveSearchAd?.headlines?.map((h) => h.text) || [],
        descriptions: row.adGroupAd.ad.responsiveSearchAd?.descriptions?.map((d) => d.text) || [],
        adGroupId: row.adGroup.id,
        adGroupName: row.adGroup.name,
        campaignId: row.campaign.id,
        campaignName: row.campaign.name,
        impressions,
        clicks,
        cost,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? cost / clicks : 0,
        costPerConversion: conversions > 0 ? cost / conversions : 0,
      }
    })
  } catch {
    console.log('[Google Ads] No ad data available')
    return []
  }
}

/**
 * Extract hourly performance data
 */
export async function extractHourlyPerformance(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<HourData[]> {
  const query = `
    SELECT
      segments.hour,
      segments.day_of_week,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status = 'ENABLED'
  `

  interface HourRow {
    segments: {
      hour: number
      dayOfWeek: string
    }
    campaign: {
      id: string
      name: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  const dayOfWeekMap: Record<string, number> = {
    MONDAY: 0,
    TUESDAY: 1,
    WEDNESDAY: 2,
    THURSDAY: 3,
    FRIDAY: 4,
    SATURDAY: 5,
    SUNDAY: 6,
  }

  try {
    const results = await executeGaqlQuery<HourRow>(
      accessToken,
      customerId,
      query,
      loginCustomerId
    )

    return results.map((row) => {
      const impressions = parseInt(row.metrics.impressions) || 0
      const clicks = parseInt(row.metrics.clicks) || 0
      const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
      const conversions = parseFloat(row.metrics.conversions) || 0

      return {
        hour: row.segments.hour,
        dayOfWeek: dayOfWeekMap[row.segments.dayOfWeek] ?? 0,
        campaignId: row.campaign.id,
        campaignName: row.campaign.name,
        impressions,
        clicks,
        cost,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      }
    })
  } catch {
    console.log('[Google Ads] No hourly data available')
    return []
  }
}

/**
 * Extract age range performance data
 */
export async function extractAgeRangePerformance(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<AgeRangeData[]> {
  const query = `
    SELECT
      ad_group_criterion.age_range.type,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM age_range_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metrics.cost_micros DESC
  `

  interface AgeRangeRow {
    adGroupCriterion: {
      ageRange: {
        type: string
      }
    }
    campaign: {
      id: string
      name: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  try {
    const results = await executeGaqlQuery<AgeRangeRow>(
      accessToken,
      customerId,
      query,
      loginCustomerId
    )

    return results.map((row) => {
      const impressions = parseInt(row.metrics.impressions) || 0
      const clicks = parseInt(row.metrics.clicks) || 0
      const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
      const conversions = parseFloat(row.metrics.conversions) || 0

      return {
        ageRange: row.adGroupCriterion.ageRange.type,
        campaignId: row.campaign.id,
        campaignName: row.campaign.name,
        impressions,
        clicks,
        cost,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        costPerConversion: conversions > 0 ? cost / conversions : 0,
      }
    })
  } catch {
    console.log('[Google Ads] No age range data available')
    return []
  }
}

/**
 * Extract gender performance data
 */
export async function extractGenderPerformance(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
  loginCustomerId?: string
): Promise<GenderData[]> {
  const query = `
    SELECT
      ad_group_criterion.gender.type,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM gender_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metrics.cost_micros DESC
  `

  interface GenderRow {
    adGroupCriterion: {
      gender: {
        type: string
      }
    }
    campaign: {
      id: string
      name: string
    }
    metrics: {
      impressions: string
      clicks: string
      costMicros: string
      conversions: string
    }
  }

  try {
    const results = await executeGaqlQuery<GenderRow>(
      accessToken,
      customerId,
      query,
      loginCustomerId
    )

    return results.map((row) => {
      const impressions = parseInt(row.metrics.impressions) || 0
      const clicks = parseInt(row.metrics.clicks) || 0
      const cost = parseInt(row.metrics.costMicros) / 1_000_000 || 0
      const conversions = parseFloat(row.metrics.conversions) || 0

      return {
        gender: row.adGroupCriterion.gender.type,
        campaignId: row.campaign.id,
        campaignName: row.campaign.name,
        impressions,
        clicks,
        cost,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        costPerConversion: conversions > 0 ? cost / conversions : 0,
      }
    })
  } catch {
    console.log('[Google Ads] No gender data available')
    return []
  }
}

// ============================================
// EXISTING EXCLUSIONS (for duplicate detection)
// ============================================

export interface ExistingNegativeKeyword {
  keyword: string
  matchType: string
  campaignId: string
  adGroupId?: string
  level: 'CAMPAIGN' | 'AD_GROUP'
}

export interface ExistingPlacementExclusion {
  placement: string
  campaignId: string
}

/**
 * Extract existing negative keywords at campaign level
 */
export async function extractExistingNegativeKeywords(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string
): Promise<ExistingNegativeKeyword[]> {
  // Campaign-level negatives
  const campaignQuery = `
    SELECT
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign.id
    FROM campaign_criterion
    WHERE campaign_criterion.type = 'KEYWORD'
      AND campaign_criterion.negative = true
  `

  // Ad group-level negatives
  const adGroupQuery = `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      campaign.id,
      ad_group.id
    FROM ad_group_criterion
    WHERE ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.negative = true
  `

  interface CampaignNegativeRow {
    campaignCriterion: {
      keyword: {
        text: string
        matchType: string
      }
    }
    campaign: { id: string }
  }

  interface AdGroupNegativeRow {
    adGroupCriterion: {
      keyword: {
        text: string
        matchType: string
      }
    }
    campaign: { id: string }
    adGroup: { id: string }
  }

  const results: ExistingNegativeKeyword[] = []

  try {
    const campaignNegatives = await executeGaqlQuery<CampaignNegativeRow>(
      accessToken,
      customerId,
      campaignQuery,
      loginCustomerId
    )

    for (const row of campaignNegatives) {
      results.push({
        keyword: row.campaignCriterion.keyword.text,
        matchType: row.campaignCriterion.keyword.matchType,
        campaignId: row.campaign.id,
        level: 'CAMPAIGN',
      })
    }
  } catch {
    console.log('[Google Ads] No campaign negative keywords found')
  }

  try {
    const adGroupNegatives = await executeGaqlQuery<AdGroupNegativeRow>(
      accessToken,
      customerId,
      adGroupQuery,
      loginCustomerId
    )

    for (const row of adGroupNegatives) {
      results.push({
        keyword: row.adGroupCriterion.keyword.text,
        matchType: row.adGroupCriterion.keyword.matchType,
        campaignId: row.campaign.id,
        adGroupId: row.adGroup.id,
        level: 'AD_GROUP',
      })
    }
  } catch {
    console.log('[Google Ads] No ad group negative keywords found')
  }

  return results
}

/**
 * Extract existing excluded placements
 */
export async function extractExistingExcludedPlacements(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string
): Promise<ExistingPlacementExclusion[]> {
  const query = `
    SELECT
      campaign_criterion.placement.url,
      campaign.id
    FROM campaign_criterion
    WHERE campaign_criterion.type = 'PLACEMENT'
      AND campaign_criterion.negative = true
  `

  interface PlacementRow {
    campaignCriterion: {
      placement: {
        url: string
      }
    }
    campaign: { id: string }
  }

  try {
    const results = await executeGaqlQuery<PlacementRow>(
      accessToken,
      customerId,
      query,
      loginCustomerId
    )

    return results.map((row) => ({
      placement: row.campaignCriterion.placement.url,
      campaignId: row.campaign.id,
    }))
  } catch {
    console.log('[Google Ads] No excluded placements found')
    return []
  }
}

/**
 * Extract all Google Ads data for analysis
 */
export async function extractGoogleAdsData(
  dataSourceId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsAnalysisData> {
  const { accessToken, customerId, loginCustomerId } = await getValidAccessToken(dataSourceId)

  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
    select: { accountId: true, accountName: true },
  })

  if (!dataSource) {
    throw new Error('Data source not found')
  }

  console.log(`[Google Ads] Extracting data for ${customerId} from ${startDate} to ${endDate}`)

  // Extract all data in parallel
  const [
    campaigns,
    adGroups,
    keywords,
    searchTerms,
    placements,
    devices,
    locations,
    ads,
    hourlyPerformance,
    ageRanges,
    genders,
    existingNegativeKeywords,
    existingExcludedPlacements,
  ] = await Promise.all([
    extractCampaigns(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractAdGroups(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractKeywords(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractSearchTerms(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractPlacements(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractDevicePerformance(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractLocationPerformance(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractAdPerformance(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractHourlyPerformance(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractAgeRangePerformance(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractGenderPerformance(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractExistingNegativeKeywords(accessToken, customerId, loginCustomerId),
    extractExistingExcludedPlacements(accessToken, customerId, loginCustomerId),
  ])

  // Calculate summary
  const totalCost = campaigns.reduce((sum, c) => sum + c.cost, 0)
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0)
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0)
  const totalConversionValue = campaigns.reduce((sum, c) => sum + c.conversionValue, 0)

  // Update last sync
  await prisma.dataSource.update({
    where: { id: dataSourceId },
    data: { lastSyncAt: new Date() },
  })

  return {
    accountId: dataSource.accountId,
    accountName: dataSource.accountName,
    dateRange: { startDate, endDate },
    campaigns,
    adGroups,
    keywords,
    searchTerms,
    placements,
    devices,
    locations,
    ads,
    hourlyPerformance,
    ageRanges,
    genders,
    existingNegativeKeywords,
    existingExcludedPlacements,
    summary: {
      totalCost,
      totalImpressions,
      totalClicks,
      totalConversions,
      totalConversionValue,
      averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      averageCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
      averageCostPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
      roas: totalCost > 0 ? totalConversionValue / totalCost : 0,
    },
  }
}
