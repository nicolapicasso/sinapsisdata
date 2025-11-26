# Sinapsis Data - Especificaciones Técnicas

## Información del Proyecto

- **Nombre**: Sinapsis Data
- **URL**: https://data.sinapsis.agency
- **Descripción**: Plataforma interna de analítica y reporting potenciada por IA para la agencia We're Sinapsis
- **Idioma**: Español

---

## Paleta de Colores

```
Primario (azul petróleo):  #215A6B
Acento (amarillo):         #F8AE00
Negro:                     #1A1A1A
Blanco:                    #FFFFFF
Gris claro (fondos):       #F5F5F5
Gris medio (bordes):       #E5E5E5
Gris texto secundario:     #6B7280
```

---

## Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|------------|---------|
| Framework | Next.js | 14.x (App Router) |
| Lenguaje | TypeScript | 5.x |
| Base de datos | MySQL | 8.x |
| ORM | Prisma | 5.x |
| Autenticación | NextAuth.js | 4.x |
| UI Components | shadcn/ui | latest |
| Estilos | Tailwind CSS | 3.x |
| Gráficos | Apache ECharts | 5.x |
| Almacenamiento | Sistema de archivos local | - |
| IA | Claude API (Anthropic) | claude-sonnet-4-20250514 |
| Deploy | PM2 + Nginx | - |

---

## Estructura de Carpetas

