import Anthropic from '@anthropic-ai/sdk'
import { AIGenerationResult } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface GenerateReportParams {
  projectContext: string
  reportPrompt: string
  csvData: Record<string, unknown>[]
  previousFeedback?: {
    approvedProposals: string[]
    rejectedProposals: string[]
    answeredQuestions: { question: string; answer: string }[]
  }
}

export async function generateReport(
  params: GenerateReportParams
): Promise<AIGenerationResult> {
  const startTime = Date.now()

  const systemPrompt = `Eres un analista de datos experto de la agencia We're Sinapsis.
Tu trabajo es generar informes analíticos profesionales en HTML.

REGLAS PARA EL HTML:
1. El HTML debe ser completo y autocontenido
2. Usa Apache ECharts para gráficos (incluye CDN: https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js)
3. Usa Tailwind CSS via CDN para estilos
4. Paleta de colores:
   - Primario: #215A6B
   - Acento: #F8AE00
   - Fondo: #F5F5F5
   - Texto: #1A1A1A
5. El informe debe incluir:
   - Resumen ejecutivo
   - Métricas principales con variaciones
   - Gráficos interactivos relevantes
   - Conclusiones y recomendaciones
6. Diseño responsive y profesional
7. Los gráficos deben usar los colores de marca

IMPORTANTE: Responde SOLO con un JSON válido con esta estructura exacta:
{
  "html": "<!DOCTYPE html>...",
  "questions": [
    {"question": "...", "context": "..."}
  ],
  "proposals": [
    {
      "type": "ACTION|INSIGHT|RISK|OPPORTUNITY",
      "title": "...",
      "description": "...",
      "priority": "LOW|MEDIUM|HIGH|CRITICAL"
    }
  ]
}`

  const userPrompt = `
CONTEXTO DEL PROYECTO:
${params.projectContext}

INSTRUCCIONES ESPECÍFICAS PARA ESTE INFORME:
${params.reportPrompt}

DATOS A ANALIZAR:
${JSON.stringify(params.csvData, null, 2)}

${params.previousFeedback ? `
FEEDBACK PREVIO (usa esto para mejorar tus análisis):
- Propuestas aprobadas: ${params.previousFeedback.approvedProposals.join(', ') || 'Ninguna'}
- Propuestas rechazadas: ${params.previousFeedback.rejectedProposals.join(', ') || 'Ninguna'}
- Preguntas respondidas: ${JSON.stringify(params.previousFeedback.answeredQuestions)}
` : ''}

Genera el informe siguiendo las instrucciones. Recuerda responder SOLO con JSON válido.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  })

  const duration = Date.now() - startTime
  const content = response.content[0]

  if (content.type !== 'text') {
    throw new Error('Respuesta inesperada de Claude')
  }

  // Parsear respuesta JSON
  const parsed = JSON.parse(content.text) as Omit<AIGenerationResult, 'metadata'>

  return {
    ...parsed,
    metadata: {
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      duration,
    },
  }
}

export async function generateOverview(
  projectContext: string,
  allReportsData: { title: string; summary: string; date: string }[],
  feedback: {
    approvedProposals: { title: string; description: string }[]
    rejectedProposals: { title: string; description: string }[]
    answeredQuestions: { question: string; answer: string }[]
  }
): Promise<AIGenerationResult> {
  const startTime = Date.now()

  const systemPrompt = `Eres un analista estratégico de la agencia We're Sinapsis.
Tu trabajo es generar un OVERVIEW/DASHBOARD ejecutivo del estado general de un proyecto.

Este overview debe:
1. Sintetizar la información de TODOS los informes generados
2. Mostrar KPIs principales y su evolución
3. Destacar tendencias, riesgos y oportunidades
4. Incluir las propuestas pendientes más relevantes
5. Mostrar un timeline de evolución del proyecto

Usa el mismo formato HTML que los informes individuales pero con enfoque de dashboard ejecutivo.
Incluye más gráficos de tendencias y comparativas.

Responde SOLO con JSON válido con la estructura: {html, questions, proposals}`

  const userPrompt = `
CONTEXTO DEL PROYECTO:
${projectContext}

RESUMEN DE INFORMES GENERADOS:
${JSON.stringify(allReportsData, null, 2)}

FEEDBACK ACUMULADO:
- Propuestas aprobadas: ${JSON.stringify(feedback.approvedProposals)}
- Propuestas rechazadas: ${JSON.stringify(feedback.rejectedProposals)}
- Conocimiento adquirido (preguntas respondidas): ${JSON.stringify(feedback.answeredQuestions)}

Genera un OVERVIEW ejecutivo que sintetice todo el conocimiento del proyecto.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  })

  const duration = Date.now() - startTime
  const content = response.content[0]

  if (content.type !== 'text') {
    throw new Error('Respuesta inesperada de Claude')
  }

  const parsed = JSON.parse(content.text) as Omit<AIGenerationResult, 'metadata'>

  return {
    ...parsed,
    metadata: {
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      duration,
    },
  }
}
