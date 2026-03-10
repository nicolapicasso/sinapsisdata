import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/auth/google-ads/check
 *
 * Diagnostic endpoint to verify Google Ads OAuth configuration.
 * Only accessible by ADMIN users.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const checks = {
      NEXTAUTH_URL: {
        configured: !!process.env.NEXTAUTH_URL,
        value: process.env.NEXTAUTH_URL || 'NOT SET',
      },
      GOOGLE_ADS_CLIENT_ID: {
        configured: !!process.env.GOOGLE_ADS_CLIENT_ID,
        value: process.env.GOOGLE_ADS_CLIENT_ID
          ? `${process.env.GOOGLE_ADS_CLIENT_ID.substring(0, 20)}...`
          : 'NOT SET',
      },
      GOOGLE_ADS_CLIENT_SECRET: {
        configured: !!process.env.GOOGLE_ADS_CLIENT_SECRET,
        value: process.env.GOOGLE_ADS_CLIENT_SECRET ? '***SET***' : 'NOT SET',
      },
      GOOGLE_ADS_DEVELOPER_TOKEN: {
        configured: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        value: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? '***SET***' : 'NOT SET',
      },
      ENCRYPTION_KEY: {
        configured: !!process.env.ENCRYPTION_KEY,
        length: process.env.ENCRYPTION_KEY?.length || 0,
        valid: process.env.ENCRYPTION_KEY?.length === 64,
      },
    }

    const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/google-ads/callback`

    const allConfigured = Object.values(checks).every((c) => c.configured)

    return NextResponse.json({
      status: allConfigured ? 'OK' : 'MISSING_CONFIG',
      checks,
      redirectUri,
      instructions: !allConfigured
        ? 'Configure las variables faltantes en Digital Ocean'
        : `Asegúrese de que esta URI está en Google Cloud Console: ${redirectUri}`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
