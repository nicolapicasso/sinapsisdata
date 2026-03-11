/**
 * Google Ads Optimization Analyzer
 * Uses Claude to analyze Google Ads data and generate optimization suggestions
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleAdsAnalysisData } from './data-extraction'

const anthropic = new Anthropic()

export type OptimizationActionType =
  | 'NEGATIVE_KEYWORD'
  | 'EXCLUDE_PLACEMENT'
  | 'PAUSE_KEYWORD'
  | 'ENABLE_KEYWORD'
  | 'UPDATE_KEYWORD_BID'
  | 'UPDATE_CAMPAIGN_BUDGET'
  | 'PAUSE_CAMPAIGN'
  | 'ENABLE_CAMPAIGN'
  | 'PAUSE_AD_GROUP'
  | 'ENABLE_AD_GROUP'
  | 'UPDATE_AD_GROUP_BID'
  | 'PAUSE_AD'
  | 'ENABLE_AD'
  | 'UPDATE_DEVICE_BID_MODIFIER'
  | 'EXCLUDE_LOCATION'
  | 'UPDATE_LOCATION_BID_MODIFIER'
  | 'ADD_AD_SCHEDULE'
  | 'EXCLUDE_AGE_RANGE'
  | 'EXCLUDE_GENDER'

export interface OptimizationSuggestion {
  type: OptimizationActionType
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  description: string
  reason: string
  impact: string
  targetEntity: {
    campaignId?: string
    campaignName?: string
    adGroupId?: string
    adGroupName?: string
    keywordId?: string
    keywordText?: string
    searchTerm?: string
    placement?: string
    budgetId?: string
    adId?: string
    device?: string
    locationId?: string
    locationCriterionId?: string
  }
  payload: Record<string, unknown>
  metrics: {
    impressions?: number
    clicks?: number
    cost?: number
    conversions?: number
    ctr?: number
    cpc?: number
    costPerConversion?: number
    conversionRate?: number
  }
}

export interface AnalysisResult {
  summary: string
  healthScore: number // 0-100
  suggestions: OptimizationSuggestion[]
  insights: string[]
  warnings: string[]
}

/**
 * Helper to aggregate device performance by campaign
 */
function aggregateDevicePerformance(
  devices: GoogleAdsAnalysisData['devices']
): Array<{
  campaignName: string
  device: string
  cost: number
  conversions: number
  costPerConversion: number
  conversionRate: number
}> {
  const aggregated = new Map<string, {
    campaignName: string
    device: string
    cost: number
    conversions: number
    clicks: number
  }>()

  for (const d of devices) {
    const key = `${d.campaignId}-${d.device}`
    const existing = aggregated.get(key)
    if (existing) {
      existing.cost += d.cost
      existing.conversions += d.conversions
      existing.clicks += d.clicks
    } else {
      aggregated.set(key, {
        campaignName: d.campaignName,
        device: d.device,
        cost: d.cost,
        conversions: d.conversions,
        clicks: d.clicks,
      })
    }
  }

  return Array.from(aggregated.values()).map((d) => ({
    ...d,
    costPerConversion: d.conversions > 0 ? d.cost / d.conversions : 0,
    conversionRate: d.clicks > 0 ? (d.conversions / d.clicks) * 100 : 0,
  }))
}

/**
 * Helper to aggregate data by a field
 */
function aggregateByField<T extends { cost: number; conversions: number }>(
  items: T[],
  field: keyof T
): Array<T & { costPerConversion: number }> {
  const aggregated = new Map<unknown, T>()

  for (const item of items) {
    const key = item[field]
    const existing = aggregated.get(key)
    if (existing) {
      existing.cost += item.cost
      existing.conversions += item.conversions
    } else {
      aggregated.set(key, { ...item })
    }
  }

  return Array.from(aggregated.values()).map((item) => ({
    ...item,
    costPerConversion: item.conversions > 0 ? item.cost / item.conversions : 0,
  }))
}

/**
 * Build the analysis prompt for Claude
 */
