/**
 * Google Analytics 4 Data Extraction Service
 * Extracts website traffic, conversions, and user behavior data for analysis
 */

import { runReport } from './analytics'
import { prisma } from '@/lib/prisma'
import { decryptTokens, encryptTokens } from '@/lib/encryption'
import { refreshAccessToken, calculateTokenExpiry, isTokenExpired } from './oauth'

// Types for extracted data
export interface TrafficOverviewData {
  date: string
  sessions: number
  users: number
  newUsers: number
  pageviews: number
  bounceRate: number
  avgSessionDuration: number
  engagementRate: number
}

export interface TrafficSourceData {
  source: string
  medium: string
  sessions: number
  users: number
  newUsers: number
  bounceRate: number
  conversions: number
  revenue: number
}

export interface PagePerformanceData {
  pagePath: string
  pageTitle: string
  pageviews: number
  uniquePageviews: number
  avgTimeOnPage: number
  entrances: number
  exitRate: number
  bounceRate: number
}

export interface DeviceData {
  deviceCategory: string
  sessions: number
  users: number
  bounceRate: number
  avgSessionDuration: number
  conversions: number
}

export interface GeographicData {
  country: string
  city: string
  sessions: number
  users: number
  bounceRate: number
  conversions: number
}

export interface ConversionData {
  eventName: string
  eventCount: number
  totalUsers: number
  eventValue: number
}

export interface GoogleAnalyticsData {
  propertyId: string
  propertyName: string
  dateRange: { startDate: string; endDate: string }
  trafficOverview: TrafficOverviewData[]
  trafficSources: TrafficSourceData[]
  topPages: PagePerformanceData[]
  devices: DeviceData[]
  geographic: GeographicData[]
  conversions: ConversionData[]
  summary: {
    totalSessions: number
    totalUsers: number
    totalPageviews: number
    avgBounceRate: number
    avgSessionDuration: number
    totalConversions: number
    totalRevenue: number
  }
}

/**
 * Get valid access token for a Google Analytics data source, refreshing if needed
 */
export async function getValidAnalyticsToken(dataSourceId: string): Promise<{
  accessToken: string
  propertyId: string
}> {
  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  })

  if (!dataSource) {
    throw new Error('Data source not found')
  }

  if (dataSource.type !== 'GOOGLE_ANALYTICS') {
    throw new Error('Data source is not Google Analytics')
  }

  // Decrypt tokens
  const tokens = decryptTokens({
    accessToken: dataSource.accessToken,
    refreshToken: dataSource.refreshToken,
  })

  // Check if token needs refresh
  if (isTokenExpired(dataSource.tokenExpiry)) {
    console.log(`[GA4] Token expired for ${dataSource.accountId}, refreshing...`)

    const newTokens = await refreshAccessToken('google_analytics', tokens.refreshToken)

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
      propertyId: dataSource.accountId,
    }
  }

  return {
    accessToken: tokens.accessToken,
    propertyId: dataSource.accountId,
  }
}

/**
 * Extract traffic overview by date
 */