```
sinapsis-data/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/
│   ├── logo.svg
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── projects/
│   │   │   │   ├── [slug]/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── reports/
│   │   │   │   │   │   ├── new/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── [reportId]/
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   ├── questions/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── proposals/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── settings/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── new/
│   │   │   │       └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── admin/
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   ├── projects/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts
│   │   │   ├── projects/
│   │   │   │   ├── route.ts
│   │   │   │   └── [slug]/
│   │   │   │       └── route.ts
│   │   │   ├── reports/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── generate/
│   │   │   │       └── route.ts
│   │   │   ├── questions/
│   │   │   │   └── route.ts
│   │   │   ├── proposals/
│   │   │   │   └── route.ts
│   │   │   ├── upload/
│   │   │   │   └── route.ts
│   │   │   └── users/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── projects/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectHeader.tsx
│   │   │   └── ProjectForm.tsx
│   │   ├── reports/
│   │   │   ├── ReportCard.tsx
│   │   │   ├── ReportForm.tsx
│   │   │   ├── ReportViewer.tsx
│   │   │   └── FileUploader.tsx
│   │   ├── ai/
│   │   │   ├── QuestionCard.tsx
│   │   │   ├── ProposalCard.tsx
│   │   │   └── OverviewDashboard.tsx
│   │   └── charts/
│   │       └── EChartsWrapper.tsx
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── claude.ts
│   │   ├── csv-parser.ts
│   │   ├── file-storage.ts
│   │   └── utils.ts
│   ├── types/
│   │   └── index.ts
│   └── hooks/
│       ├── useProjects.ts
│       └── useReports.ts
├── storage/
│   ├── uploads/                   # CSVs subidos
│   ├── logos/                     # Logos de proyectos
│   └── covers/                    # Imágenes de portada
├── .env
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Schema de Prisma

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ============================================
// USUARIOS
// ============================================

enum UserRole {
  ADMIN
  CONSULTANT
  CLIENT
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String
  name          String
  avatar        String?
  role          UserRole  @default(CLIENT)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relaciones
  projectMembers  ProjectMember[]
  createdReports  Report[]         @relation("ReportCreator")
  answeredQuestions AIQuestion[]   @relation("QuestionAnswerer")
  votedProposals    AIProposal[]   @relation("ProposalVoter")

  @@map("users")
}

// ============================================
// PROYECTOS
// ============================================

enum ProjectStatus {
  ACTIVE
  PAUSED
  ARCHIVED
}

model Project {
  id            String        @id @default(cuid())
  name          String
  slug          String        @unique
  description   String?       @db.Text
  logo          String?
  coverImage    String?
  websiteUrl    String?
  mondayBoardUrl String?
  
  // Redes sociales (JSON)
  socialLinks   Json?         // {instagram, youtube, facebook, linkedin, twitter}
  
  // Contexto para IA
  aiContext     String?       @db.Text
  
  status        ProjectStatus @default(ACTIVE)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  // Relaciones
  members       ProjectMember[]
  reports       Report[]
  questions     AIQuestion[]
  proposals     AIProposal[]
  dataSources   DataSource[]

  @@map("projects")
}

enum ProjectMemberRole {
  OWNER
  CONSULTANT
  CLIENT
}

model ProjectMember {
  id        String            @id @default(cuid())
  projectId String
  userId    String
  role      ProjectMemberRole @default(CLIENT)
  createdAt DateTime          @default(now())

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@map("project_members")
}

// ============================================
// INFORMES
// ============================================

enum ReportType {
  CUSTOM
  OVERVIEW
}

enum ReportStatus {
  DRAFT
  PROCESSING
  READY
  ERROR
}

model Report {
  id          String       @id @default(cuid())
  projectId   String
  title       String
  description String?      @db.Text
  type        ReportType   @default(CUSTOM)
  status      ReportStatus @default(DRAFT)
  
  // Prompt e instrucciones para IA
  prompt      String       @db.Text
  
  // HTML generado por IA
  htmlContent String?      @db.LongText
  
  // Metadata de la generación
  aiMetadata  Json?        // {model, tokens, duration, etc.}
  
  // Período del informe
  periodFrom  DateTime?
  periodTo    DateTime?
  
  // Error si falló
  errorMessage String?     @db.Text
  
  createdById String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  // Relaciones
  project     Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy   User         @relation("ReportCreator", fields: [createdById], references: [id])
  files       ReportFile[]
  questions   AIQuestion[]
  proposals   AIProposal[]

  @@map("reports")
}

model ReportFile {
  id           String   @id @default(cuid())
  reportId     String
  filename     String   // Nombre en storage
  originalName String   // Nombre original
  mimeType     String
  size         Int
  path         String   // Ruta completa en storage
  
  // Datos parseados del CSV
  parsedData   Json?    @db.Json
  
  // Metadatos extraídos
  columns      Json?    // Columnas detectadas
  rowCount     Int?     // Número de filas
  
  createdAt    DateTime @default(now())

  report       Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@map("report_files")
}

// ============================================
// SISTEMA DE FEEDBACK IA
// ============================================

enum QuestionStatus {
  PENDING
  ANSWERED
  DISMISSED
}

model AIQuestion {
  id           String         @id @default(cuid())
  projectId    String
  reportId     String?
  
  question     String         @db.Text
  context      String?        @db.Text  // Por qué la IA hace esta pregunta
  
  answer       String?        @db.Text
  answeredById String?
  answeredAt   DateTime?
  
  status       QuestionStatus @default(PENDING)
  createdAt    DateTime       @default(now())

  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  report       Report?  @relation(fields: [reportId], references: [id], onDelete: SetNull)
  answeredBy   User?    @relation("QuestionAnswerer", fields: [answeredById], references: [id])

  @@map("ai_questions")
}

enum ProposalType {
  ACTION      // Propuesta de acción
  INSIGHT     // Insight/descubrimiento
  RISK        // Riesgo detectado
  OPPORTUNITY // Oportunidad
}

enum ProposalPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ProposalStatus {
  PENDING
  APPROVED
  REJECTED
}

model AIProposal {
  id          String           @id @default(cuid())
  projectId   String
  reportId    String?
  
  type        ProposalType
  title       String
  description String           @db.Text
  priority    ProposalPriority @default(MEDIUM)
  
  // Datos adicionales según el tipo
  metadata    Json?            // {suggestedActions, metrics, etc.}
  
  status      ProposalStatus   @default(PENDING)
  votedById   String?
  votedAt     DateTime?
  voteComment String?          @db.Text  // Comentario del voto
  
  createdAt   DateTime         @default(now())

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  report      Report?  @relation(fields: [reportId], references: [id], onDelete: SetNull)
  votedBy     User?    @relation("ProposalVoter", fields: [votedById], references: [id])

  @@map("ai_proposals")
}

// ============================================
// FUENTES DE DATOS (Fase 2 - Opcional)
// ============================================

enum DataSourceType {
  GOOGLE_ANALYTICS
  GOOGLE_ADS
  GOOGLE_MERCHANT
  META_ADS
  INSTAGRAM
  YOUTUBE
  CUSTOM_API
}

enum DataSourceStatus {
  CONNECTED
  ERROR
  EXPIRED
  PENDING
}

model DataSource {
  id          String           @id @default(cuid())
  projectId   String
  
  type        DataSourceType
  name        String           // Nombre descriptivo
  
  // Credenciales (encriptadas)
  credentials String           @db.Text
  
  // Configuración específica
  config      Json?
  
  status      DataSourceStatus @default(PENDING)
  lastSyncAt  DateTime?
  lastError   String?          @db.Text
  
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("data_sources")
}
```