function buildAnalysisPrompt(data: GoogleAdsAnalysisData, projectContext?: string): string {
  const campaignSummary = data.campaigns
    .slice(0, 20)
    .map(
      (c) =>
        `- ${c.campaignName} [${c.status}]: ${c.impressions.toLocaleString()} imp, ${c.clicks} clicks, ${c.cost.toFixed(2)}€ cost, ${c.conversions.toFixed(1)} conv, CTR: ${c.ctr.toFixed(2)}%, CPC: ${c.cpc.toFixed(2)}€, CPA: ${c.costPerConversion.toFixed(2)}€`
    )
    .join('\n')

  // Ad groups summary with status
  const adGroupSummary = data.adGroups
    .slice(0, 30)
    .map(
      (ag) =>
        `- "${ag.adGroupName}" [${ag.status}] en "${ag.campaignName}": ${ag.impressions.toLocaleString()} imp, ${ag.clicks} clicks, ${ag.cost.toFixed(2)}€ cost, ${ag.conversions.toFixed(1)} conv`
    )
    .join('\n')

  const lowQualityKeywords = data.keywords
    .filter((k) => k.qualityScore !== null && k.qualityScore < 5 && k.cost > 10)
    .slice(0, 20)
    .map(
      (k) =>
        `- "${k.keywordText}" [${k.status}] (QS: ${k.qualityScore}): ${k.cost.toFixed(2)}€ cost, ${k.conversions.toFixed(1)} conv`
    )
    .join('\n')

  const expensiveSearchTermsNoConversions = data.searchTerms
    .filter((st) => st.conversions === 0 && st.cost > 5)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 30)
    .map(
      (st) =>
        `- "${st.searchTerm}" in "${st.campaignName}" > "${st.adGroupName}": ${st.cost.toFixed(2)}€ cost, ${st.clicks} clicks, 0 conversions`
    )
    .join('\n')

  const lowPerformingPlacements = data.placements
    .filter((p) => p.conversions === 0 && p.cost > 5)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20)
    .map((p) => `- ${p.displayName || p.placement}: ${p.cost.toFixed(2)}€ cost, ${p.clicks} clicks, 0 conversions`)
    .join('\n')

  const highCostKeywordsLowConversions = data.keywords
    .filter((k) => k.cost > 50 && (k.conversions === 0 || k.costPerConversion > 100))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20)
    .map(
      (k) =>
        `- "${k.keywordText}" [${k.status}] (${k.matchType}) in "${k.campaignName}" > "${k.adGroupName}": ${k.cost.toFixed(2)}€ cost, ${k.conversions.toFixed(1)} conv, CPA: ${k.costPerConversion.toFixed(2)}€`
    )
    .join('\n')

  // Aggregate device performance by campaign
  const devicePerformance = aggregateDevicePerformance(data.devices)
  const deviceSummary = devicePerformance
    .slice(0, 20)
    .map(
      (d) =>
        `- ${d.campaignName} [${d.device}]: ${d.cost.toFixed(2)}€ cost, ${d.conversions.toFixed(1)} conv, CPA: ${d.costPerConversion.toFixed(2)}€, Conv Rate: ${d.conversionRate.toFixed(2)}%`
    )
    .join('\n')

  // Aggregate location performance
  const locationPerformance = data.locations
    .filter((l) => l.cost > 10)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20)
    .map(
      (l) =>
        `- ${l.campaignName} [Location ${l.locationId}]: ${l.cost.toFixed(2)}€ cost, ${l.conversions.toFixed(1)} conv, CPA: ${l.costPerConversion.toFixed(2)}€`
    )
    .join('\n')

  // Low performing ads
  const lowPerformingAds = data.ads
    .filter((a) => a.status === 'ENABLED' && a.cost > 20 && a.conversions === 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 15)
    .map(
      (a) =>
        `- Ad ${a.adId} in "${a.adGroupName}" > "${a.campaignName}": ${a.cost.toFixed(2)}€ cost, CTR: ${a.ctr.toFixed(2)}%, 0 conv`
    )
    .join('\n')

  // Age range performance
  const ageRangePerformance = aggregateByField(data.ageRanges, 'ageRange')
    .map(
      (a) =>
        `- ${a.ageRange}: ${a.cost.toFixed(2)}€ cost, ${a.conversions.toFixed(1)} conv, CPA: ${a.costPerConversion.toFixed(2)}€`
    )
    .join('\n')

  // Gender performance
  const genderPerformance = aggregateByField(data.genders, 'gender')
    .map(
      (g) =>
        `- ${g.gender}: ${g.cost.toFixed(2)}€ cost, ${g.conversions.toFixed(1)} conv, CPA: ${g.costPerConversion.toFixed(2)}€`
    )
    .join('\n')

  // Existing exclusions (to avoid duplicate suggestions)
  const existingNegatives = data.existingNegativeKeywords
    .slice(0, 100)
    .map((n) => `- "${n.keyword}" (${n.matchType}) - ${n.level}`)
    .join('\n')

  const existingExcludedPlacements = data.existingExcludedPlacements
    .slice(0, 50)
    .map((p) => `- ${p.placement}`)
    .join('\n')

  return `Eres un experto en optimización de Google Ads. Analiza los siguientes datos de la cuenta "${data.accountName}" (ID: ${data.accountId}) para el período ${data.dateRange.startDate} a ${data.dateRange.endDate}.

${projectContext ? `CONTEXTO DEL PROYECTO:\n${projectContext}\n\n` : ''}

RESUMEN DE LA CUENTA:
- Coste total: ${data.summary.totalCost.toFixed(2)}€
- Impresiones totales: ${data.summary.totalImpressions.toLocaleString()}
- Clics totales: ${data.summary.totalClicks.toLocaleString()}
- Conversiones totales: ${data.summary.totalConversions.toFixed(1)}
- Valor de conversiones: ${data.summary.totalConversionValue.toFixed(2)}€
- CTR promedio: ${data.summary.averageCtr.toFixed(2)}%
- CPC promedio: ${data.summary.averageCpc.toFixed(2)}€
- CPA promedio: ${data.summary.averageCostPerConversion.toFixed(2)}€
- ROAS: ${data.summary.roas.toFixed(2)}x

CAMPAÑAS (Top 20 por coste):
${campaignSummary || 'Sin datos de campañas'}

GRUPOS DE ANUNCIOS (Top 30 por coste):
${adGroupSummary || 'Sin datos de grupos de anuncios'}

KEYWORDS CON QUALITY SCORE BAJO (<5) Y COSTE SIGNIFICATIVO:
${lowQualityKeywords || 'Ninguno encontrado'}

TÉRMINOS DE BÚSQUEDA SIN CONVERSIONES (>$5 gastado):
${expensiveSearchTermsNoConversions || 'Ninguno encontrado'}

PLACEMENTS SIN CONVERSIONES (>$5 gastado):
${lowPerformingPlacements || 'Ninguno encontrado'}

KEYWORDS CON ALTO COSTE Y BAJO RENDIMIENTO:
${highCostKeywordsLowConversions || 'Ninguno encontrado'}

RENDIMIENTO POR DISPOSITIVO (por campaña):
${deviceSummary || 'Sin datos de dispositivos'}

RENDIMIENTO POR UBICACIÓN GEOGRÁFICA:
${locationPerformance || 'Sin datos de ubicación'}

ANUNCIOS CON BAJO RENDIMIENTO (gasto >20€, 0 conv):
${lowPerformingAds || 'Ninguno encontrado'}

RENDIMIENTO POR EDAD:
${ageRangePerformance || 'Sin datos demográficos'}

RENDIMIENTO POR GÉNERO:
${genderPerformance || 'Sin datos demográficos'}

KEYWORDS NEGATIVAS YA APLICADAS (NO sugerir duplicados):
${existingNegatives || 'Ninguna encontrada'}

PLACEMENTS YA EXCLUIDOS (NO sugerir duplicados):
${existingExcludedPlacements || 'Ninguno encontrado'}

Genera un análisis JSON con la siguiente estructura:
{
  "summary": "Resumen ejecutivo de 2-3 oraciones del estado de la cuenta",
  "healthScore": <número 0-100 indicando salud general>,
  "suggestions": [
    {
      "type": "<tipo de acción - ver lista abajo>",
      "priority": "<LOW|MEDIUM|HIGH|CRITICAL>",
      "title": "Título corto de la acción",
      "description": "Descripción detallada de qué hacer",
      "reason": "Por qué se sugiere esta acción basándose en los datos",
      "impact": "Impacto estimado (ahorro, mejora esperada)",
      "targetEntity": {
        "campaignId": "ID si aplica",
        "campaignName": "Nombre si aplica",
        "adGroupId": "ID si aplica",
        "adGroupName": "Nombre si aplica",
        "keywordText": "Texto si aplica",
        "searchTerm": "Término si aplica",
        "placement": "Placement si aplica",
        "adId": "ID del anuncio si aplica",
        "device": "MOBILE|DESKTOP|TABLET si aplica",
        "locationId": "ID de ubicación si aplica"
      },
      "payload": {
        // Datos específicos para ejecutar la acción - ver ejemplos abajo
      },
      "metrics": {
        "cost": <coste actual>,
        "conversions": <conversiones actuales>,
        "ctr": <CTR actual>,
        "conversionRate": <tasa de conversión si aplica>
      }
    }
  ],
  "insights": [
    "Insight 1: Observación importante sobre la cuenta",
    "Insight 2: ..."
  ],
  "warnings": [
    "Warning 1: Problema que requiere atención inmediata",
    "Warning 2: ..."
  ]

TIPOS DE ACCIÓN DISPONIBLES Y SUS PAYLOADS:
- NEGATIVE_KEYWORD: {"keyword": "texto", "matchType": "EXACT|PHRASE|BROAD"}
- EXCLUDE_PLACEMENT: {"placement": "url"}
- PAUSE_KEYWORD: {} (usa keywordText en targetEntity)
- ENABLE_KEYWORD: {} (usa keywordText en targetEntity)
- UPDATE_KEYWORD_BID: {"bidMicros": 1500000} (1.5€)
- UPDATE_CAMPAIGN_BUDGET: {"budgetReduction": 50} (reducir 50%)
- PAUSE_CAMPAIGN: {}
- ENABLE_CAMPAIGN: {}
- PAUSE_AD_GROUP: {} (requiere adGroupName en targetEntity)
- ENABLE_AD_GROUP: {}
- UPDATE_AD_GROUP_BID: {"bidMicros": 1000000}
- PAUSE_AD: {} (requiere adId en targetEntity)
- ENABLE_AD: {}
- UPDATE_DEVICE_BID_MODIFIER: {"device": "MOBILE|DESKTOP|TABLET", "bidModifier": 0.5} (0.5 = -50%, 1.5 = +50%, 0 = excluir)
- EXCLUDE_LOCATION: {"locationId": "123456"}
- UPDATE_LOCATION_BID_MODIFIER: {"bidModifier": 1.2} (requiere locationId en targetEntity)
- ADD_AD_SCHEDULE: {"dayOfWeek": "MONDAY", "startHour": 9, "endHour": 18, "bidModifier": 1.0}
- EXCLUDE_AGE_RANGE: {"ageRange": "AGE_RANGE_18_24|AGE_RANGE_25_34|AGE_RANGE_35_44|AGE_RANGE_45_54|AGE_RANGE_55_64|AGE_RANGE_65_UP"}
- EXCLUDE_GENDER: {"gender": "MALE|FEMALE|UNDETERMINED"}
}

REGLAS IMPORTANTES:
1. Solo sugiere acciones ejecutables y específicas
2. Prioriza sugerencias con mayor impacto potencial (ahorro de coste sin perder conversiones)
3. Los términos de búsqueda sin conversiones con coste >$10 son candidatos a keywords negativas
4. Los placements sin conversiones con coste >$20 son candidatos a exclusión
5. Keywords con QS <4 y alto coste deben revisarse
6. No sugieras más de 15 acciones para no abrumar
7. Incluye siempre el campaignId y adGroupId en targetEntity cuando estén disponibles
8. Para NEGATIVE_KEYWORD, especifica matchType (preferir EXACT para términos específicos)
9. CRÍTICO - NO SUGIERAS DUPLICADOS:
   - NO sugieras añadir keywords negativas que ya están en la lista "KEYWORDS NEGATIVAS YA APLICADAS"
   - NO sugieras excluir placements que ya están en la lista "PLACEMENTS YA EXCLUIDOS"
   - Antes de sugerir NEGATIVE_KEYWORD, verifica que no esté ya aplicada
   - Antes de sugerir EXCLUDE_PLACEMENT, verifica que no esté ya excluido
10. CRÍTICO - Respeta el estado actual de las entidades:
   - NO sugieras PAUSE_CAMPAIGN para campañas con status "PAUSED" (ya están pausadas)
   - NO sugieras ENABLE_CAMPAIGN para campañas con status "ENABLED" (ya están activas)
   - NO sugieras PAUSE_KEYWORD para keywords con status "PAUSED"
   - NO sugieras ENABLE_KEYWORD para keywords con status "ENABLED"
   - Solo sugiere cambios de estado para entidades que realmente necesitan el cambio
11. Solo analiza y sugiere acciones para entidades ACTIVAS:
   - Ignora campañas con status "PAUSED" para sugerencias de optimización
   - Ignora grupos de anuncios con status "PAUSED"
   - Ignora keywords con status "PAUSED"
12. HERENCIA DE ESTADO - Las entidades heredan el estado de sus padres:
   - Si una campaña está PAUSED, todos sus grupos de anuncios y keywords están efectivamente pausados (no sugieras acciones sobre ellos)
   - Si un grupo de anuncios está PAUSED, todas sus keywords están efectivamente pausadas (no sugieras acciones sobre ellas)
   - Solo sugiere acciones sobre keywords que están en grupos de anuncios ENABLED dentro de campañas ENABLED

Responde SOLO con el JSON, sin explicación adicional.`
}