async function extractTrafficOverview(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<TrafficOverviewData[]> {
  const result = await runReport(accessToken, propertyId, {
    startDate,
    endDate,
    dimensions: ['date'],
    metrics: [
      'sessions',
      'totalUsers',
      'newUsers',
      'screenPageViews',
      'bounceRate',
      'averageSessionDuration',
      'engagementRate',
    ],
  })

  return result.rows.map((row) => ({
    date: row.dimensions.date,
    sessions: Number(row.metrics.sessions) || 0,
    users: Number(row.metrics.totalUsers) || 0,
    newUsers: Number(row.metrics.newUsers) || 0,
    pageviews: Number(row.metrics.screenPageViews) || 0,
    bounceRate: Number(row.metrics.bounceRate) || 0,
    avgSessionDuration: Number(row.metrics.averageSessionDuration) || 0,
    engagementRate: Number(row.metrics.engagementRate) || 0,
  }))
}

/**
 * Extract traffic sources
 */
async function extractTrafficSources(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<TrafficSourceData[]> {
  const result = await runReport(accessToken, propertyId, {
    startDate,
    endDate,
    dimensions: ['sessionSource', 'sessionMedium'],
    metrics: [
      'sessions',
      'totalUsers',
      'newUsers',
      'bounceRate',
      'engagedSessions',
    ],
    limit: 50,
  })

  return result.rows.map((row) => ({
    source: row.dimensions.sessionSource || '(direct)',
    medium: row.dimensions.sessionMedium || '(none)',
    sessions: Number(row.metrics.sessions) || 0,
    users: Number(row.metrics.totalUsers) || 0,
    newUsers: Number(row.metrics.newUsers) || 0,
    bounceRate: Number(row.metrics.bounceRate) || 0,
    conversions: Number(row.metrics.engagedSessions) || 0,
    revenue: 0,
  }))
}

/**
 * Extract top pages
 */
async function extractTopPages(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<PagePerformanceData[]> {
  const result = await runReport(accessToken, propertyId, {
    startDate,
    endDate,
    dimensions: ['pagePath', 'pageTitle'],
    metrics: [
      'screenPageViews',
      'sessions',
      'bounceRate',
      'userEngagementDuration',
    ],
    limit: 50,
  })

  return result.rows.map((row) => ({
    pagePath: row.dimensions.pagePath,
    pageTitle: row.dimensions.pageTitle || row.dimensions.pagePath,
    pageviews: Number(row.metrics.screenPageViews) || 0,
    uniquePageviews: Number(row.metrics.screenPageViews) || 0,
    avgTimeOnPage: Number(row.metrics.userEngagementDuration) || 0,
    entrances: Number(row.metrics.sessions) || 0,
    exitRate: 0,
    bounceRate: Number(row.metrics.bounceRate) || 0,
  }))
}

/**
 * Extract device breakdown
 */
async function extractDevices(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<DeviceData[]> {
  const result = await runReport(accessToken, propertyId, {
    startDate,
    endDate,
    dimensions: ['deviceCategory'],
    metrics: [
      'sessions',
      'totalUsers',
      'bounceRate',
      'averageSessionDuration',
      'engagedSessions',
    ],
  })

  return result.rows.map((row) => ({
    deviceCategory: row.dimensions.deviceCategory,
    sessions: Number(row.metrics.sessions) || 0,
    users: Number(row.metrics.totalUsers) || 0,
    bounceRate: Number(row.metrics.bounceRate) || 0,
    avgSessionDuration: Number(row.metrics.averageSessionDuration) || 0,
    conversions: Number(row.metrics.engagedSessions) || 0,
  }))
}

/**
 * Extract geographic data
 */
async function extractGeographic(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<GeographicData[]> {
  const result = await runReport(accessToken, propertyId, {
    startDate,
    endDate,
    dimensions: ['country', 'city'],
    metrics: [
      'sessions',
      'totalUsers',
      'bounceRate',
      'engagedSessions',
    ],
    limit: 50,
  })

  return result.rows.map((row) => ({
    country: row.dimensions.country,
    city: row.dimensions.city || '(not set)',
    sessions: Number(row.metrics.sessions) || 0,
    users: Number(row.metrics.totalUsers) || 0,
    bounceRate: Number(row.metrics.bounceRate) || 0,
    conversions: Number(row.metrics.engagedSessions) || 0,
  }))
}

/**
 * Extract conversion events
 */
async function extractConversions(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConversionData[]> {
  const result = await runReport(accessToken, propertyId, {
    startDate,
    endDate,
    dimensions: ['eventName'],
    metrics: [
      'eventCount',
      'totalUsers',
      'eventValue',
    ],
    limit: 30,
  })

  return result.rows.map((row) => ({
    eventName: row.dimensions.eventName,
    eventCount: Number(row.metrics.eventCount) || 0,
    totalUsers: Number(row.metrics.totalUsers) || 0,
    eventValue: Number(row.metrics.eventValue) || 0,
  }))
}

/**
 * Extract all Google Analytics data for analysis
 */
export async function extractGoogleAnalyticsData(
  dataSourceId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAnalyticsData> {
  const { accessToken, propertyId } = await getValidAnalyticsToken(dataSourceId)

  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
    select: { accountId: true, accountName: true },
  })

  if (!dataSource) {
    throw new Error('Data source not found')
  }

  console.log(`[GA4] Extracting data for ${propertyId} from ${startDate} to ${endDate}`)

  // Extract all data in parallel with error handling for each
  const results = await Promise.allSettled([
    extractTrafficOverview(accessToken, propertyId, startDate, endDate),
    extractTrafficSources(accessToken, propertyId, startDate, endDate),
    extractTopPages(accessToken, propertyId, startDate, endDate),
    extractDevices(accessToken, propertyId, startDate, endDate),
    extractGeographic(accessToken, propertyId, startDate, endDate),
    extractConversions(accessToken, propertyId, startDate, endDate),
  ])

  // Extract results, using empty arrays for failed extractions
  const trafficOverview = results[0].status === 'fulfilled' ? results[0].value : []
  const trafficSources = results[1].status === 'fulfilled' ? results[1].value : []
  const topPages = results[2].status === 'fulfilled' ? results[2].value : []
  const devices = results[3].status === 'fulfilled' ? results[3].value : []
  const geographic = results[4].status === 'fulfilled' ? results[4].value : []
  const conversions = results[5].status === 'fulfilled' ? results[5].value : []

  // Log any failures
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const names = ['trafficOverview', 'trafficSources', 'topPages', 'devices', 'geographic', 'conversions']
      console.error(`[GA4] Failed to extract ${names[i]}:`, r.reason)
    }
  })

  // Calculate summary
  const totalSessions = trafficOverview.reduce((sum, d) => sum + d.sessions, 0)
  const totalUsers = trafficOverview.reduce((sum, d) => sum + d.users, 0)
  const totalPageviews = trafficOverview.reduce((sum, d) => sum + d.pageviews, 0)
  const totalConversions = trafficSources.reduce((sum, s) => sum + s.conversions, 0)
  const totalRevenue = trafficSources.reduce((sum, s) => sum + s.revenue, 0)
  const avgBounceRate = trafficOverview.length > 0
    ? trafficOverview.reduce((sum, d) => sum + d.bounceRate, 0) / trafficOverview.length
    : 0
  const avgSessionDuration = trafficOverview.length > 0
    ? trafficOverview.reduce((sum, d) => sum + d.avgSessionDuration, 0) / trafficOverview.length
    : 0

  // Update last sync
  await prisma.dataSource.update({
    where: { id: dataSourceId },
    data: { lastSyncAt: new Date() },
  })

  return {
    propertyId: dataSource.accountId,
    propertyName: dataSource.accountName,
    dateRange: { startDate, endDate },
    trafficOverview,
    trafficSources,
    topPages,
    devices,
    geographic,
    conversions,
    summary: {
      totalSessions,
      totalUsers,
      totalPageviews,
      avgBounceRate,
      avgSessionDuration,
      totalConversions,
      totalRevenue,
    },
  }
}

/**
 * Convert Google Analytics data to a format suitable for AI analysis (similar to CSV data)
 */
export function analyticsDataToRows(data: GoogleAnalyticsData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  // Add summary as first row
  rows.push({
    _type: 'summary',
    source: 'Google Analytics',
    property: data.propertyName,
    dateRange: `${data.dateRange.startDate} to ${data.dateRange.endDate}`,
    ...data.summary,
  })

  // Add traffic overview
  data.trafficOverview.forEach((d) => {
    rows.push({
      _type: 'daily_traffic',
      ...d,
    })
  })

  // Add traffic sources
  data.trafficSources.forEach((s) => {
    rows.push({
      _type: 'traffic_source',
      ...s,
    })
  })

  // Add top pages
  data.topPages.forEach((p) => {
    rows.push({
      _type: 'page_performance',
      ...p,
    })
  })

  // Add devices
  data.devices.forEach((d) => {
    rows.push({
      _type: 'device',
      ...d,
    })
  })

  // Add geographic
  data.geographic.slice(0, 20).forEach((g) => {
    rows.push({
      _type: 'geographic',
      ...g,
    })
  })

  // Add conversions
  data.conversions.forEach((c) => {
    rows.push({
      _type: 'conversion_event',
      ...c,
    })
  })

  return rows
}
