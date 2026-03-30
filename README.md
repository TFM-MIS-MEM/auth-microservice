# Node.js Microservice Template

Boilerplate profesional y escalable para los microservicios Node.js (Auth, Pricing, etc.) del Trabajo de Fin de Máster (TFM) del SaaS de Reconocimiento Facial.

Esta plantilla está diseñada como punto de partida para cualquier servicio backend en Node.js, incorporando todas las directrices globales del proyecto (Clean Architecture, seguridad, manejo de errores y pipelines de despliegue).

---

## 🌟 Arquitectura y Funcionalidades Integradas

El proyecto implementa las siguientes características clave para garantizar el estándar de calidad:

### 1. Clean Architecture y Estructura Modular

El código está dividido en capas lógicas estrictas para favorecer el mantenimiento y la escalabilidad (MVC modificado para APIs REST):

- **Rutas (`src/routes/`)**: Definen los endpoints de la API ("Public API" y "Solution-Internal API") y aplican middlewares.
- **Controladores (`src/controllers/`)**: Reciben las peticiones HTTP (`req`, `res`), validan flujos básicos y delegan la lógica al servicio.
- **Servicios (`src/services/`)**: Contienen la lógica de negocio pura, agnóstica a Express. Realizan las operaciones CRUD o de procesamiento.
- **Modelos (`src/models/`)**: Definen esquemas usando Mongoose para interactuar con MongoDB (siguiendo el patrón `Data Holder`).

### 2. Error Report Pattern (Manejo de Errores Global)

En lugar de manejar errores localmente en cada controlador, se centralizan:

- **`AppError` (`src/utils/AppError.js`)**: Clase extendida para lanzar errores operacionales (ej. `new AppError("User not found", 404)`).
- **`errorHandler` (`src/middlewares/errorHandler.js`)**: Interceptador global en `src/app.js` que estandariza todas las respuestas de error en formato JSON consistente: `{ status, message, details }`. Evita fugas de información de stack trace en producción.
- **`notFound` (`src/middlewares/notFound.js`)**: Captura peticiones a rutas inexistentes y lanza un error `404`.

### 3. Validación Estricta con Joi

Validación declarativa de datos de entrada (`req.body`, `req.query`, `req.params`) para evitar inyecciones e inconsistencias:

- Interceptada por el middleware **`validate` (`src/middlewares/validate.js`)**.
- Los fallos en esquemas Joi son procesados por el gestor de errores devolviendo código `400 Bad Request` y los detalles específicos de qué campos fallaron.

### 4. Seguridad Activa (Security First)

Implementado globalmente en `src/app.js`:

- **Helmet**: Protege aplicando headers HTTP seguros.
- **CORS**: Habilita configuración controlada del intercambio cruzado de recursos.
- **Rate Limiting (`express-rate-limit`)**: Limita peticiones por IP (ej. 100 peticiones cada 15 min en `/api`) para prevenir ataques de denegación de servicio o fuerza bruta.

### 5. Documentación Dinámica (Swagger / OpenAPI)

Las APIs se autodocumentan leyendo comentarios _JSDoc_ presentes sobre las rutas.

- Interfaz disponible en `/api/v1/docs` (configurada vía `src/config/swagger.js`).

### 6. Calidad del Código y Git Hooks (Husky)

Se prohíbe subir código roto o mal formateado. Las herramientas actúan en pre-commit:

- **ESLint & Prettier**: Formatean y analizan la sintaxis (`lint-staged`).
- **Husky (`.husky/`)**:
  - `pre-commit`: Dispara verificación de linter, prettier y opcionalmente testing preventivo.
  - `commit-msg`: Exige convencionales (Conventional Commits: `feat:`, `fix:`, `chore:`) interceptado mediante `@commitlint/` para estandarizar el historial.

### 7. Integración y Despliegue Continuo (CI/CD)

Múltiples pipelines provistos vía GitHub Actions (`.github/workflows/`):