/**
 * Analyze Google Ads data and generate optimization suggestions
 */
export async function analyzeGoogleAdsData(
  data: GoogleAdsAnalysisData,
  projectContext?: string
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(data, projectContext)

  console.log('[Optimizer] Analyzing Google Ads data with Claude...')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON response
  let result: AnalysisResult
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = textContent.text
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }
    result = JSON.parse(jsonStr.trim())
  } catch {
    console.error('[Optimizer] Failed to parse Claude response:', textContent.text)
    throw new Error('Failed to parse optimization analysis')
  }

  // Validate and enhance suggestions with actual IDs from data
  result.suggestions = result.suggestions.map((suggestion) => {
    // Try to find matching entities and add IDs
    if (suggestion.targetEntity.searchTerm) {
      const matchingTerm = data.searchTerms.find(
        (st) => st.searchTerm === suggestion.targetEntity.searchTerm
      )
      if (matchingTerm) {
        suggestion.targetEntity.campaignId = matchingTerm.campaignId
        suggestion.targetEntity.campaignName = matchingTerm.campaignName
        suggestion.targetEntity.adGroupId = matchingTerm.adGroupId
        suggestion.targetEntity.adGroupName = matchingTerm.adGroupName
        suggestion.metrics = {
          cost: matchingTerm.cost,
          conversions: matchingTerm.conversions,
          ctr: matchingTerm.ctr,
        }
      }
    }

    if (suggestion.targetEntity.keywordText && !suggestion.targetEntity.keywordId) {
      const matchingKeyword = data.keywords.find(
        (k) => k.keywordText === suggestion.targetEntity.keywordText
      )
      if (matchingKeyword) {
        suggestion.targetEntity.keywordId = matchingKeyword.keywordId
        suggestion.targetEntity.campaignId = matchingKeyword.campaignId
        suggestion.targetEntity.adGroupId = matchingKeyword.adGroupId
      }
    }

    if (suggestion.targetEntity.placement) {
      const matchingPlacement = data.placements.find(
        (p) =>
          p.placement === suggestion.targetEntity.placement ||
          p.displayName === suggestion.targetEntity.placement
      )
      if (matchingPlacement) {
        suggestion.targetEntity.campaignId = matchingPlacement.campaignId
        suggestion.targetEntity.adGroupId = matchingPlacement.adGroupId
        suggestion.metrics = {
          cost: matchingPlacement.cost,
          conversions: matchingPlacement.conversions,
          ctr: matchingPlacement.ctr,
        }
      }
    }

    // For NEGATIVE_KEYWORD without campaignId, find a search term containing the keyword
    if (
      suggestion.type === 'NEGATIVE_KEYWORD' &&
      !suggestion.targetEntity.campaignId &&
      suggestion.payload?.keyword
    ) {
      const keywordToMatch = (suggestion.payload.keyword as string).toLowerCase()
      const matchingTerm = data.searchTerms.find((st) =>
        st.searchTerm.toLowerCase().includes(keywordToMatch)
      )
      if (matchingTerm) {
        suggestion.targetEntity.campaignId = matchingTerm.campaignId
        suggestion.targetEntity.campaignName = matchingTerm.campaignName
        suggestion.targetEntity.adGroupId = matchingTerm.adGroupId
        suggestion.targetEntity.adGroupName = matchingTerm.adGroupName
      }
    }

    // For campaign-related actions, enrich with budgetId and calculate actual amounts
    if (
      ['UPDATE_CAMPAIGN_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'UPDATE_DEVICE_BID_MODIFIER', 'EXCLUDE_LOCATION', 'EXCLUDE_AGE_RANGE', 'EXCLUDE_GENDER', 'ADD_AD_SCHEDULE'].includes(suggestion.type) &&
      suggestion.targetEntity.campaignName
    ) {
      const matchingCampaign = data.campaigns.find(
        (c) => c.campaignName === suggestion.targetEntity.campaignName
      )
      if (matchingCampaign) {
        suggestion.targetEntity.campaignId = matchingCampaign.campaignId
        suggestion.targetEntity.budgetId = matchingCampaign.budgetId

        // For UPDATE_CAMPAIGN_BUDGET, calculate the new amount from percentage reduction
        if (suggestion.type === 'UPDATE_CAMPAIGN_BUDGET' && suggestion.payload.budgetReduction) {
          const reductionPercent = suggestion.payload.budgetReduction as number
          const currentBudgetMicros = matchingCampaign.budget * 1_000_000
          const newBudgetMicros = Math.round(currentBudgetMicros * (1 - reductionPercent / 100))
          suggestion.payload.amountMicros = newBudgetMicros
        }
      }
    }

    // For ad group-related actions
    if (
      ['PAUSE_AD_GROUP', 'ENABLE_AD_GROUP', 'UPDATE_AD_GROUP_BID'].includes(suggestion.type) &&
      suggestion.targetEntity.adGroupName
    ) {
      const matchingAdGroup = data.adGroups.find(
        (ag) => ag.adGroupName === suggestion.targetEntity.adGroupName
      )
      if (matchingAdGroup) {
        suggestion.targetEntity.adGroupId = matchingAdGroup.adGroupId
        suggestion.targetEntity.campaignId = matchingAdGroup.campaignId
        suggestion.targetEntity.campaignName = matchingAdGroup.campaignName
      }
    }

    // For ad-related actions
    if (
      ['PAUSE_AD', 'ENABLE_AD'].includes(suggestion.type) &&
      suggestion.targetEntity.adId
    ) {
      const matchingAd = data.ads.find(
        (a) => a.adId === suggestion.targetEntity.adId
      )
      if (matchingAd) {
        suggestion.targetEntity.adGroupId = matchingAd.adGroupId
        suggestion.targetEntity.campaignId = matchingAd.campaignId
        suggestion.targetEntity.campaignName = matchingAd.campaignName
        suggestion.targetEntity.adGroupName = matchingAd.adGroupName
      }
    }

    return suggestion
  })

  console.log(
    `[Optimizer] Analysis complete: ${result.suggestions.length} suggestions, health score: ${result.healthScore}`
  )

  return result
}

