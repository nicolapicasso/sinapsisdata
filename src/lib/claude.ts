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

// Funcion para extraer JSON de la respuesta de Claude
function extractJSON(text: string): string {
  // Intentar extraer JSON de bloques de codigo markdown
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim()
  }

  // Intentar encontrar el JSON directamente (buscar el primer { y ultimo })
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1)
  }

  // Si no encontramos nada, devolver el texto original
  return text.trim()
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
4. TIPOGRAFÍA: Usa siempre Montserrat como fuente principal
   - Incluye Google Fonts: <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
   - Aplica a todo el documento: font-family: 'Montserrat', sans-serif;
5. Paleta de colores:
   - Primario: #215A6B
   - Acento: #F8AE00
   - Fondo: #F5F5F5
   - Texto: #1A1A1A
6. El informe debe incluir:
   - Resumen ejecutivo
   - Métricas principales con variaciones
   - Gráficos interactivos relevantes
   - Conclusiones y recomendaciones
7. Diseño responsive y profesional
8. Los gráficos deben usar los colores de marca

IMPORTANTE: Responde SOLO con un JSON válido (sin bloques de codigo markdown) con esta estructura exacta:
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
${params.projectContext || 'No hay contexto adicional'}

INSTRUCCIONES ESPECÍFICAS PARA ESTE INFORME:
${params.reportPrompt}

DATOS A ANALIZAR:
${JSON.stringify(params.csvData.slice(0, 500), null, 2)}
${params.csvData.length > 500 ? `\n... (${params.csvData.length - 500} filas adicionales omitidas)` : ''}

${params.previousFeedback ? `
FEEDBACK PREVIO (usa esto para mejorar tus análisis):
- Propuestas aprobadas: ${params.previousFeedback.approvedProposals.join(', ') || 'Ninguna'}
- Propuestas rechazadas: ${params.previousFeedback.rejectedProposals.join(', ') || 'Ninguna'}
- Preguntas respondidas: ${JSON.stringify(params.previousFeedback.answeredQuestions)}
` : ''}

Genera el informe siguiendo las instrucciones. Responde SOLO con JSON válido, sin bloques de codigo markdown.`

  console.log('[Claude] Iniciando generacion de informe...')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  })

  const duration = Date.now() - startTime
  console.log(`[Claude] Respuesta recibida en ${duration}ms`)

  const content = response.content[0]

  if (content.type !== 'text') {
    throw new Error('Respuesta inesperada de Claude: no es texto')
  }

  console.log(`[Claude] Longitud de respuesta: ${content.text.length} caracteres`)

  // Extraer y parsear JSON
  const jsonText = extractJSON(content.text)

  let parsed: Omit<AIGenerationResult, 'metadata'>
  try {
    parsed = JSON.parse(jsonText)
  } catch (parseError) {
    console.error('[Claude] Error parseando JSON:', parseError)
    console.error('[Claude] Texto recibido (primeros 500 chars):', content.text.slice(0, 500))
    throw new Error(`Error parseando respuesta de Claude: ${parseError instanceof Error ? parseError.message : 'JSON invalido'}`)
  }

  // Validar estructura minima
  if (!parsed.html) {
    throw new Error('La respuesta de Claude no contiene HTML')
  }

  // Asegurar que questions y proposals son arrays
  if (!Array.isArray(parsed.questions)) {
    parsed.questions = []
  }
  if (!Array.isArray(parsed.proposals)) {
    parsed.proposals = []
  }

  console.log(`[Claude] Informe generado: ${parsed.html.length} chars HTML, ${parsed.questions.length} preguntas, ${parsed.proposals.length} propuestas`)

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

// Función para refinar/modificar un informe existente
export async function refineReport(params: {
  currentHtml: string
  refinementPrompt: string
  projectContext?: string
}): Promise<{ html: string; metadata: { model: string; inputTokens: number; outputTokens: number; duration: number } }> {
  const startTime = Date.now()

  const systemPrompt = `Eres un analista de datos experto de la agencia We're Sinapsis.
