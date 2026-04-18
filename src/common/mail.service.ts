import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class MailService {
  async sendVerificationCode(to: string, code: string): Promise<void> {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY ?? '',
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL ?? 'noreply@example.com',
          name: process.env.BREVO_SENDER_NAME ?? 'Muni',
        },
        to: [{ email: to }],
        subject: 'Código de verificación',
        textContent: `Tu código de verificación es: ${code}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalServerErrorException(
        `No se pudo enviar el correo de verificación. Intente nuevamente más tarde. (${response.status}: ${errorText || response.statusText})`,
      );
    }
  }
}