---

## Configuración de Variables de Entorno

```env
# .env.example

# Base de datos
DATABASE_URL="mysql://usuario:password@localhost:3306/sinapsis_data"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-secret-muy-seguro-aqui"

# Anthropic (Claude)
ANTHROPIC_API_KEY="sk-ant-..."

# Almacenamiento
STORAGE_PATH="./storage"

# App
NEXT_PUBLIC_APP_NAME="Sinapsis Data"
NEXT_PUBLIC_APP_URL="https://data.sinapsis.agency"
```

---

## Configuración de Tailwind

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#215A6B',
          50: '#E8F4F6',
          100: '#C5E3E9',
          200: '#9ECFD9',
          300: '#77BBC9',
          400: '#4FA7B9',
          500: '#215A6B',
          600: '#1C4D5C',
          700: '#17404D',
          800: '#12333E',
          900: '#0D262F',
        },
        accent: {
          DEFAULT: '#F8AE00',
          50: '#FFF8E5',
          100: '#FFECB3',
          200: '#FFE080',
          300: '#FFD44D',
          400: '#FFC81A',
          500: '#F8AE00',
          600: '#CC8F00',
          700: '#997000',
          800: '#665100',
          900: '#333200',
        },
        dark: '#1A1A1A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

---

## Tipos TypeScript

```typescript
// src/types/index.ts

import { 
  User, 
  Project, 
  Report, 
  ReportFile,
  AIQuestion,
  AIProposal,
  ProjectMember
} from '@prisma/client'

// Usuario con relaciones
export type UserWithProjects = User & {
  projectMembers: (ProjectMember & {
    project: Project
  })[]
}

// Proyecto con relaciones
export type ProjectWithMembers = Project & {
  members: (ProjectMember & {
    user: Pick<User, 'id' | 'name' | 'email' | 'avatar'>
  })[]
}

export type ProjectWithReports = Project & {
  reports: Report[]
  _count: {
    reports: number
    questions: number
    proposals: number
  }
}

// Informe con relaciones
export type ReportWithFiles = Report & {
  files: ReportFile[]
  createdBy: Pick<User, 'id' | 'name' | 'email'>
}

// Respuesta de generación IA
export interface AIGenerationResult {
  html: string
  questions: {
    question: string
    context: string
  }[]
  proposals: {
    type: 'ACTION' | 'INSIGHT' | 'RISK' | 'OPPORTUNITY'
    title: string
    description: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    metadata?: Record<string, unknown>
  }[]
  metadata: {
    model: string
    inputTokens: number
    outputTokens: number
    duration: number
  }
}

// Redes sociales del proyecto
export interface SocialLinks {
  instagram?: string
  youtube?: string
  facebook?: string
  linkedin?: string
  twitter?: string
}

// Formulario de creación de informe
export interface CreateReportInput {
  projectId: string
  title: string
  description?: string
  prompt: string
  periodFrom?: Date
  periodTo?: Date
  files: File[]
}

// Session extendida
export interface SessionUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'CONSULTANT' | 'CLIENT'
  avatar?: string
}
```

---

## Lib: Cliente de Claude

```typescript
// src/lib/claude.ts

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
```

---

## Lib: Parser de CSV

```typescript
// src/lib/csv-parser.ts

import Papa from 'papaparse'

export interface ParsedCSV {
  data: Record<string, unknown>[]
  columns: string[]
  rowCount: number
  errors: string[]
}

export function parseCSV(content: string): ParsedCSV {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
  })

  return {
    data: result.data as Record<string, unknown>[],
    columns: result.meta.fields || [],
    rowCount: result.data.length,
    errors: result.errors.map((e) => e.message),
  }
}

export async function parseCSVFile(file: File): Promise<ParsedCSV> {
  const content = await file.text()
  return parseCSV(content)
}
```

---

## Lib: Almacenamiento de Archivos