Tu trabajo es MODIFICAR un informe HTML existente basándote en las instrucciones del usuario.

REGLAS:
1. Mantén la estructura general y estilos del informe original
2. Aplica SOLO los cambios solicitados
3. No elimines secciones a menos que se pida explícitamente
4. Mantén los gráficos ECharts funcionando
5. Respeta la paleta de colores: Primario #215A6B, Acento #F8AE00
6. Mantén siempre la tipografía Montserrat (font-family: 'Montserrat', sans-serif)

IMPORTANTE: Responde SOLO con el HTML modificado completo (sin bloques de código markdown, sin explicaciones).`

  const userPrompt = `
${params.projectContext ? `CONTEXTO DEL PROYECTO:\n${params.projectContext}\n\n` : ''}
INFORME HTML ACTUAL:
${params.currentHtml}

CAMBIOS SOLICITADOS:
${params.refinementPrompt}

Aplica los cambios y devuelve el HTML completo modificado. Solo el HTML, sin explicaciones ni bloques de código.`

  console.log('[Claude] Iniciando refinamiento de informe...')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  })

  const duration = Date.now() - startTime
  console.log(`[Claude] Refinamiento completado en ${duration}ms`)

  const content = response.content[0]

  if (content.type !== 'text') {
    throw new Error('Respuesta inesperada de Claude')
  }

  // Extraer HTML (puede venir envuelto en bloques de código)
  let html = content.text.trim()

  // Remover bloques de código markdown si los hay
  const htmlBlockMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/)
  if (htmlBlockMatch) {
    html = htmlBlockMatch[1].trim()
  }

  // Validar que parece HTML
  if (!html.includes('<!DOCTYPE') && !html.includes('<html') && !html.includes('<div')) {
    throw new Error('La respuesta no parece contener HTML válido')
  }

  return {
    html,
    metadata: {
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      duration,
    },
  }
}

// Tipos para el Overview
interface OverviewReportData {
  title: string
  createdAt: string // formato "DD MMM YYYY"
  periodFrom?: string
  periodTo?: string
  htmlContent: string | null
  executiveSummary: string | null
}

interface OverviewParams {
  project: {
    name: string
    description: string | null
    aiContext: string | null
  }
  reports: OverviewReportData[]
  approvedProposals: {
    type: string
    title: string
    description: string
    votedAt?: Date
  }[]
  answeredQuestions: {
    question: string
    answer: string
  }[]
  rejectedProposalTitles: string[]
}

interface OverviewResult {
  html: string
  projectStatus: 'GREEN' | 'YELLOW' | 'RED'
  summary: string
  metadata: {
    model: string
    inputTokens: number
    outputTokens: number
    duration: number
  }
}

export async function generateOverview(params: OverviewParams): Promise<OverviewResult> {
  const startTime = Date.now()

  const systemPrompt = `Eres un analista estratégico senior de la agencia We're Sinapsis.
Tu trabajo es generar un OVERVIEW EJECUTIVO del estado de un proyecto.

## TU OBJETIVO
Crear un dashboard que responda en 10 segundos a: "¿Cómo va el proyecto?"

## ESTRUCTURA OBLIGATORIA DEL HTML

### 1. CABECERA
- Nombre del proyecto
- Fecha de actualización
- Badge de estado:
  - 🟢 "En buen camino" - mayoría de indicadores positivos
  - 🟡 "Requiere atención" - hay áreas de mejora importantes
  - 🔴 "En riesgo" - problemas críticos detectados

### 2. RESUMEN EJECUTIVO
- Exactamente 2-3 párrafos cortos
- Primer párrafo: situación actual
- Segundo párrafo: principales logros o problemas
- Tercer párrafo: hacia dónde vamos
- Tono: directo, ejecutivo, sin tecnicismos

### 3. KPIS PRINCIPALES
- Grid de 4 cards máximo
- Cada KPI muestra:
  - Nombre del KPI
  - Valor actual (número grande, destacado)
  - Comparativa: "▲ +X%" (verde) o "▼ -X%" (rojo) o "= sin cambios" (gris)
