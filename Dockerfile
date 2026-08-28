# Node 22: pnpm 11 usa `node:sqlite`, un módulo interno que no existe antes de
# Node 22.5. Con node:20 la instalación de dependencias aborta con
# ERR_UNKNOWN_BUILTIN_MODULE.
FROM node:22-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Versión de pnpm FIJADA, y por npm en lugar de corepack: `corepack enable
# pnpm` instala la última publicada, de modo que la imagen dependía de qué
# hubiera en el registro el día de la construcción. Corepack está además en
# desuso.
RUN npm install --global pnpm@11.24.0

# `pnpm-workspace.yaml` declara qué dependencias pueden ejecutar scripts de
# instalación. Sin él, pnpm 11 termina con ERR_PNPM_IGNORED_BUILDS.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# `--ignore-scripts`: el script `prepare` del proyecto instala los hooks de
# husky, que no existen ni tienen sentido en una imagen de producción —sin
# devDependencies, `husky` no está y el `pnpm install` aborta—. Omitir los
# scripts de instalación es además la práctica habitual de endurecimiento en
# producción: ninguna de las dependencias de ejecución necesita compilar nada.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts && pnpm store prune

COPY . .

USER appuser

EXPOSE 3000

ENTRYPOINT ["node", "src/server.js"]
