import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

/**
 * POST /api/optimization/feedback
 *
 * Send feedback on an optimization suggestion and get Claude's response
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { actionId, feedback, generateReport } = body

    if (!actionId || !feedback) {
      return NextResponse.json(
        { error: 'Se requieren actionId y feedback' },
        { status: 400 }
      )
    }

    // Get the action with context
    const action = await prisma.optimizationAction.findUnique({
      where: { id: actionId },
      include: {
        project: {
          select: {
            name: true,
            context: true,
          },
        },
        dataSource: {
          select: {
            accountName: true,
          },
        },
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 })
    }

    // Build context for Claude
    const targetEntity = action.targetEntity as Record<string, unknown>
    const payload = action.payload as Record<string, unknown>
    const metrics = action.metrics as Record<string, unknown> | null

    const prompt = generateReport
      ? buildReportPrompt(action, feedback, targetEntity, payload, metrics)
      : buildFeedbackPrompt(action, feedback, targetEntity, payload, metrics)

    console.log('[Feedback] Processing feedback for action:', actionId)

    // Get Claude's response
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
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

    const claudeResponse = textContent.text

    // Save feedback and response
    await prisma.optimizationAction.update({
      where: { id: actionId },
      data: {
        feedback,
        claudeResponse,
        feedbackAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      response: claudeResponse,
      isReport: generateReport,
    })
  } catch (error) {
    console.error('[Optimization Feedback] Error:', error)
    return NextResponse.json(
      { error: 'Error al procesar el feedback' },
      { status: 500 }
    )
  }
}

function buildFeedbackPrompt(
  action: {
    type: string
    claudeReason: string
    project: { name: string; context: string | null }
    dataSource: { accountName: string }
  },
  feedback: string,
  targetEntity: Record<string, unknown>,
  payload: Record<string, unknown>,
  metrics: Record<string, unknown> | null
): string {
  return `Eres un experto consultor de Google Ads. Un usuario ha dado feedback sobre una sugerencia de optimización que hiciste.

CONTEXTO DEL PROYECTO:
- Proyecto: ${action.project.name}
- Cuenta Google Ads: ${action.dataSource.accountName}
${action.project.context ? `- Contexto adicional: ${action.project.context}` : ''}

SUGERENCIA ORIGINAL:
- Tipo: ${action.type}
- Razón: ${action.claudeReason}
- Entidad objetivo: ${JSON.stringify(targetEntity, null, 2)}
- Payload: ${JSON.stringify(payload, null, 2)}
${metrics ? `- Métricas: ${JSON.stringify(metrics, null, 2)}` : ''}

FEEDBACK DEL USUARIO:
"${feedback}"

Por favor, responde al feedback del usuario de forma útil y constructiva:
1. Si expresa preocupación, explica los riesgos y posibles mitigaciones
2. Si pide más información, proporciona detalles adicionales
3. Si sugiere una alternativa, evalúa si es viable
4. Si está en desacuerdo, explica tu razonamiento pero respeta su decisión

Responde en español de forma concisa y profesional.`
}

function buildReportPrompt(
  action: {
    type: string
    claudeReason: string
    project: { name: string; context: string | null }
    dataSource: { accountName: string }
  },
  feedback: string,
  targetEntity: Record<string, unknown>,
  payload: Record<string, unknown>,
  metrics: Record<string, unknown> | null
): string {
  return `Eres un experto consultor de Google Ads. El usuario quiere un informe detallado sobre una sugerencia de optimización.

CONTEXTO DEL PROYECTO:
- Proyecto: ${action.project.name}
- Cuenta Google Ads: ${action.dataSource.accountName}
${action.project.context ? `- Contexto adicional: ${action.project.context}` : ''}

SUGERENCIA:
- Tipo: ${action.type}
- Razón: ${action.claudeReason}
- Entidad objetivo: ${JSON.stringify(targetEntity, null, 2)}
- Payload: ${JSON.stringify(payload, null, 2)}
${metrics ? `- Métricas actuales: ${JSON.stringify(metrics, null, 2)}` : ''}

SOLICITUD DEL USUARIO:
"${feedback}"

Genera un INFORME DETALLADO que incluya:

## Resumen Ejecutivo
Breve descripción de la sugerencia y por qué es importante.

## Análisis del Impacto Actual
- Métricas actuales afectadas
- Coste que se está generando
- Problemas identificados

## Impacto Estimado de la Implementación
- Ahorro estimado de coste
- Posible mejora en métricas (CTR, CPA, ROAS)
- Timeframe para ver resultados

## Riesgos y Consideraciones
- Posibles efectos negativos
- Casos donde podría no funcionar
- Mitigaciones sugeridas

## Recomendación Final
Tu recomendación profesional sobre si implementar esta acción.

Responde en español con formato Markdown.`
}
