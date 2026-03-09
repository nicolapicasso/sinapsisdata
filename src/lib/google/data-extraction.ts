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
  status: string
  budget: number
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

export interface GoogleAdsAnalysisData {
  accountId: string
  accountName: string
  dateRange: { startDate: string; endDate: string }
  campaigns: CampaignData[]
  adGroups: AdGroupData[]
  keywords: KeywordData[]
  searchTerms: SearchTermData[]
  placements: PlacementData[]
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

    return {
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      status: row.campaign.status,
      budget: parseInt(row.campaignBudget?.amountMicros || '0') / 1_000_000,
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
  const [campaigns, adGroups, keywords, searchTerms, placements] = await Promise.all([
    extractCampaigns(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractAdGroups(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractKeywords(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractSearchTerms(accessToken, customerId, startDate, endDate, loginCustomerId),
    extractPlacements(accessToken, customerId, startDate, endDate, loginCustomerId),
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
