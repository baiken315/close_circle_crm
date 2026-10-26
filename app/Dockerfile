FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Ensure all static assets are readable by the nginx worker process
RUN chmod -R a+rX /usr/share/nginx/html
# Nginx config is provided via docker-compose volume mount
EXPOSE 80 443