/**
 * Generate a human-readable report from the analysis
 */
export function generateAnalysisReport(result: AnalysisResult): string {
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  const sortedSuggestions = [...result.suggestions].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  let report = `# Análisis de Optimización Google Ads\n\n`
  report += `## Resumen\n${result.summary}\n\n`
  report += `**Puntuación de salud:** ${result.healthScore}/100\n\n`

  if (result.warnings.length > 0) {
    report += `## Alertas\n`
    result.warnings.forEach((w) => {
      report += `- ⚠️ ${w}\n`
    })
    report += '\n'
  }

  if (result.insights.length > 0) {
    report += `## Insights\n`
    result.insights.forEach((i) => {
      report += `- 💡 ${i}\n`
    })
    report += '\n'
  }

  report += `## Acciones Sugeridas (${sortedSuggestions.length})\n\n`
  sortedSuggestions.forEach((s, idx) => {
    const priorityEmoji =
      s.priority === 'CRITICAL' ? '🔴' : s.priority === 'HIGH' ? '🟠' : s.priority === 'MEDIUM' ? '🟡' : '🟢'

    report += `### ${idx + 1}. ${priorityEmoji} ${s.title}\n`
    report += `**Prioridad:** ${s.priority} | **Tipo:** ${s.type}\n\n`
    report += `${s.description}\n\n`
    report += `**Razón:** ${s.reason}\n\n`
    report += `**Impacto esperado:** ${s.impact}\n\n`

    if (s.metrics && Object.keys(s.metrics).length > 0) {
      report += `**Métricas actuales:**\n`
      if (s.metrics.cost) report += `- Coste: ${s.metrics.cost.toFixed(2)}€\n`
      if (s.metrics.conversions !== undefined) report += `- Conversiones: ${s.metrics.conversions}\n`
      if (s.metrics.ctr) report += `- CTR: ${s.metrics.ctr.toFixed(2)}%\n`
      report += '\n'
    }

    report += '---\n\n'
  })

  return report
}
