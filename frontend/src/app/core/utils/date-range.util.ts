// Espejo en el frontend de backend/src/common/utils/date-range.util.ts.
// Se usa para que, al hacer clic en una tarjeta o gráfico del dashboard,
// la lista de casos se filtre exactamente con el mismo rango de fechas que
// está seleccionado en el dashboard (evita que los números no cuadren).
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
