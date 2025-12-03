import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const { isPublished } = await req.json()

    const report = await prisma.report.update({
      where: { id },
      data: { isPublished },
      select: {
        id: true,
        title: true,
        isPublished: true,
      },
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error updating publish status:', error)
    return NextResponse.json(
      { error: 'Error al actualizar estado' },
      { status: 500 }
    )
  }
}
