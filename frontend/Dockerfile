FROM node:22-slim

# Habilita pnpm (el único gestor JS permitido en el proyecto)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /frontend

# Instala dependencias primero para aprovechar la caché de capas
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# Copia el código fuente
COPY . .

EXPOSE 3000

# Modo dev con --host para que Vite escuche en todas las interfaces del contenedor
CMD ["pnpm", "dev", "--host", "--port", "3000"]