```typescript
// src/lib/file-storage.ts

import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const STORAGE_PATH = process.env.STORAGE_PATH || './storage'

type StorageFolder = 'uploads' | 'logos' | 'covers'

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function saveFile(
  file: File,
  folder: StorageFolder
): Promise<{ filename: string; path: string; size: number }> {
  const dir = path.join(STORAGE_PATH, folder)
  await ensureDir(dir)

  const ext = path.extname(file.name)
  const filename = `${randomUUID()}${ext}`
  const filePath = path.join(dir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  return {
    filename,
    path: filePath,
    size: buffer.length,
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await unlink(filePath)
  }
}

export function getFileUrl(folder: StorageFolder, filename: string): string {
  return `/api/files/${folder}/${filename}`
}
```

---

## API: Generación de Informes

```typescript
// src/app/api/reports/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateReport } from '@/lib/claude'
import { parseCSV } from '@/lib/csv-parser'
import { readFile } from 'fs/promises'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { reportId } = await req.json()

    // Obtener informe con archivos y proyecto
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        files: true,
        project: true,
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
    }

    // Actualizar estado a procesando
    await prisma.report.update({
      where: { id: reportId },
      data: { status: 'PROCESSING' },
    })

    // Parsear todos los CSVs
    const allData: Record<string, unknown>[] = []
    for (const file of report.files) {
      if (file.mimeType === 'text/csv') {
        const content = await readFile(file.path, 'utf-8')
        const parsed = parseCSV(content)
        
        // Guardar datos parseados
        await prisma.reportFile.update({
          where: { id: file.id },
          data: {
            parsedData: parsed.data,
            columns: parsed.columns,
            rowCount: parsed.rowCount,
          },
        })
        
        allData.push(...parsed.data)
      }
    }

    // Obtener feedback previo del proyecto
    const [approvedProposals, rejectedProposals, answeredQuestions] = await Promise.all([
      prisma.aIProposal.findMany({
        where: { projectId: report.projectId, status: 'APPROVED' },
        select: { title: true },
      }),
      prisma.aIProposal.findMany({
        where: { projectId: report.projectId, status: 'REJECTED' },
        select: { title: true },
      }),
      prisma.aIQuestion.findMany({
        where: { projectId: report.projectId, status: 'ANSWERED' },
        select: { question: true, answer: true },
      }),
    ])

    // Generar informe con IA
    const result = await generateReport({
      projectContext: report.project.aiContext || report.project.description || '',
      reportPrompt: report.prompt,
      csvData: allData,
      previousFeedback: {
        approvedProposals: approvedProposals.map((p) => p.title),
        rejectedProposals: rejectedProposals.map((p) => p.title),
        answeredQuestions: answeredQuestions.map((q) => ({
          question: q.question,
          answer: q.answer!,
        })),
      },
    })

    // Guardar resultado
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'READY',
        htmlContent: result.html,
        aiMetadata: result.metadata,
      },
    })

    // Crear preguntas
    if (result.questions.length > 0) {
      await prisma.aIQuestion.createMany({
        data: result.questions.map((q) => ({
          projectId: report.projectId,
          reportId: reportId,
          question: q.question,
          context: q.context,
        })),
      })
    }

    // Crear propuestas
    if (result.proposals.length > 0) {
      await prisma.aIProposal.createMany({
        data: result.proposals.map((p) => ({
          projectId: report.projectId,
          reportId: reportId,
          type: p.type,
          title: p.title,
          description: p.description,
          priority: p.priority,
          metadata: p.metadata,
        })),
      })
    }

    return NextResponse.json({ success: true, reportId })
  } catch (error) {
    console.error('Error generando informe:', error)
    
    // Marcar como error si tenemos reportId
    const body = await req.clone().json()
    if (body.reportId) {
      await prisma.report.update({
        where: { id: body.reportId },
        data: {
          status: 'ERROR',
          errorMessage: error instanceof Error ? error.message : 'Error desconocido',
        },
      })
    }

    return NextResponse.json(
      { error: 'Error generando informe' },
      { status: 500 }
    )
  }
}
```

---

## Componente: Visor de Informe

```typescript
// src/components/reports/ReportViewer.tsx

'use client'

import { useEffect, useRef } from 'react'

interface ReportViewerProps {
  htmlContent: string
  title: string
}

export function ReportViewer({ htmlContent, title }: ReportViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(htmlContent)
        doc.close()
      }
    }
  }, [htmlContent])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <h1 className="text-xl font-semibold text-dark">{title}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600 transition"
          >
            Exportar PDF
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0"
        title={title}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
```

