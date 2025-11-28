import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { saveFile } from '@/lib/file-storage'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const reportId = formData.get('reportId') as string

    if (!file || !reportId) {
      return NextResponse.json({ error: 'Archivo y reportId son requeridos' }, { status: 400 })
    }

    // Verificar que el informe existe
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        project: {
          include: {
            members: true,
          },
        },
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
    }

    // Verificar permisos
    const isMember = report.project.members.some((m) => m.userId === session.user.id)
    if (session.user.role !== 'ADMIN' && !isMember) {
      return NextResponse.json({ error: 'No tienes acceso a este informe' }, { status: 403 })
    }

    // Guardar archivo
    const savedFile = await saveFile(file, 'uploads')

    // Crear registro en BD
    const reportFile = await prisma.reportFile.create({
      data: {
        reportId,
        filename: savedFile.filename,
        originalName: file.name,
        mimeType: file.type || 'text/csv',
        size: savedFile.size,
        path: savedFile.path,
      },
    })

    return NextResponse.json(reportFile)
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