- Selecciona los 4 KPIs MÁS RELEVANTES de todos los informes
- Si no hay datos comparativos, muestra solo el valor actual sin inventar

### 4. EVOLUCIÓN DEL PROYECTO
- Lista cronológica simple (NO gráfico)
- Un ítem por informe, ordenado por fecha (más reciente primero)
- Formato por ítem:
  📊 [DD MMM YYYY] - [Título del informe]
  → [Conclusión clave en 1 línea]
- Máximo 10 ítems

### 5. CHECKPOINTS / HITOS
- Lista de logros derivados de propuestas APROBADAS
- Iconos según estado:
  - ✅ Completado
  - 🔄 En progreso
  - ⏳ Pendiente
- Máximo 6 ítems

### 6. INSIGHTS CLAVE
- Máximo 5 insights
- Formato: 💡 "[Insight accionable en una frase]"
- Derivados de: conclusiones de informes + propuestas aprobadas + respuestas a preguntas

### 7. DISTRIBUCIÓN (SOLO SI APLICA)
- Incluir ÚNICAMENTE si hay datos claros de distribución en los informes
- Máximo 2 gráficos de tarta (pie chart) con Apache ECharts
- Ejemplos válidos: fuentes de tráfico, canales de venta, segmentos
- Si no hay datos de distribución, OMITIR COMPLETAMENTE esta sección

### 8. PRÓXIMOS PASOS
- Lista numerada de 3-5 acciones concretas
- Priorizadas por impacto
- Derivadas del análisis y propuestas aprobadas

### 9. CONTEXTO APRENDIDO
- Sección secundaria con fondo gris claro
- Conocimientos adquiridos del proyecto (de preguntas respondidas)
- Bullet points simples
- Ayuda a entender el "por qué" de las recomendaciones

## REGLAS CRÍTICAS

1. **PROPUESTAS RECHAZADAS**:
   Se proporciona lista de propuestas rechazadas.
   NO menciones nada similar. NO las listes. Simplemente evita sugerir cosas parecidas.
   Son "territorio prohibido" silencioso.

2. **CONSISTENCIA VISUAL**:
   Todos los overviews deben tener la misma estructura.
   La diferencia es el contenido, no el formato.

3. **GRÁFICOS PERMITIDOS**:
   - ❌ NO gráficos de líneas
   - ❌ NO gráficos de barras
   - ✅ Gráficos de tarta SOLO si hay datos de distribución claros
   - Si dudas, no incluyas gráficos

4. **DATOS COMPARATIVOS**:
   - Si hay múltiples informes, detecta tendencias por fechas
   - Si solo hay 1 informe, NO inventes comparativas
   - Sé honesto con los datos disponibles

5. **TONO**:
   - Profesional pero accesible
   - Orientado a resultados
   - Sin alarmismo innecesario
   - Sin optimismo injustificado

## ESPECIFICACIONES TÉCNICAS HTML

- HTML5 completo y autocontenido
- CDN Tailwind CSS: https://cdn.tailwindcss.com
- CDN ECharts (solo si hay tartas): https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js
- TIPOGRAFÍA: Usar siempre Montserrat como fuente principal
  - Incluir: <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  - Aplicar: font-family: 'Montserrat', sans-serif;
- Responsive design
- Paleta:
  - Primario: #215A6B
  - Acento: #F8AE00
  - Fondo: #F5F5F5
  - Texto: #1A1A1A
  - Éxito/positivo: #10B981
  - Alerta/atención: #F59E0B
  - Error/negativo: #EF4444

## FORMATO DE RESPUESTA

Responde ÚNICAMENTE con JSON válido:

{
  "html": "<!DOCTYPE html>...",
  "projectStatus": "GREEN" | "YELLOW" | "RED",
  "summary": "Resumen de 1 línea del estado del proyecto"
}

