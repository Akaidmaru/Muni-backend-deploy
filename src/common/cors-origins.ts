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
