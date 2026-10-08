// Usado únicamente al levantar el stack completo con `docker compose up`
// para desarrollo local: el frontend corre en un contenedor Nginx (puerto
// 8081) y debe hablar con el backend del propio stack local (puerto 3000),
// nunca con la API real de producción (ver environment.prod.ts).
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
};
