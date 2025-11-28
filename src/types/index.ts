import {
  User,
  Project,
  Report,
  ReportFile,
  AIQuestion as PrismaAIQuestion,
  AIProposal as PrismaAIProposal,
  ProjectMember
} from '@prisma/client'

// Re-exportar tipos de Prisma
export type { PrismaAIQuestion, PrismaAIProposal }

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

// Extender tipos de NextAuth
declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }

  interface User {
    id: string
    role: string
    avatar?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    avatar?: string
  }
}
