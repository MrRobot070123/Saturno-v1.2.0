import { DashboardRange } from '../../modules/dashboard/dto/dashboard-query.dto';

export function resolveDateRange(
  range: DashboardRange | undefined,
  from?: string,
  to?: string,
): { gte?: Date; lte?: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (range) {
    case DashboardRange.TODAY:
      return { gte: startOfDay(now), lte: endOfDay(now) };
    case DashboardRange.LAST_7_DAYS: {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { gte: startOfDay(start), lte: endOfDay(now) };
    }
    case DashboardRange.LAST_30_DAYS: {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { gte: startOfDay(start), lte: endOfDay(now) };
    }
    case DashboardRange.THIS_MONTH:
      return {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: endOfDay(now),
      };
    case DashboardRange.LAST_MONTH: {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { gte: start, lte: end };
    }
    case DashboardRange.THIS_YEAR:
      return { gte: new Date(now.getFullYear(), 0, 1), lte: endOfDay(now) };
    case DashboardRange.CUSTOM:
      return {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    default:
      return {};
  }
}
