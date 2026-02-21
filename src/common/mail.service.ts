import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;

  constructor() {
    const options: SMTPTransport.Options = {
      host: process.env.SMTP_HOST ?? 'smtp.example.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER ?? 'user',
        pass: process.env.SMTP_PASS ?? 'pass',
      },
    };
    this.transporter = nodemailer.createTransport(options);
  }

  async sendVerificationCode(to: string, code: string) {
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'noreply@example.com',
      to,
      subject: 'Código de verificación',
      text: `Tu código de verificación es: ${code}`,
    });
  }
}
