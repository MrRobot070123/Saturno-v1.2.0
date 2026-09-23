// Utilidades de fechas para filtros del frontend.
//
// Este archivo reúne dos familias de funciones:
//
// 1) resolveDateRangeIso / fixedRangeIso: espejo de
//    backend/src/common/utils/date-range.util.ts. Se usan para que, al hacer
//    clic en una tarjeta o gráfico del dashboard, la lista de casos se filtre
//    exactamente con el mismo rango de fechas que está seleccionado en el
//    dashboard (evita que los números no cuadren).
//
// 2) todayCO / daysAgoCO / dayStartIso / dayEndIso / rangeDays: utilidades
//    para Reportes y la lista de Casos, en hora de Colombia (UTC-5, sin
//    horario de verano). El offset se envía explícito (-05:00) para que el
//    "día de hoy" sea el mismo sin importar la zona horaria del dispositivo.

// ---------------------------------------------------------------------------
// 1) Dashboard: rangos con nombre y rangos fijos
// ---------------------------------------------------------------------------

export function resolveDateRangeIso(range: string): { from?: string; to?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (range) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case 'last_7_days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() };
    }
    case 'last_30_days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() };
    }
    case 'this_month':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case 'this_year':
      return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to: endOfDay(now).toISOString() };
    default:
      return {};
  }
}

// Rangos fijos usados por KPIs como "Del día" / "De la semana" / "Del mes",
// que son independientes del selector de rango del dashboard.
export function fixedRangeIso(kind: 'day' | 'week' | 'month'): { from: string; to: string } {
  const now = new Date();
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (kind === 'day') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start.toISOString(), to: endOfDay(now).toISOString() };
  }
  if (kind === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: endOfDay(now).toISOString() };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: start.toISOString(), to: endOfDay(now).toISOString() };
}

// ---------------------------------------------------------------------------
// 2) Reportes y lista de Casos: fechas simples en hora de Colombia
// ---------------------------------------------------------------------------

const CO_TIMEZONE = 'America/Bogota';
const CO_OFFSET = '-05:00';

// Fecha de hoy en Colombia, formato YYYY-MM-DD (el que usa <input type="date">).
export function todayCO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Fecha de hace "n" días en Colombia (YYYY-MM-DD). daysAgoCO(0) === todayCO().
export function daysAgoCO(n: number): string {
  const [y, m, d] = todayCO().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

// Inicio del día (00:00:00.000, hora Colombia) en ISO 8601.
export function dayStartIso(ymd: string): string {
  return `${ymd}T00:00:00.000${CO_OFFSET}`;
}

// Fin del día (23:59:59.999, hora Colombia) en ISO 8601.
export function dayEndIso(ymd: string): string {
  return `${ymd}T23:59:59.999${CO_OFFSET}`;
}

// Cantidad de días del rango, contando ambos extremos (YYYY-MM-DD).
export function rangeDays(fromYmd: string, toYmd: string): number {
  return (Date.parse(toYmd) - Date.parse(fromYmd)) / 86_400_000 + 1;
}
