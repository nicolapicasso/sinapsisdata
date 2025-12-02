const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed...')

  // Crear usuario admin
  const adminPassword = await bcrypt.hash('admin123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@sinapsis.agency' },
    update: {},
    create: {
      email: 'admin@sinapsis.agency',
      password: adminPassword,
      name: 'Admin Sinapsis',
      role: 'ADMIN',
    },
  })

  console.log('✓ Usuario admin creado:', admin.email)

  // Crear usuario consultor de ejemplo
  const consultantPassword = await bcrypt.hash('consultant123', 12)

  const consultant = await prisma.user.upsert({
    where: { email: 'consultor@sinapsis.agency' },
    update: {},
    create: {
      email: 'consultor@sinapsis.agency',
      password: consultantPassword,
      name: 'Consultor Demo',
      role: 'CONSULTANT',
    },
  })

  console.log('✓ Usuario consultor creado:', consultant.email)

  // Crear proyecto de ejemplo
  const project = await prisma.project.upsert({
    where: { slug: 'proyecto-demo' },
    update: {},
    create: {
      name: 'Proyecto Demo',
      slug: 'proyecto-demo',
      description: 'Este es un proyecto de demostración para probar las funcionalidades de Sinapsis Data.',
      aiContext: 'Este proyecto es una tienda de ecommerce especializada en productos tecnológicos. El público objetivo son profesionales de 25-45 años interesados en gadgets y tecnología.',
      status: 'ACTIVE',
      members: {
        create: [
          {
            userId: admin.id,
            role: 'OWNER',
          },
          {
            userId: consultant.id,
            role: 'CONSULTANT',
          },
        ],
      },
    },
  })

  console.log('✓ Proyecto demo creado:', project.name)
  console.log('')
  console.log('=== SEED COMPLETADO ===')
  console.log('')
  console.log('Credenciales:')
  console.log('  Admin: admin@sinapsis.agency / admin123')
  console.log('  Consultor: consultor@sinapsis.agency / consultant123')
}

main()
  .catch((e) => {
    console.error('Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
