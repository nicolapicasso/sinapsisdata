import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'

// GET - Obtener proyecto
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, role: true },
            },
          },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: { id: true, name: true },
            },
          },
        },
        questions: {
          orderBy: { createdAt: 'desc' },
        },
        proposals: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            reports: true,
            questions: { where: { status: 'PENDING' } },
            proposals: { where: { status: 'PENDING' } },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Verificar acceso
    if (session.user.role !== 'ADMIN') {
      const isMember = project.members.some((m) => m.userId === session.user.id)
      if (!isMember) {
        return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
      }
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT - Actualizar proyecto
export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        members: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Verificar permisos (ADMIN o OWNER del proyecto)
    const isOwner = project.members.some(
      (m) => m.userId === session.user.id && m.role === 'OWNER'
    )
    if (session.user.role !== 'ADMIN' && !isOwner) {
      return NextResponse.json({ error: 'No tienes permisos para editar este proyecto' }, { status: 403 })
    }

    const { name, description, websiteUrl, aiContext, socialLinks, status } = await req.json()

    const updateData: Record<string, unknown> = {}

    if (name) {
      updateData.name = name
      // Regenerar slug si cambia el nombre
      let slug = slugify(name)
      let counter = 0
      let slugExists = true

      while (slugExists) {
        const existing = await prisma.project.findFirst({
          where: {
            slug: counter === 0 ? slug : `${slug}-${counter}`,
            NOT: { id: project.id },
          },
        })
        if (!existing) {
          slugExists = false
          if (counter > 0) slug = `${slug}-${counter}`
        } else {
          counter++
        }
      }
      updateData.slug = slug
    }

    if (description !== undefined) updateData.description = description
    if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl
    if (aiContext !== undefined) updateData.aiContext = aiContext
    if (socialLinks !== undefined) updateData.socialLinks = socialLinks
    if (status) updateData.status = status

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Eliminar proyecto
export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    await prisma.project.delete({
      where: { id: project.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
