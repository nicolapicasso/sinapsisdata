import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Añadir miembro al proyecto
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admin y consultores pueden añadir miembros
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const { userId, role } = await req.json()

    if (!userId || !role) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: { members: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Verificar permisos
    if (session.user.role !== 'ADMIN') {
      const isOwner = project.members.some(
        (m) => m.userId === session.user.id && m.role === 'OWNER'
      )
      if (!isOwner) {
        return NextResponse.json({ error: 'Solo el propietario puede añadir miembros' }, { status: 403 })
      }
    }

    // Verificar que el usuario no sea ya miembro
    const alreadyMember = project.members.some((m) => m.userId === userId)
    if (alreadyMember) {
      return NextResponse.json({ error: 'El usuario ya es miembro del proyecto' }, { status: 400 })
    }

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId,
        role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('Error adding member:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
