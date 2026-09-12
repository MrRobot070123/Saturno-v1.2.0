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

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
