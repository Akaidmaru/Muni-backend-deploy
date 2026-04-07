import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type UploadBase64ImageParams = {
  base64DataUrl: string;
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

  async getSignedGetUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlExpiresInSeconds,
    });
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
}
