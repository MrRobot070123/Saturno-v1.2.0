// Formatea fechas en la zona horaria de Colombia (America/Bogota, UTC-5,
// sin horario de verano) para que los reportes muestren la hora real del
// hotel en vez de la hora UTC cruda almacenada en PostgreSQL.
const BOGOTA_TZ = 'America/Bogota';

export function formatDateTimeCO(date: Date | null | undefined): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDateCO(date: Date | null | undefined): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
