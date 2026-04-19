import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class MailService {
  private async sendEmail(payload: object): Promise<void> {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY ?? '',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalServerErrorException(
        `No se pudo enviar el correo de verificación. Intente nuevamente más tarde. (${response.status}: ${errorText || response.statusText})`,
      );
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.sendEmail({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL ?? 'noreply@example.com',
        name: process.env.BREVO_SENDER_NAME ?? 'Muni',
      },
      to: [{ email: to }],
      subject: 'Código de verificación',
      textContent: `Tu código de verificación es: ${code}`,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.sendEmail({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL ?? 'noreply@example.com',
        name: process.env.BREVO_SENDER_NAME ?? 'Muni',
      },
      to: [{ email: to }],
      subject: 'Restablecer contraseña',
      htmlContent: `
        <p>Hola,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente enlace para continuar (válido por 1 hora):</p>
        <p><a href="${resetUrl}" style="color:#1B2A4A;font-weight:bold;">Restablecer contraseña</a></p>
        <p>Si no solicitaste esto, ignora este correo.</p>
      `,
      textContent: `Restablece tu contraseña en: ${resetUrl}\n\nEste enlace expira en 1 hora.`,
    });
  }
}
