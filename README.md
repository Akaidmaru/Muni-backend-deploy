# transport-backend

Proyecto backend para gestión de transporte, desarrollado con NestJS y Prisma.

## Requisitos
- Node.js >= 18
- npm
- Base de datos compatible con Prisma (por defecto: SQLite, PostgreSQL, MySQL, etc.)

## Instalación

```sh
npm install
```

## Configuración

1. Copia el archivo `.env.example` a `.env` y configura las variables necesarias.
2. Configura la base de datos en `prisma/schema.prisma` si es necesario.

## Migraciones Prisma

```sh
npx prisma migrate dev
```

## Ejecución en desarrollo

```sh
npm run start:dev
```

## Scripts útiles
- `npm run start:dev`: Ejecuta el servidor en modo desarrollo.
- `npm run build`: Compila el proyecto.
- `npm run test`: Ejecuta los tests.
- `npx prisma studio`: Abre el panel visual de Prisma.

## Estructura del proyecto
- `src/`: Código fuente principal.
- `prisma/`: Esquema y migraciones de la base de datos.
- `generated/`: Archivos generados por Prisma.

## Documentación
- [NestJS](https://docs.nestjs.com/)
- [Prisma](https://www.prisma.io/docs/)