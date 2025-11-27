import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH - Cambiar rol de miembro
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admin y consultores pueden cambiar roles
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const { role } = await req.json()

    if (!role) {
      return NextResponse.json({ error: 'Rol requerido' }, { status: 400 })
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
        return NextResponse.json({ error: 'Solo el propietario puede cambiar roles' }, { status: 403 })
      }
    }

    // No permitir cambiar el rol del OWNER
    const member = project.members.find((m) => m.id === params.memberId)
    if (!member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    if (member.role === 'OWNER') {
      return NextResponse.json({ error: 'No se puede cambiar el rol del propietario' }, { status: 400 })
    }

    const updated = await prisma.projectMember.update({
      where: { id: params.memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Eliminar miembro del proyecto
export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admin y consultores pueden eliminar miembros
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
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
        return NextResponse.json({ error: 'Solo el propietario puede eliminar miembros' }, { status: 403 })
      }
    }

    // No permitir eliminar al OWNER
    const member = project.members.find((m) => m.id === params.memberId)
    if (!member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    if (member.role === 'OWNER') {
      return NextResponse.json({ error: 'No se puede eliminar al propietario' }, { status: 400 })
    }

    await prisma.projectMember.delete({
      where: { id: params.memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting member:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
