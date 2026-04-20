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
3. Para guardar firmas de viajes en S3, configura `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_S3_BUCKET`.
4. Para el asistente IA, configura `GROQ_API_KEY` y opcionalmente `GROQ_MODEL`.

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

## Asistente IA (Groq)

- Endpoint: `POST /ai-chat/query`
- Requiere JWT y rol `ADMIN`.
- Body de ejemplo:

```json
{
	"message": "Dame los 5 primeros camiones",
	"limit": 5
}
```

- Variables de entorno:

```env
GROQ_API_KEY=tu_api_key
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```