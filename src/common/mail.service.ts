import { Injectable } from '@nestjs/common';
import SibApiV3Sdk from 'sib-api-v3-sdk';

interface SenderInfo {
  email: string;
  name: string;
}

interface RecipientEmail {
  email: string;
}

interface EmailPayload {
  sender: SenderInfo;
  to: RecipientEmail[];
  subject: string;
  textContent: string;
}

interface TransactionalEmailsApi {
  sendTransacEmail(emailObj: EmailPayload): Promise<void>;
}

interface ApiAuthentication {
  apiKey: string;
}

interface SibApiClient {
  instance: {
    authentications: Record<string, ApiAuthentication>;
  };
}

interface SibApiV3SdkModule {
  ApiClient: SibApiClient;
  TransactionalEmailsApi: new () => TransactionalEmailsApi;
}

@Injectable()
export class MailService {
  private readonly emailApi: TransactionalEmailsApi;

  constructor() {
    const sdk = SibApiV3Sdk as unknown as SibApiV3SdkModule;
    sdk.ApiClient.instance.authentications['api-key'].apiKey =
      process.env.BREVO_API_KEY ?? '';
    this.emailApi = new sdk.TransactionalEmailsApi();
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const sender: SenderInfo = {
      email: process.env.BREVO_SENDER_EMAIL ?? 'noreply@example.com',
      name: process.env.BREVO_SENDER_NAME ?? 'Muni',
    };
    const emailObj: EmailPayload = {
      sender,
      to: [{ email: to }],
      subject: 'Código de verificación',
      textContent: `Tu código de verificación es: ${code}`,
    };
    await this.emailApi.sendTransacEmail(emailObj);
  }
}