---

## Componente: Upload de Archivos

```typescript
// src/components/reports/FileUploader.tsx

'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploaderProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  maxFiles?: number
  accept?: Record<string, string[]>
}

export function FileUploader({
  files,
  onFilesChange,
  maxFiles = 10,
  accept = { 'text/csv': ['.csv'] },
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles)
      onFilesChange(newFiles)
    },
    [files, maxFiles, onFilesChange]
  )

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: maxFiles - files.length,
  })

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary-50'
            : 'border-gray-300 hover:border-primary hover:bg-gray-50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 mx-auto text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-primary font-medium">Suelta los archivos aquí...</p>
        ) : (
          <div>
            <p className="text-gray-600 font-medium">
              Arrastra archivos CSV aquí o haz clic para seleccionar
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Máximo {maxFiles} archivos
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-dark">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-gray-200 rounded transition"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

---

## Permisos y Roles

### Matriz de Permisos

| Acción | ADMIN | CONSULTANT | CLIENT |
|--------|-------|------------|--------|
| Ver todos los proyectos | ✅ | ❌ | ❌ |
| Ver proyectos asignados | ✅ | ✅ | ✅ |
| Crear proyectos | ✅ | ✅ | ❌ |
| Editar proyectos | ✅ | ✅* | ❌ |
| Eliminar proyectos | ✅ | ❌ | ❌ |
| Crear informes | ✅ | ✅ | ❌ |
| Ver informes | ✅ | ✅ | ✅* |
| Responder preguntas IA | ✅ | ✅ | ✅ |
| Votar propuestas | ✅ | ✅ | ✅ |
| Gestionar usuarios | ✅ | ❌ | ❌ |
| Ver Overview | ✅ | ✅ | ✅* |

*Solo en proyectos donde están asignados

---

## Fases de Desarrollo

### Fase 1: Core (Semana 1-2)

1. **Setup inicial**
   - [ ] Crear proyecto Next.js con TypeScript
   - [ ] Configurar Tailwind + shadcn/ui
   - [ ] Configurar Prisma + MySQL
   - [ ] Configurar NextAuth

2. **Autenticación**
   - [ ] Login/Logout
   - [ ] Middleware de protección de rutas
   - [ ] Gestión de sesiones

3. **Usuarios (Admin)**
   - [ ] CRUD de usuarios
   - [ ] Asignación de roles

4. **Proyectos**
   - [ ] CRUD de proyectos
   - [ ] Asignación de miembros
   - [ ] Vista de proyecto con tabs

5. **Informes básicos**
   - [ ] Subida de CSVs
   - [ ] Formulario de creación
   - [ ] Integración con Claude API
   - [ ] Visor de informes HTML

### Fase 2: Inteligencia (Semana 3)

6. **Sistema de preguntas**
   - [ ] Listado de preguntas pendientes
   - [ ] Responder preguntas
   - [ ] Histórico

7. **Sistema de propuestas**
   - [ ] Listado de propuestas
   - [ ] Votación OK/KO
   - [ ] Feedback al sistema

8. **Overview**
   - [ ] Generación automática
   - [ ] Dashboard ejecutivo
   - [ ] KPIs agregados

### Fase 3: Polish (Semana 4)

9. **UX/UI**
   - [ ] Animaciones y transiciones
   - [ ] Estados de carga
   - [ ] Mensajes de error/éxito
   - [ ] Responsive

10. **Extras**
    - [ ] Exportar a PDF
    - [ ] Notificaciones por email (opcional)
    - [ ] Logs de actividad

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Configurar base de datos
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed

# Desarrollo
npm run dev

# Build producción
npm run build
npm start

# Con PM2
pm2 start npm --name "sinapsis-data" -- start
```

---

## Notas para Claude Code

1. **Empezar por**: Setup del proyecto, Prisma schema, y autenticación básica
2. **Priorizar**: Funcionalidad sobre diseño en primera iteración
3. **Testing**: Probar generación de informes con CSVs pequeños primero
4. **API Claude**: Manejar errores y timeouts (puede tardar 30-60s en generar)
5. **Archivos grandes**: Limitar tamaño de CSV a 5MB inicialmente

---

## Contacto

Proyecto desarrollado para We're Sinapsis
URL de producción: https://data.sinapsis.agency
