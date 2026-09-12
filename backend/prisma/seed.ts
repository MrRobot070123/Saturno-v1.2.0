import { PrismaClient, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Catálogo de permisos granulares del sistema. Se seedan aquí para que
// ADMINISTRADOR pueda luego reconfigurar qué rol tiene cada permiso desde
// /roles sin tocar código (regla #12).
const PERMISSIONS = [
  { code: 'case:view', description: 'Consultar casos' },
  { code: 'case:create', description: 'Crear casos' },
  { code: 'case:edit', description: 'Editar casos no resueltos' },
  { code: 'case:edit-resolved', description: 'Editar casos resueltos/anulados (excepcional)' },
  { code: 'case:assign', description: 'Asignar área/responsable' },
  { code: 'case:change-status', description: 'Cambiar estado de un caso' },
  { code: 'case:close', description: 'Cerrar (resolver) un caso' },
  { code: 'case:reopen', description: 'Reabrir un caso resuelto' },
  { code: 'dashboard:view', description: 'Consultar dashboard' },
  { code: 'report:view', description: 'Generar y consultar reportes' },
  { code: 'user:manage', description: 'Administrar usuarios y roles' },
  { code: 'catalog:manage', description: 'Administrar catálogos (áreas, ubicaciones, responsables)' },
  { code: 'audit:view', description: 'Consultar auditoría del sistema' },
];

// Mapeo inicial de permisos por rol, según la sección 12 del requerimiento.
const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  ADMINISTRADOR: PERMISSIONS.map((p) => p.code), // acceso total
  SUPERVISOR: [
    'case:view',
    'case:create',
    'case:assign',
    'case:edit',
    'case:change-status',
    'case:close',
    'dashboard:view',
    'report:view',
  ],
  OPERATIVO: ['case:view', 'case:create', 'case:edit', 'case:change-status', 'case:close', 'dashboard:view'],
};

const AREAS = [
  'Recepción',
  'Mantenimiento',
  'Ama de llaves',
  'Restaurante',
  'Sistemas',
  'Seguridad',
  'Administración',
];

const LOCATIONS = [
  'Torre 1',
  'Torre 2',
  'Restaurante 1',
  'Restaurante 2',
  'Restaurante 3',
  'Piscina 1',
  'Piscina 2',
];

