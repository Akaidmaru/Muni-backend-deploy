import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    _context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const ttlSeconds = throttlerLimitDetail.ttl / 1000;

    let message: string;
    if (ttlSeconds <= 60) {
      message = 'Demasiados intentos. Por favor espere 1 minuto e intente nuevamente.';
    } else {
      message = 'Demasiados intentos fallidos. Su acceso ha sido bloqueado por 5 minutos.';
    }

    throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
