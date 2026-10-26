FROM node:20-slim

WORKDIR /app

# Copy package files from api/ subdirectory
COPY api/package*.json ./
RUN npm install

COPY api/tsconfig.json ./
COPY api/src ./src
COPY api/migrations ./migrations

# Include schema for init script access
COPY schema.sql ./schema.sql

RUN npm run build

EXPOSE 8787

CMD ["node", "dist/server.js"]
