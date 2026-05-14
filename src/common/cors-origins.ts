/**
 * Lista de orígenes para CORS / Socket.IO.
 * Variable CORS_ORIGIN: URLs separadas por comas (espacios opcionales).
 * En app Capacitor el navegador suele enviar Origin: capacitor://localhost
 * (inclúyelo en CORS_ORIGIN en producción junto con https://www.tu-dominio).
 */
export function parseCorsOrigins(env?: string): string[] {
  if (!env?.trim()) {
    return ['http://localhost:5173'];
  }
  return env
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Compatibilidad legado:
 * - CORS_ORIGIN (actual)
 * - OLD_ORIGIN / old_origin (variable usada previamente)
 * - CORS_OLD_ORIGIN (alias opcional)
 */
export function getCorsOriginsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const rawOrigins = [
    env.CORS_ORIGIN,
    env.OLD_ORIGIN,
    env.old_origin,
    env.CORS_OLD_ORIGIN,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (rawOrigins.length === 0) {
    return parseCorsOrigins(undefined);
  }

  // Evita repetir orígenes al mezclar variables nuevas y legadas.
  return [...new Set(parseCorsOrigins(rawOrigins.join(',')))];
}

/** Misma regla que Express: lista explícita + localhost dev + Capacitor. */
export function isAllowedCorsOrigin(
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

type CorsCallback = (err: Error | null, allow?: boolean) => void;

export function createExpressCorsOriginCallback(allowedOrigins: string[]) {
  return (origin: unknown, callback: CorsCallback): void => {
    if (typeof origin !== 'string' || origin.length === 0) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes('*') || allowedOrigins.length === 0) {
      callback(null, true);
      return;
    }

    callback(null, isAllowedCorsOrigin(origin, allowedOrigins));
  };
}

/** Engine.IO / Socket.IO: misma política que `enableCors` en `main.ts`. */
export function createSocketIoCorsOriginFn(allowedOrigins: string[]) {
  return (origin: string | undefined, callback: CorsCallback): void => {
    if (origin === undefined || origin.length === 0) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes('*') || allowedOrigins.length === 0) {
      callback(null, true);
      return;
    }

    callback(null, isAllowedCorsOrigin(origin, allowedOrigins));
  };
}
