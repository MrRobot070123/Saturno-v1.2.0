# ---------- Etapa de build ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build:prod

# ---------- Etapa de producción ----------
FROM nginx:1.27-alpine AS production
COPY --from=builder /app/dist/hotel-case-system/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx detecta "worker_processes auto" contando núcleos del servidor
# físico compartido, no los que realmente tiene asignados el contenedor -
# en la nube eso puede disparar decenas de procesos innecesarios. Para un
# frontend que solo sirve archivos estáticos, 2 procesos son de sobra.
RUN sed -i 's/worker_processes  auto;/worker_processes 2;/' /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]