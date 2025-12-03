import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Función para generar slug a partir del título
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Solo alfanuméricos, espacios y guiones
    .trim()
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-') // Múltiples guiones a uno
}

// Función para asegurar que el slug sea único dentro del proyecto
async function ensureUniqueSlug(projectId: string, baseSlug: string, excludeReportId?: string): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await prisma.report.findFirst({
      where: {
        projectId,
        slug,
        id: excludeReportId ? { not: excludeReportId } : undefined,
      },
    })

    if (!existing) {
      return slug
    }

    slug = `${baseSlug}-${counter}`
    counter++
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admin y consultores pueden publicar
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const { id } = params
    const { isPublished, isPublic } = await req.json()

    // Obtener el informe actual para generar el slug
    const currentReport = await prisma.report.findUnique({
      where: { id },
      select: {
        title: true,
        slug: true,
        projectId: true,
        project: { select: { slug: true } },
      },
    })

    if (!currentReport) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
    }

    // Generar slug si se está publicando y no tiene uno
    let slug = currentReport.slug
    if (isPublished && !slug) {
      const baseSlug = generateSlug(currentReport.title)
      slug = await ensureUniqueSlug(currentReport.projectId, baseSlug, id)
    }

    const report = await prisma.report.update({
      where: { id },
      data: {
        isPublished,
        isPublic: isPublic ?? false,
        slug,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        isPublished: true,
        isPublic: true,
        project: { select: { slug: true } },
      },
    })

    // Construir la URL pública
    const publicUrl = report.slug
      ? `/r/${report.project.slug}/${report.slug}`
      : null

    return NextResponse.json({
      ...report,
      publicUrl,
    })
  } catch (error) {
    console.error('Error updating publish status:', error)
    return NextResponse.json(
      { error: 'Error al actualizar estado' },
      { status: 500 }
    )
  }
}
