/**
 * Google Search Console Data Extraction Service
 * Extracts search performance data for analysis
 */

import { querySearchAnalytics } from './search-console'
import { prisma } from '@/lib/prisma'
import { decryptTokens, encryptTokens } from '@/lib/encryption'
import { refreshAccessToken, calculateTokenExpiry, isTokenExpired } from './oauth'

// Types for extracted data
export interface QueryPerformanceData {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface PagePerformanceData {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface DailyPerformanceData {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface CountryPerformanceData {
  country: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface DevicePerformanceData {
  device: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchConsoleData {
  siteUrl: string
  dateRange: { startDate: string; endDate: string }
  dailyPerformance: DailyPerformanceData[]
  topQueries: QueryPerformanceData[]
  topPages: PagePerformanceData[]
  countries: CountryPerformanceData[]
  devices: DevicePerformanceData[]
  summary: {
    totalClicks: number
    totalImpressions: number
    avgCtr: number
    avgPosition: number
  }
}

/**
 * Get valid access token for a Search Console data source, refreshing if needed
 */
export async function getValidSearchConsoleToken(dataSourceId: string): Promise<{
  accessToken: string
  siteUrl: string
}> {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  })

  if (!dataSource) {
    throw new Error('Data source not found')
  }

  if (dataSource.type !== 'GOOGLE_SEARCH_CONSOLE') {
    throw new Error('Data source is not Google Search Console')
  }

  // Decrypt tokens
  const tokens = decryptTokens({
    accessToken: dataSource.accessToken,
    refreshToken: dataSource.refreshToken,
  })

  // Check if token needs refresh
  if (isTokenExpired(dataSource.tokenExpiry)) {
    console.log(`[Search Console] Token expired for ${dataSource.accountId}, refreshing...`)

    const newTokens = await refreshAccessToken('google_search_console', tokens.refreshToken)

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
      siteUrl: dataSource.accountId,
    }
  }

  return {
    accessToken: tokens.accessToken,
    siteUrl: dataSource.accountId,
  }
}

/**
 * Extract daily performance data
 */
async function extractDailyPerformance(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<DailyPerformanceData[]> {
  const result = await querySearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ['date'],
    rowLimit: 100,
  })

  return (result.rows || []).map((row) => ({
    date: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr * 100, // Convert to percentage
    position: row.position,
  }))
}

/**
 * Extract top queries
 */
async function extractTopQueries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<QueryPerformanceData[]> {
  const result = await querySearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: 100,
  })

  return (result.rows || []).map((row) => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr * 100,
    position: row.position,
  }))
}

/**
 * Extract top pages
 */
async function extractTopPages(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<PagePerformanceData[]> {
  const result = await querySearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ['page'],
    rowLimit: 100,
  })

  return (result.rows || []).map((row) => ({
    page: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr * 100,
    position: row.position,
  }))
}

/**
 * Extract country breakdown
 */
async function extractCountries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<CountryPerformanceData[]> {
  const result = await querySearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ['country'],
    rowLimit: 50,
  })

  return (result.rows || []).map((row) => ({
    country: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr * 100,
    position: row.position,
  }))
}

/**
 * Extract device breakdown
 */
async function extractDevices(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<DevicePerformanceData[]> {
  const result = await querySearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ['device'],
    rowLimit: 10,
  })

  return (result.rows || []).map((row) => ({
    device: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr * 100,
    position: row.position,
  }))
}

/**
 * Extract all Search Console data for analysis
 */
export async function extractSearchConsoleData(
  dataSourceId: string,
  startDate: string,
  endDate: string
): Promise<SearchConsoleData> {
  const { accessToken, siteUrl } = await getValidSearchConsoleToken(dataSourceId)

  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
    select: { accountId: true, accountName: true },
  })

  if (!dataSource) {
    throw new Error('Data source not found')
  }

  console.log(`[Search Console] Extracting data for ${siteUrl} from ${startDate} to ${endDate}`)

  // Extract all data in parallel with error handling
  const results = await Promise.allSettled([
    extractDailyPerformance(accessToken, siteUrl, startDate, endDate),
    extractTopQueries(accessToken, siteUrl, startDate, endDate),
    extractTopPages(accessToken, siteUrl, startDate, endDate),
    extractCountries(accessToken, siteUrl, startDate, endDate),
    extractDevices(accessToken, siteUrl, startDate, endDate),
  ])

  // Extract results, using empty arrays for failed extractions
  const dailyPerformance = results[0].status === 'fulfilled' ? results[0].value : []
  const topQueries = results[1].status === 'fulfilled' ? results[1].value : []
  const topPages = results[2].status === 'fulfilled' ? results[2].value : []
  const countries = results[3].status === 'fulfilled' ? results[3].value : []
  const devices = results[4].status === 'fulfilled' ? results[4].value : []

  // Log any failures
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const names = ['dailyPerformance', 'topQueries', 'topPages', 'countries', 'devices']
      console.error(`[Search Console] Failed to extract ${names[i]}:`, r.reason)
    }
  })

  // Calculate summary
  const totalClicks = dailyPerformance.reduce((sum, d) => sum + d.clicks, 0)
  const totalImpressions = dailyPerformance.reduce((sum, d) => sum + d.impressions, 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgPosition = dailyPerformance.length > 0
    ? dailyPerformance.reduce((sum, d) => sum + d.position, 0) / dailyPerformance.length
    : 0

  // Update last sync
  await prisma.dataSource.update({
    where: { id: dataSourceId },
    data: { lastSyncAt: new Date() },
  })

  return {
    siteUrl: dataSource.accountId,
    dateRange: { startDate, endDate },
    dailyPerformance,
    topQueries,
    topPages,
    countries,
    devices,
    summary: {
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition,
    },
  }
}

/**
 * Convert Search Console data to rows for AI analysis
 */
export function searchConsoleDataToRows(data: SearchConsoleData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  // Add summary
  rows.push({
    _type: 'summary',
    source: 'Google Search Console',
    siteUrl: data.siteUrl,
    dateRange: `${data.dateRange.startDate} to ${data.dateRange.endDate}`,
    ...data.summary,
  })

  // Add daily performance
  data.dailyPerformance.forEach((d) => {
    rows.push({
      _type: 'daily_search_performance',
      ...d,
    })
  })

  // Add top queries
  data.topQueries.forEach((q) => {
    rows.push({
      _type: 'search_query',
      ...q,
    })
  })

  // Add top pages
  data.topPages.forEach((p) => {
    rows.push({
      _type: 'search_page',
      ...p,
    })
  })

  // Add countries
  data.countries.forEach((c) => {
    rows.push({
      _type: 'search_country',
      ...c,
    })
  })

  // Add devices
  data.devices.forEach((d) => {
    rows.push({
      _type: 'search_device',
      ...d,
    })
  })

  return rows
}
