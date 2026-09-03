# ==========================================
# 1. Base Stage
# ==========================================
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ==========================================
# 2. Development Stage (Vite com HMR)
# ==========================================
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ==========================================
# 3. Build Stage
# ==========================================
FROM base AS builder
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

# ==========================================
# 4. Production Stage (Nginx leve)
# ==========================================
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
