import { prisma } from '@/lib/prisma'
import { UsersList } from '@/components/admin/UsersList'

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
      createdAt: true,
      _count: {
        select: {
          projectMembers: true,
        },
      },
    },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark">Usuarios</h1>
          <p className="text-gray-500 mt-1">Gestiona los usuarios de la plataforma</p>
        </div>
      </div>

      <UsersList users={users} />
    </div>
  )
}