NO incluyas explicaciones fuera del JSON.
NO uses markdown fuera del JSON.
SOLO el JSON.`

  // Construir el user prompt con todos los datos
  let userPrompt = `## INFORMACIÓN DEL PROYECTO

Nombre: ${params.project.name}
Descripción: ${params.project.description || 'Sin descripción'}
Contexto adicional: ${params.project.aiContext || 'Sin contexto adicional'}

## INFORMES GENERADOS (ordenados del más reciente al más antiguo)

`

  if (params.reports.length === 0) {
    userPrompt += 'No hay informes generados todavía.\n'
  } else {
    for (const report of params.reports) {
      userPrompt += `### Informe: ${report.title}
Fecha: ${report.createdAt}
${report.periodFrom && report.periodTo ? `Período analizado: ${report.periodFrom} - ${report.periodTo}` : ''}
${report.executiveSummary ? `Resumen ejecutivo: ${report.executiveSummary}` : ''}

${report.htmlContent ? `Contenido del informe (HTML):
${report.htmlContent.substring(0, 15000)}${report.htmlContent.length > 15000 ? '\n... (contenido truncado)' : ''}` : 'Sin contenido HTML disponible'}

---

`
    }
  }

  userPrompt += `## PROPUESTAS APROBADAS

`
  if (params.approvedProposals.length === 0) {
    userPrompt += 'Ninguna propuesta aprobada todavía.\n'
  } else {
    for (const proposal of params.approvedProposals) {
      userPrompt += `- [${proposal.type}] ${proposal.title}
  ${proposal.description}
  ${proposal.votedAt ? `Aprobada: ${proposal.votedAt.toLocaleDateString('es-ES')}` : ''}

`
    }
  }

  userPrompt += `## CONOCIMIENTO ADQUIRIDO (preguntas respondidas)

`
  if (params.answeredQuestions.length === 0) {
    userPrompt += 'No hay preguntas respondidas todavía.\n'
  } else {
    for (const qa of params.answeredQuestions) {
      userPrompt += `P: ${qa.question}
R: ${qa.answer}

`
    }
  }

  userPrompt += `## TERRITORIO PROHIBIDO (evitar sugerir cosas similares)

`
  if (params.rejectedProposalTitles.length === 0) {
    userPrompt += 'Sin restricciones.\n'
  } else {
    for (const title of params.rejectedProposalTitles) {
      userPrompt += `- ${title}\n`
    }
  }

  userPrompt += `
---

Genera el OVERVIEW EJECUTIVO siguiendo exactamente las instrucciones del sistema.`

  console.log('[Claude] Iniciando generacion de overview ejecutivo...')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt,
  })

  const duration = Date.now() - startTime
  console.log(`[Claude] Overview recibido en ${duration}ms`)

  const content = response.content[0]

  if (content.type !== 'text') {
    throw new Error('Respuesta inesperada de Claude')
  }

  const jsonText = extractJSON(content.text)

  let parsed: { html: string; projectStatus: 'GREEN' | 'YELLOW' | 'RED'; summary: string }
  try {
    parsed = JSON.parse(jsonText)
  } catch (parseError) {
    console.error('[Claude] Error parseando JSON del overview:', parseError)
    console.error('[Claude] Texto recibido (primeros 500 chars):', content.text.slice(0, 500))
    throw new Error(`Error parseando respuesta de Claude: ${parseError instanceof Error ? parseError.message : 'JSON invalido'}`)
  }

  if (!parsed.html) {
    throw new Error('La respuesta de Claude no contiene HTML')
  }

  // Validar projectStatus
  const validStatuses = ['GREEN', 'YELLOW', 'RED']
  if (!validStatuses.includes(parsed.projectStatus)) {
    parsed.projectStatus = 'YELLOW' // Default si no es válido
  }

  if (!parsed.summary) {
    parsed.summary = 'Overview generado'
  }

  console.log(`[Claude] Overview generado: ${parsed.html.length} chars HTML, status: ${parsed.projectStatus}`)

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
