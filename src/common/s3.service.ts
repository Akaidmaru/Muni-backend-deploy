import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type UploadBase64ImageParams = {
  base64DataUrl: string;
  key: string;
};

export type UploadImageBufferParams = {
  buffer: Buffer;
  contentType: string;
  key: string;
};

export type UploadAttachmentBufferParams = {
  buffer: Buffer;
  contentType: string;
  key: string;
};

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucketName: string;
  private readonly client: S3Client;
  private readonly signedUrlExpiresInSeconds: number;

  constructor() {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bucketName = process.env.AWS_S3_BUCKET;

    if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new InternalServerErrorException(
        'Configuracion de AWS S3 incompleta. Revise AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY y AWS_S3_BUCKET.',
      );
    }

    this.bucketName = bucketName;
    this.signedUrlExpiresInSeconds =
      Number(process.env.AWS_S3_SIGNED_URL_TTL) || 3600;
    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadBase64Image(params: UploadBase64ImageParams): Promise<string> {
    const { mimeType, buffer } = this.parseDataUrl(params.base64DataUrl);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: params.key,
      Body: buffer,
      ContentType: mimeType,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      const err = error as { name?: string; message?: string };

      this.logger.error(
        `Error subiendo firma a S3. bucket=${this.bucketName} key=${params.key} error=${err?.name || 'UnknownError'} message=${err?.message || 'sin detalle'}`,
      );

      throw new InternalServerErrorException(
        'No se pudo subir la firma al almacenamiento. Verifique credenciales/permisos de AWS e intente nuevamente.',
      );
    }

    return params.key;
  }

  async uploadImageBuffer(params: UploadImageBufferParams): Promise<string> {
    const mimeType = this.validateImageMimeType(params.contentType);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: params.key,
      Body: params.buffer,
      ContentType: mimeType,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      const err = error as { name?: string; message?: string };

      this.logger.error(
        `Error subiendo archivo a S3. bucket=${this.bucketName} key=${params.key} error=${err?.name || 'UnknownError'} message=${err?.message || 'sin detalle'}`,
      );

      throw new InternalServerErrorException(
        'No se pudo subir el archivo al almacenamiento. Verifique credenciales/permisos de AWS e intente nuevamente.',
      );
    }

    return params.key;
  }

  async uploadAttachmentBuffer(
    params: UploadAttachmentBufferParams,
  ): Promise<string> {
    const mimeType = this.validateAttachmentMimeType(params.contentType);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: params.key,
      Body: params.buffer,
      ContentType: mimeType,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      const err = error as { name?: string; message?: string };

      this.logger.error(
        `Error subiendo adjunto a S3. bucket=${this.bucketName} key=${params.key} error=${err?.name || 'UnknownError'} message=${err?.message || 'sin detalle'}`,
      );

      throw new InternalServerErrorException(
        'No se pudo subir el adjunto al almacenamiento. Verifique credenciales/permisos de AWS e intente nuevamente.',
      );
    }

    return params.key;
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      const err = error as { name?: string; message?: string };
      this.logger.error(
        `Error eliminando objeto de S3. bucket=${this.bucketName} key=${key} error=${err?.name || 'UnknownError'}`,
      );
    }
  }

  async getSignedGetUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlExpiresInSeconds,
    });
  }

  async getObjectDataUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.client.send(command);
    const body = response.Body;

    if (!body || typeof body.transformToByteArray !== 'function') {
      throw new InternalServerErrorException(
        'No se pudo leer la firma almacenada.',
      );
    }

    const bytes = await body.transformToByteArray();
    const mimeType = response.ContentType || 'image/png';
    const base64Payload = Buffer.from(bytes).toString('base64');

    return `data:${mimeType};base64,${base64Payload}`;
  }

  private parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
    const matches = dataUrl.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/,
    );

    if (!matches) {
      throw new BadRequestException(
        'La firma no tiene un formato base64 valido (data URL).',
      );
    }

    const mimeType = matches[1];
    const base64Payload = matches[2];

    return {
      mimeType,
      buffer: Buffer.from(base64Payload, 'base64'),
    };
  }

  private validateImageMimeType(contentType: string): string {
    const normalized = (contentType || '').toLowerCase().trim();
    const allowedMimeTypes = new Set([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ]);

    if (!allowedMimeTypes.has(normalized)) {
      throw new BadRequestException(
        'Solo se permiten imagenes PNG, JPEG o WEBP.',
      );
    }

    return normalized;
  }

  private validateAttachmentMimeType(contentType: string): string {
    const normalized = (contentType || '').toLowerCase().trim();
    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ]);

    if (!allowedMimeTypes.has(normalized)) {
      throw new BadRequestException(
        'Solo se permiten archivos PDF o imagenes PNG, JPEG o WEBP.',
      );
    }

    return normalized;
  }
}
