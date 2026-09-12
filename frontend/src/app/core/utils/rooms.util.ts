// Genera la lista de habitaciones para las torres del hotel. Los números
// no se guardan como catálogo en base de datos porque siguen un patrón
// matemático fijo por torre (piso + habitación), así que se calculan aquí.
//
// Torre Caimán: pisos 4 a 25, habitaciones 02 a 09 por piso
//   -> 402, 403, ..., 409, 502, ..., 2502, ..., 2509
// Torre Cayena: pisos 4 a 10, habitaciones 10 a 16 por piso
//   -> 410, 411, ..., 416, 510, ..., 1010, ..., 1016
export function generateRoomsForTower(towerName: string): string[] {
  const normalized = towerName.trim().toLowerCase();

  // Debe ser específicamente una TORRE: "Piscina Caimán" o "Restaurante
  // Caimán", por ejemplo, no deben activar el selector de habitación.
  if (!normalized.includes('torre')) return [];

  if (normalized.includes('caimán') || normalized.includes('caiman')) {
    const rooms: string[] = [];
    for (let floor = 4; floor <= 25; floor++) {
      for (let room = 2; room <= 9; room++) {
        rooms.push(`${floor}${String(room).padStart(2, '0')}`);
      }
    }
    return rooms;
  }

  if (normalized.includes('cayena')) {
    const rooms: string[] = [];
    for (let floor = 4; floor <= 10; floor++) {
      for (let room = 10; room <= 16; room++) {
        rooms.push(`${floor}${room}`);
      }
    }
    return rooms;
  }

  return [];
}

// Determina si una ubicación (por nombre) debe mostrar el selector de
// habitación en el formulario de casos.
export function locationHasRooms(locationName: string | undefined | null): boolean {
  if (!locationName) return false;
  return generateRoomsForTower(locationName).length > 0;
}