- **`ci-cd.yml`**: Disparado en cada Push/Pull Request. Instala dependencias con `pnpm` (usando caché), linta, verifica formato y ejecuta tests unitarios.
- **`release.yml`**: Crea versiones automáticas (Semantic Release) basadas en commits, genera Changelogs de GitHub, compila la imagen de Docker, y la sube al Container Registry (Docker Hub/GHCR) adaptándose al entorno (dev/prod).

---

## 🚀 Cómo Ejecutar el Proyecto

El entorno utiliza **`pnpm`** como gestor de paquetes principal. Todos los entornos manejan sus archivos `.env` a través de utilidades en la carpeta `/scripts`.

### Prerrequisitos

- Node.js >= 20
- Colección `pnpm` instalada (`npm install -g pnpm`)
- MongoDB (local, o Dockerizado)

```bash
pnpm install
```

### Opción 1: Desarrollo Local (Hot-reload, MongoDB Local)

Recomendado si ya tienes MongoDB y dependencias corriendo localmente.

```bash
# 1. Autogenera el archivo .env consumiendo .env.local.example
pnpm run env:local

# 2. Inicia servidor con recarga usando Nodemon
pnpm run dev:local
```

### Opción 2: Desarrollo con Docker Compose (Recomendado)

Levanta la base de datos MongoDB y el backend Node empaquetado, compartiendo volúmenes. Con esto evitas incompatibilidades locales y conservas hot-reload.

```bash
# 1. Configura el .env de docker (`Scripts` lo copia de .env.docker.example)
pnpm run env:compose

# 2. Levanta servicio y DB en contenedores (Mapea cambios a tiempo real)
pnpm run dev:compose
```

### Opción 3: Entorno Producción (Docker Compose)

Compila usando el `Dockerfile` de producción (peso ligero, usuario non-root por seguridad).

```bash
pnpm run env:compose
pnpm run docker:prod
```

---

## ✅ Lista de Comandos Disponibles

- `pnpm run dev`: Inicia Nodemon sin copiar variables de entorno previamente.
- `pnpm test`: Ejecuta Jest con los tests de integración y/u unitarios (busca en `/tests`).
- `pnpm run test:coverage`: Extrae reporte de cobertura del testeo.
- `pnpm run lint`: Busca anomalías en el código base.
- `pnpm run lint:fix`: Autocorrige fallos sintácticos (espaciados, comillas).
- `pnpm run format`: Prettier fuerza un formateo a lo largo de toda la fuente del proyecto de los archivos configurados (`*.js`).

---

## 🏗️ Estructura Completa del Directorio

```text
node-template/
├── .github/                # Workflows de CI/CD (GitHub Actions)
├── .husky/                 # Git hooks para validación de pre-commits y mensajes de commit
├── scripts/                # Scripts utilitarios (ej. automatizar copia de .env)
├── src/                    # Código fuente principal de la app
│   ├── app.js              # Inicialización de Express, Middlewares (limiter, helmet, cors) y logs
│   ├── server.js           # Orquestación global: Inicia conexión a MongoDB y asocia el puerto
│   ├── config/             # Variables de setup (env config, swagger UI)
│   ├── controllers/        # Controladores REST. Lógica de Request / Response (HTTP).
│   ├── middlewares/        # Piezas intermedias: Gestor de Errores Global, Validadores Joi.
│   ├── models/             # Esquemas relacionales con Mongoose
│   ├── routes/             # Orquestador de Paths expuestos
│   ├── services/           # Reglas de negocio y transacciones (Separado de Req/Res estricto)
│   └── utils/              # Clases y helpers: `AppError.js` custom error, Loggers, etc.
├── tests/                  # Entorno Jest y Supertest
├── Dockerfile              # Construcción multi-stage de producción
├── Dockerfile.dev          # Construcción en modo desarrollo
└── package.json            # Definición principal de Node para las abstracciones
```
