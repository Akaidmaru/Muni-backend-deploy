import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import {
  createExpressCorsOriginCallback,
  getCorsOriginsFromEnv,
} from './common/cors-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = getCorsOriginsFromEnv();
  app.enableCors({
    origin: createExpressCorsOriginCallback(allowedOrigins),
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization,X-Client-Timezone',
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
