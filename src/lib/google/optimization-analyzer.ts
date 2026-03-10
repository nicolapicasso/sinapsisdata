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
 * Build the analysis prompt for Claude
 */
function buildAnalysisPrompt(data: GoogleAdsAnalysisData, projectContext?: string): string {
  const campaignSummary = data.campaigns
    .slice(0, 20)
    .map(
      (c) =>
        `- ${c.campaignName} (${c.status}): ${c.impressions.toLocaleString()} imp, ${c.clicks} clicks, $${c.cost.toFixed(2)} cost, ${c.conversions.toFixed(1)} conv, CTR: ${c.ctr.toFixed(2)}%, CPC: $${c.cpc.toFixed(2)}, CPA: $${c.costPerConversion.toFixed(2)}`
    )
    .join('\n')

  const lowQualityKeywords = data.keywords
    .filter((k) => k.qualityScore !== null && k.qualityScore < 5 && k.cost > 10)
    .slice(0, 20)
    .map(
      (k) =>
        `- "${k.keywordText}" (QS: ${k.qualityScore}): $${k.cost.toFixed(2)} cost, ${k.conversions.toFixed(1)} conv`
    )
    .join('\n')

  const expensiveSearchTermsNoConversions = data.searchTerms
    .filter((st) => st.conversions === 0 && st.cost > 5)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 30)
    .map(
      (st) =>
        `- "${st.searchTerm}" in "${st.campaignName}" > "${st.adGroupName}": $${st.cost.toFixed(2)} cost, ${st.clicks} clicks, 0 conversions`
    )
    .join('\n')

  const lowPerformingPlacements = data.placements
    .filter((p) => p.conversions === 0 && p.cost > 5)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20)
    .map((p) => `- ${p.displayName || p.placement}: $${p.cost.toFixed(2)} cost, ${p.clicks} clicks, 0 conversions`)
    .join('\n')

  const highCostKeywordsLowConversions = data.keywords
    .filter((k) => k.cost > 50 && (k.conversions === 0 || k.costPerConversion > 100))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20)
    .map(
      (k) =>
        `- "${k.keywordText}" (${k.matchType}) in "${k.campaignName}": $${k.cost.toFixed(2)} cost, ${k.conversions.toFixed(1)} conv, CPA: $${k.costPerConversion.toFixed(2)}`
    )
    .join('\n')

  return `Eres un experto en optimización de Google Ads. Analiza los siguientes datos de la cuenta "${data.accountName}" (ID: ${data.accountId}) para el período ${data.dateRange.startDate} a ${data.dateRange.endDate}.

${projectContext ? `CONTEXTO DEL PROYECTO:\n${projectContext}\n\n` : ''}

RESUMEN DE LA CUENTA:
- Coste total: $${data.summary.totalCost.toFixed(2)}
- Impresiones totales: ${data.summary.totalImpressions.toLocaleString()}
- Clics totales: ${data.summary.totalClicks.toLocaleString()}
- Conversiones totales: ${data.summary.totalConversions.toFixed(1)}
- Valor de conversiones: $${data.summary.totalConversionValue.toFixed(2)}
- CTR promedio: ${data.summary.averageCtr.toFixed(2)}%
- CPC promedio: $${data.summary.averageCpc.toFixed(2)}
- CPA promedio: $${data.summary.averageCostPerConversion.toFixed(2)}
- ROAS: ${data.summary.roas.toFixed(2)}x

CAMPAÑAS (Top 20 por coste):
${campaignSummary || 'Sin datos de campañas'}

KEYWORDS CON QUALITY SCORE BAJO (<5) Y COSTE SIGNIFICATIVO:
${lowQualityKeywords || 'Ninguno encontrado'}

TÉRMINOS DE BÚSQUEDA SIN CONVERSIONES (>$5 gastado):
${expensiveSearchTermsNoConversions || 'Ninguno encontrado'}

PLACEMENTS SIN CONVERSIONES (>$5 gastado):
${lowPerformingPlacements || 'Ninguno encontrado'}

KEYWORDS CON ALTO COSTE Y BAJO RENDIMIENTO:
${highCostKeywordsLowConversions || 'Ninguno encontrado'}

Genera un análisis JSON con la siguiente estructura:
{
  "summary": "Resumen ejecutivo de 2-3 oraciones del estado de la cuenta",
  "healthScore": <número 0-100 indicando salud general>,
  "suggestions": [
    {
      "type": "<NEGATIVE_KEYWORD|EXCLUDE_PLACEMENT|PAUSE_KEYWORD|UPDATE_KEYWORD_BID|UPDATE_CAMPAIGN_BUDGET|PAUSE_CAMPAIGN>",
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
        "placement": "Placement si aplica"
      },
      "payload": {
        // Datos específicos para ejecutar la acción
        // Para NEGATIVE_KEYWORD: {"keyword": "texto", "matchType": "EXACT|PHRASE|BROAD"}
        // Para EXCLUDE_PLACEMENT: {"placement": "url"}
        // Para PAUSE_KEYWORD: {"criterionId": "id"}
        // Para UPDATE_KEYWORD_BID: {"criterionId": "id", "bidMicros": 1500000}
      },
      "metrics": {
        "cost": <coste actual>,
        "conversions": <conversiones actuales>,
        "ctr": <CTR actual>
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
9. CRÍTICO - Respeta el estado actual de las entidades:
   - NO sugieras PAUSE_CAMPAIGN para campañas con status "PAUSED" (ya están pausadas)
   - NO sugieras ENABLE_CAMPAIGN para campañas con status "ENABLED" (ya están activas)
   - NO sugieras PAUSE_KEYWORD para keywords con status "PAUSED"
   - NO sugieras ENABLE_KEYWORD para keywords con status "ENABLED"
   - Solo sugiere cambios de estado para entidades que realmente necesitan el cambio
10. Solo analiza y sugiere acciones para campañas con status "ENABLED" (activas), ignora las pausadas para sugerencias de optimización de rendimiento

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
      if (s.metrics.cost) report += `- Coste: $${s.metrics.cost.toFixed(2)}\n`
      if (s.metrics.conversions !== undefined) report += `- Conversiones: ${s.metrics.conversions}\n`
      if (s.metrics.ctr) report += `- CTR: ${s.metrics.ctr.toFixed(2)}%\n`
      report += '\n'
    }

    report += '---\n\n'
  })

  return report
}
