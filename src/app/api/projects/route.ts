import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'

// GET - Listar proyectos
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: session.user.role === 'ADMIN'
        ? {}
        : {
            members: {
              some: {
                userId: session.user.id,
              },
            },
          },
      include: {
        _count: {
          select: {
            reports: true,
            questions: { where: { status: 'PENDING' } },
            proposals: { where: { status: 'PENDING' } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear proyecto
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo ADMIN y CONSULTANT pueden crear proyectos
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos para crear proyectos' }, { status: 403 })
    }

    const { name, description, websiteUrl, aiContext, socialLinks } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Generar slug unico
    let slug = slugify(name)
    let counter = 0
    let slugExists = true

    while (slugExists) {
      const existing = await prisma.project.findUnique({
        where: { slug: counter === 0 ? slug : `${slug}-${counter}` },
      })
      if (!existing) {
        slugExists = false
        if (counter > 0) slug = `${slug}-${counter}`
      } else {
        counter++
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        slug,
        description,
        websiteUrl,
        aiContext,
        socialLinks,
        members: {
          create: {
            userId: session.user.id,
            role: 'OWNER',
          },
        },
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