async function main() {
  console.log('Iniciando seed...');

  // ---------- Hotel ----------
  const hotel = await prisma.hotel.upsert({
    where: { code: process.env.DEFAULT_HOTEL_CODE ?? 'HTL-DEMO-01' },
    update: {},
    create: { name: 'Hotel Demo Barranquilla', code: process.env.DEFAULT_HOTEL_CODE ?? 'HTL-DEMO-01' },
  });

  // ---------- Configuración de tipos de caso (prefijos de numeración) ----------
  await prisma.caseTypeConfig.upsert({
    where: { type: 'QUEJA' },
    update: {},
    create: { type: 'QUEJA', prefix: 'QUE' },
  });
  await prisma.caseTypeConfig.upsert({
    where: { type: 'SOLICITUD' },
    update: {},
    create: { type: 'SOLICITUD', prefix: 'SOL' },
  });

  // ---------- Permisos ----------
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
  }

  // ---------- Roles + asignación de permisos ----------
  for (const roleName of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    const codes = ROLE_PERMISSIONS[roleName];
    const permissions = await prisma.permission.findMany({ where: { code: { in: codes } } });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  // ---------- Áreas ----------
  const areaRecords: Record<string, string> = {};
  for (const name of AREAS) {
    const area = await prisma.area.upsert({
      where: { hotelId_name: { hotelId: hotel.id, name } },
      update: {},
      create: { hotelId: hotel.id, name },
    });
    areaRecords[name] = area.id;
  }

  // ---------- Ubicaciones ----------
  for (const name of LOCATIONS) {
    await prisma.location.upsert({
      where: { hotelId_name: { hotelId: hotel.id, name } },
      update: {},
      create: { hotelId: hotel.id, name },
    });
  }

  // ---------- Responsables de ejemplo por área ----------
  const responsiblesSeed: Record<string, string[]> = {
    Mantenimiento: ['Técnico 1', 'Técnico 2', 'Supervisor de mantenimiento'],
    Recepción: ['Agente de recepción 1', 'Agente de recepción 2'],
    'Ama de llaves': ['Camarista 1', 'Camarista 2', 'Supervisor de pisos'],
    Restaurante: ['Mesero 1', 'Mesero 2', 'Capitán de meseros'],
    Sistemas: ['Soporte TI 1'],
    Seguridad: ['Guardia 1', 'Guardia 2'],
    Administración: ['Coordinador administrativo'],
  };

  for (const [areaName, names] of Object.entries(responsiblesSeed)) {
    for (const fullName of names) {
      const existing = await prisma.responsible.findFirst({
        where: { areaId: areaRecords[areaName], fullName },
      });
      if (!existing) {
        await prisma.responsible.create({
          data: { areaId: areaRecords[areaName], fullName },
        });
      }
    }
  }

  // ---------- Tipos de queja/solicitud por área (criterio inicial,  ----------
  // ---------- administrable luego desde Configuración) ----------
  const subtypesSeed: Record<string, { QUEJA: string[]; SOLICITUD: string[] }> = {
    Sistemas: {
      QUEJA: ['Conexión a internet', 'Equipo dañado', 'Impresora no funciona', 'Televisor/cable'],
      SOLICITUD: ['Clave wifi', 'Instalación de software', 'Soporte técnico', 'Préstamo de equipo'],
    },
    Mantenimiento: {
      QUEJA: [
        'Aire acondicionado no enfría',
        'Fuga de agua',
        'Iluminación defectuosa',
        'Puerta o cerradura dañada',
        'Ruido de equipos',
      ],
      SOLICITUD: [
        'Revisión de aire acondicionado',
        'Cambio de bombillo',
        'Reparación menor',
        'Ajuste de mobiliario',
      ],
    },
    Recepción: {
      QUEJA: ['Demora en la atención', 'Información incorrecta', 'Error en la reserva'],
      SOLICITUD: ['Late check-out', 'Traslado de habitación', 'Información turística', 'Taxi o transporte'],
    },
    'Ama de llaves': {
      QUEJA: ['Habitación sucia', 'Faltan artículos de aseo', 'Ropa de cama sucia', 'Olores desagradables'],
      SOLICITUD: [
        'Servicio de limpieza adicional',
        'Cambio de sábanas/toallas',
        'Almohadas adicionales',
        'Amenities adicionales',
      ],
    },
    Restaurante: {
      QUEJA: ['Demora en el servicio', 'Comida fría', 'Error en el pedido', 'Higiene del área'],
      SOLICITUD: ['Reserva de mesa', 'Menú especial o dieta', 'Room service', 'Evento o celebración'],
    },
    Seguridad: {
      QUEJA: ['Ruido excesivo', 'Personal no autorizado', 'Incidente de convivencia'],
      SOLICITUD: ['Acceso a caja fuerte', 'Reporte de objeto perdido', 'Acompañamiento'],
    },
    Administración: {
      QUEJA: ['Error en factura', 'Cobro indebido', 'Atención administrativa'],
      SOLICITUD: ['Factura electrónica', 'Constancia de estadía', 'Información de convenio empresarial'],
    },
  };

  for (const [areaName, byType] of Object.entries(subtypesSeed)) {
    for (const [type, names] of Object.entries(byType) as [string, string[]][]) {
      for (const name of names) {
        const existing = await prisma.caseSubtype.findFirst({
          where: { areaId: areaRecords[areaName], type: type as any, name },
        });
        if (!existing) {
          await prisma.caseSubtype.create({
            data: { areaId: areaRecords[areaName], type: type as any, name },
          });
        }
      }
    }
  }

  // ---------- Usuarios de desarrollo (NO son credenciales reales) ----------
  const devUsers = [
    {
      fullName: 'Admin Demo',
      email: 'admin@hotel-demo.test',
      password: 'Admin#2026Dev',
      role: RoleName.ADMINISTRADOR,
    },
    {
      fullName: 'Supervisor Demo',
      email: 'supervisor@hotel-demo.test',
      password: 'Supervisor#2026Dev',
      role: RoleName.SUPERVISOR,
    },
    {
      fullName: 'Operativo Demo',
      email: 'operativo@hotel-demo.test',
      password: 'Operativo#2026Dev',
      role: RoleName.OPERATIVO,
      areaName: 'Mantenimiento',
    },
  ];

  for (const u of devUsers) {
    const passwordHash = await argon2.hash(u.password);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: u.role } });

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        hotelId: hotel.id,
        fullName: u.fullName,
        email: u.email,
        passwordHash,
        areaId: u.areaName ? areaRecords[u.areaName] : undefined,
      },
    });

    const hasRole = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
    });
    if (!hasRole) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }
  }

  console.log('Seed completado.');
  console.log('Usuarios de desarrollo (NO usar en producción):');
  devUsers.forEach((u) => console.log(`  - ${u.role}: ${u.email} / ${u.password}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
