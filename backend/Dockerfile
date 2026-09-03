# ==========================================
# 1. Base Stage
# ==========================================
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ==========================================
# 2. Development Stage (Hot-Reloading)
# ==========================================
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ==========================================
# 3. Production Stage (Otimizado e Seguro)
# ==========================================
FROM base AS production
ENV NODE_ENV=production
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY src ./src
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
