# Sistema Hotelero de Gestión, Seguimiento y Control de Casos

Aplicación empresarial para el registro, seguimiento y control de **Quejas** y
**Solicitudes** de huéspedes de un hotel, modeladas ambas sobre un concepto
central único: **Caso** (`Case`). La arquitectura está preparada para agregar
nuevos tipos de caso (Reclamo, Sugerencia, Felicitación, Incidente, Petición,
Mantenimiento, etc.) sin reconstruir el sistema.

> **Nota honesta sobre el origen de este entregable:** este proyecto fue
> generado por Claude en un entorno de trabajo sin acceso a internet ni a
> PostgreSQL. El código es real y completo (no hay mocks, botones sin
> funcionalidad ni datos hardcodeados), pero **no pudo ejecutarse, compilarse
> ni probarse dentro de ese entorno**. La primera vez que lo levantes tú
> mismo con Docker, sigue esta guía paso a paso y revisa la sección
> [Solución de problemas](#solución-de-problemas) si algo falla — es
> esperable que aparezcan pequeños ajustes de versiones de dependencias que
> no pudieron verificarse de antemano.

---

## Arquitectura

```
Angular (standalone, lazy-loaded)
        ↓ HTTP/JSON (JWT Bearer)
API REST (NestJS, modular por dominio)
        ↓
Servicios / Reglas de negocio
        ↓
Prisma ORM
        ↓
PostgreSQL
```

- **Frontend**: Angular 18 standalone components, Angular Router con lazy
  loading, Reactive Forms, interceptors HTTP (JWT + manejo global de
  errores), guards de ruta (autenticación + permisos), Chart.js sobre
  Canvas para los gráficos del dashboard.
- **Backend**: NestJS 10 (TypeScript), arquitectura modular por dominio
  (`auth`, `users`, `roles`, `catalogs`, `cases`, `dashboard`, `reports`,
  `audit`, `notifications`), DTOs con `class-validator`, guards de
  autenticación/roles/permisos, filtro global de excepciones, interceptor de
  logging.
- **Base de datos**: PostgreSQL 16 + Prisma ORM. Modelo normalizado con
  claves foráneas, índices y `unique constraints` (ver
  `backend/prisma/schema.prisma`).
- **Multi-hotel**: todas las entidades operativas cuelgan de `Hotel`
  (`hotelId`), aunque hoy solo exista un hotel sembrado.

### Por qué "Case" y no "Complaint"/"Request" por separado

Quejas y Solicitudes comparten el 100% de su ciclo de vida (creación,
asignación, cambio de estado, cierre, historial, auditoría, reportes). Se
modelan como una sola entidad `Case` con un campo `type: CaseType`. Agregar
un nuevo tipo de caso en el futuro solo requiere:

1. Agregar el valor al enum `CaseType` en `schema.prisma`.
2. Agregar su prefijo en `case_type_config` (seed o UI de administración).
3. Ejecutar una migración de Prisma.

No se requiere crear nuevos controladores, servicios, tablas ni pantallas.

---

## Requisitos previos

- Docker y Docker Compose (recomendado para levantar todo con un comando).
- Alternativamente, para desarrollo local sin Docker: Node.js 20+, npm 10+,
  PostgreSQL 16 corriendo localmente.

---

## Arranque rápido con Docker (recomendado)

```bash
git clone <tu-repositorio>
cd hotel-case-system

# Copia y ajusta las variables de entorno (¡cambia los secretos!)
cp backend/.env.example backend/.env

# Levanta PostgreSQL + Backend + Frontend
docker compose up --build
```

Al finalizar el arranque:

- Frontend: http://localhost:8080
- API: http://localhost:3000/api/v1
- PostgreSQL: localhost:5432 (usuario `hotel_app`, ver `docker-compose.yml`)

El contenedor del backend, en su primer arranque, ejecuta automáticamente:
1. `prisma db push` (sincroniza el esquema con PostgreSQL).
2. `prisma db seed` (roles, permisos, catálogos y usuarios de desarrollo).

### Usuarios de desarrollo (NO son credenciales reales — regla #48)

| Rol            | Correo                        | Contraseña           |
|----------------|-------------------------------|-----------------------|
| ADMINISTRADOR  | admin@hotel-demo.test          | Admin#2026Dev         |
| SUPERVISOR     | supervisor@hotel-demo.test     | Supervisor#2026Dev    |
| OPERATIVO      | operativo@hotel-demo.test      | Operativo#2026Dev     |

Cámbialas o elimínalas antes de usar el sistema con datos reales.

---

## Desarrollo local sin Docker

### Backend

```bash
cd backend
cp .env.example .env   # ajusta DATABASE_URL a tu PostgreSQL local
npm install
npx prisma generate
npx prisma migrate dev --name init   # crea la migración inicial versionada
npm run prisma:seed
npm run start:dev                    # http://localhost:3000/api/v1
```

### Frontend

```bash
cd frontend
npm install
npm start                            # http://localhost:4200
```

Ajusta `frontend/src/environments/environment.ts` si tu backend no corre en
`http://localhost:3000`.

---

## Variables de entorno (backend/.env)

Ver `backend/.env.example`. Nunca subas `.env` a control de versiones (ver
`.gitignore`). Como mínimo, cambia en producción:

- `JWT_SECRET`, `JWT_REFRESH_SECRET`: valores aleatorios largos y únicos.
- `DATABASE_URL`: credenciales reales de tu PostgreSQL.
- `FRONTEND_URL`: dominio real del frontend (usado por CORS).

---

## Base de datos y migraciones

El esquema completo vive en `backend/prisma/schema.prisma`. Para generar
migraciones versionadas (recomendado en producción, en vez de `db push`):

```bash
npx prisma migrate dev --name init
```

Esto crea `backend/prisma/migrations/<timestamp>_init/migration.sql`,
que debes comprometer a tu repositorio. En producción, aplica con:

```bash
npx prisma migrate deploy
```

(y ajusta el `CMD` del `backend/Dockerfile` de `db push` a `migrate deploy`
una vez tengas migraciones versionadas).

### Seed

```bash
npm run prisma:seed
```

Crea: hotel de demostración, roles (`ADMINISTRADOR`, `SUPERVISOR`,
`OPERATIVO`), catálogo de permisos y su asignación por rol, áreas y
ubicaciones iniciales, responsables de ejemplo por área, y los 3 usuarios
de desarrollo listados arriba.

---

## API

Prefijo base: `/api/v1`. Endpoints principales:

```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/change-password
POST   /auth/request-password-reset
POST   /auth/reset-password

GET    /cases
POST   /cases
GET    /cases/:id
PATCH  /cases/:id
GET    /cases/:id/history
POST   /cases/:id/assign
POST   /cases/:id/status
POST   /cases/:id/close
POST   /cases/:id/reopen

GET    /dashboard/summary
GET    /dashboard/charts

GET    /reports/cases
GET    /reports/pending
GET    /reports/by-area
GET    /reports/by-responsible
GET    /reports/resolution-time
GET    /reports/cases/export?format=csv|excel|pdf

GET    /locations | POST /locations | PATCH /locations/:id
GET    /areas | POST /areas | PATCH /areas/:id
GET    /areas/:areaId/responsibles | POST /responsibles | PATCH /responsibles/:id

GET    /users | GET /users/:id | POST /users | PATCH /users/:id
GET    /roles | GET /roles/permissions | PATCH /roles/:id/permissions
GET    /audit
GET    /notifications | PATCH /notifications/:id/read | PATCH /notifications/read-all
```

Todos los endpoints (salvo `/auth/login`, `/auth/refresh` y
recuperación de contraseña) requieren `Authorization: Bearer <accessToken>`.

---

## Seguridad implementada

- Autenticación JWT (access token corto + refresh token de larga duración,
  almacenado como hash SHA-256, con rotación en cada refresh).
- Contraseñas con hash `argon2` (nunca texto plano).
- RBAC real en backend: por rol (`@Roles`) y por permiso granular
  (`@RequirePermissions`), nunca solo ocultando botones en Angular.
- Validación de entrada en backend con `class-validator` +
  `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
- Helmet (headers de seguridad), CORS restringido al `FRONTEND_URL`, rate
  limiting global (`@nestjs/throttler`) y más estricto en `/auth/login`.
- Manejo centralizado de errores: nunca se envían stack traces, contraseñas,
  tokens ni secretos al frontend.
- Auditoría append-only (`audit_logs`, `case_audit`): ningún rol puede
  editarla ni borrarla desde la API.
- Numeración de casos segura ante concurrencia (`SELECT ... FOR UPDATE`
  dentro de una transacción — ver `backend/src/modules/cases/case-number.service.ts`).

---

## Pruebas

```bash
cd backend
npm test              # pruebas unitarias (auth, máquina de estados de casos)
npm run test:cov      # con cobertura
```

Cubren: login correcto/incorrecto, usuario inactivo, refresh token
expirado/revocado, transiciones de estado permitidas y rechazadas,
reapertura controlada por permisos, bloqueo de edición libre de casos
resueltos.

---

## Build

```bash
# Backend
cd backend && npm run build && npm run lint

# Frontend
cd frontend && npm run build:prod
```

---

## Estructura del proyecto

```
/backend
  /prisma          -> schema.prisma, seed.ts
  /src
    /common        -> decoradores, guards, filtros, interceptores, utilidades
    /config        -> validación de variables de entorno
    /prisma        -> servicio/módulo de conexión a PostgreSQL
    /modules
      /auth /users /roles /catalogs /cases /dashboard /reports /audit /notifications
/frontend
  /src/app
    /core          -> servicios, guards, interceptors, modelos
    /layout        -> sidebar + header
    /features      -> auth, dashboard, cases, reports, users, settings, audit
docker-compose.yml
```

---

## Solución de problemas

- **`prisma generate` falla por versión de Node**: usa Node 20 LTS (definido
  en los Dockerfiles). Versiones muy nuevas de Node pueden no ser aún
  compatibles con el binario de Prisma.
- **El backend no conecta a PostgreSQL en Docker**: espera a que el
  healthcheck de `db` pase (`docker compose ps`); el backend depende de él.
- **Puertos ocupados**: cambia los mapeos de puertos en `docker-compose.yml`
  (`8080`, `3000`, `5432`) si ya los usas localmente.
- **Necesitas migraciones versionadas en vez de `db push`**: sigue la
  sección "Base de datos y migraciones" de este README.
- Como este proyecto no pudo compilarse ni ejecutarse en el entorno donde
  fue generado, es posible que al primer `npm install` aparezcan conflictos
  menores de versiones entre paquetes; ajusta los rangos de versión en los
  `package.json` según lo que resuelva tu gestor de paquetes.

---

## Roadmap (arquitectura ya preparada, no implementado aún)

- Nuevos tipos de caso (Reclamo, Sugerencia, Felicitación, Incidente,
  Petición, Mantenimiento): agregar al enum `CaseType` + `case_type_config`.
- Notificaciones por correo, Microsoft Teams y WhatsApp: el enum
  `NotificationChannel` y el modelo `Notification` ya lo contemplan.
- Integración con PMS/ERP y aplicación móvil.
- WebSockets para notificaciones en tiempo real (hoy son polling/consulta).
