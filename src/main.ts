import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { parseCorsOrigins } from './common/cors-origins';

function isAllowedCorsOrigin(
  origin: string,
  allowedOrigins: string[],
): boolean {
  const normalizedOrigin = origin.trim();

  return (
    allowedOrigins.includes(normalizedOrigin) ||
    normalizedOrigin === 'capacitor://localhost' ||
    normalizedOrigin.startsWith('http://localhost') ||
    normalizedOrigin.startsWith('https://localhost') ||
    normalizedOrigin.startsWith('http://127.0.0.1') ||
    normalizedOrigin.startsWith('https://127.0.0.1')
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
  app.enableCors({
    origin: (
      origin: unknown,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Permite requests nativas/herramientas sin header Origin.
      if (typeof origin !== 'string' || origin.length === 0) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes('*') || allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      callback(null, isAllowedCorsOrigin(origin, allowedOrigins));
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
  });
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // Lanza error si envían propiedades extras
      transform: true, // Transforma el payload al tipo del DTO
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Transport API')
    .setDescription('Documentación de la API de transporte')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
