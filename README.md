# Auth

Cuentas, credenciales de los dos canales (JWT para la web, API KEY para la API) y ciclo de vida de la cuenta del SaaS de reconocimiento facial del TFM. Node.js, Express y MongoDB.

- **Contrato:** [`openapi/auth.yaml`](openapi/auth.yaml), 11 operaciones, todas implementadas. Es la fuente de verdad: si el código y el contrato discrepan, se corrige el código.
- Parte de `node-template`, la plantilla de los microservicios Node.js del proyecto; de ahí la estructura que se describe abajo.

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

- **`AppError` (`src/utils/AppError.js`)**: Clase extendida para lanzar errores operacionales, con estado HTTP y código simbólico (ej. `new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND')`).
- **`errorHandler` (`src/middlewares/errorHandler.js`)**: Interceptador global en `src/app.js` que estandariza todas las respuestas de error como `{ code, message, details? }`, el esquema `ErrorReport` del contrato. El `code` permite distinguir subtipos dentro de un mismo estado HTTP (`ACCOUNT_SUSPENDED` frente a `FORBIDDEN` en un 403) sin obligar al cliente a interpretar el texto. La traza sólo se incluye en desarrollo.
- **`notFound` (`src/middlewares/notFound.js`)**: Captura peticiones a rutas inexistentes y lanza un error `404`.

### 3. Validación Estricta con Joi

Validación declarativa de datos de entrada (`req.body`, `req.query`, `req.params`) para evitar inyecciones e inconsistencias:

- Interceptada por el middleware **`validate` (`src/middlewares/validate.js`)**.
- Los fallos en esquemas Joi son procesados por el gestor de errores devolviendo código `400 Bad Request` y los detalles específicos de qué campos fallaron.

### 4. Seguridad Activa (Security First)

Implementado globalmente en `src/app.js`:

- **Helmet**: Protege aplicando headers HTTP seguros.
- **CORS**: Habilita configuración controlada del intercambio cruzado de recursos.
- **Rate Limiting (`express-rate-limit`)**: 100 peticiones por IP cada 15 minutos, montado **sólo** sobre `login`, `forgot-password` y `reset-password` (`src/middlewares/rateLimit.js`). No es global. El limitador general es el de la pasarela (Kong), que alcanza a todas las operaciones salvo `validate-key`: por eso las otras diez también declaran `429` en el contrato. No depende del plan.

### 5. Documentación (Swagger / OpenAPI)

La especificación **es** la fuente de verdad, no un artefacto derivado del código: `src/config/swagger.js` carga `openapi/auth.yaml` —el mismo fichero contra el que la suite de contrato valida cada respuesta— y lo sirve tal cual. No se generan anotaciones _JSDoc_ en las rutas: dos descripciones de la misma API divergen en cuanto una se mueve, y aquí una desviación de la documentación hace fallar los tests.

- Interfaz en `/docs` y especificación en `/openapi.json`, ambas fuera del versionado.

### 6. Calidad del Código y Git Hooks (Husky)

Se prohíbe subir código roto o mal formateado. Las herramientas actúan en pre-commit:

- **ESLint & Prettier**: Formatean y analizan la sintaxis (`lint-staged`).
- **Husky (`.husky/`)**:
  - `pre-commit`: Ejecuta `lint-staged` (ESLint y Prettier sobre lo preparado) y la suite de pruebas completa.
  - `commit-msg`: Exige convencionales (Conventional Commits: `feat:`, `fix:`, `chore:`) interceptado mediante `@commitlint/` para estandarizar el historial.

### 7. Integración y Despliegue Continuo (CI/CD)

Múltiples pipelines provistos vía GitHub Actions (`.github/workflows/`):

- **`ci-cd.yml`**: Disparado en cada push y pull request a `main`. Instala dependencias con `pnpm` (usando caché), pasa ESLint, la auditoría de seguridad de dependencias y las pruebas con cobertura.
- **`release.yml`**: Disparado al empujar una etiqueta `v*`. Compila la imagen de Docker, la sube a Docker Hub y crea la release de GitHub con notas generadas a partir de los Conventional Commits.

---

## 🚀 Cómo Ejecutar el Proyecto

El entorno utiliza **`pnpm`** como gestor de paquetes principal. Lo habitual es levantar `auth` con el resto de la pila mediante `scripts/dev-up.sh` del repositorio [docs](https://github.com/TFM-MIS-MEM/docs), que genera los secretos que comparte con la pasarela y con `pricing`. Para levantarlo por separado:

### Prerrequisitos

- Node.js >= 20
- `pnpm` instalado (`npm install -g pnpm`)
- MongoDB (local, o el del compose de desarrollo)

```bash
pnpm install
```

### Configuración

```bash
# Copia .env.example en .env (sobrescribe el .env que haya)
pnpm run env:local
```

Después, sustituye los secretos de ejemplo. El servicio **no arranca** con los valores publicados de `INTERNAL_API_SECRET` (`src/config/internalSecret.js`), y `JWT_SECRET` tiene que coincidir con `SPACE_AUTH_JWT_SECRET` de la pasarela.

### Opción 1: Desarrollo Local (Hot-reload, MongoDB Local)

```bash
pnpm run dev
```

No uses `pnpm run dev:local`: vuelve a copiar `.env.example` antes de arrancar y descarta los secretos que hayas puesto.

### Opción 2: Desarrollo con Docker Compose

Levanta el servicio con recarga en caliente y su MongoDB, publicados solo en el bucle local: el servicio en `127.0.0.1:3000` y MongoDB en `127.0.0.1:27017`.

```bash
docker network create tfm-network   # solo la primera vez
pnpm run docker:dev
```

`pnpm run env:compose` y `pnpm run dev:compose` fallan: copian `.env.docker-compose.example`, que no existe.

### Opción 3: Entorno Producción (Docker Compose)

Compila usando el `Dockerfile` de producción (peso ligero, usuario non-root por seguridad). No publica ningún puerto: el servicio y su base solo se alcanzan desde su red interna.

```bash
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

## ⚠️ Nota de migración — colección `accounts`

La entidad `AuthUser` pasó a llamarse `Account` y su colección de `authusers`
a `accounts` (issue [#25](https://github.com/TFM-MIS-MEM/docs/issues/25)). Con
ella cambiaron los valores admitidos en dos campos:

| Campo    | Antes                             | Ahora                 |
| -------- | --------------------------------- | --------------------- |
| `role`   | `user`, `admin`, `researcher`     | `CUSTOMER`, `ADMIN`   |
| `status` | `active`, `inactive`, `suspended` | `active`, `suspended` |

**No se ha escrito ningún script de migración: se recrea la base.** Los datos
existentes son cuentas de desarrollo sin valor, y `researcher` pertenece a la
solución de investigación, que no se implementa; convertirlo no tendría destino.

```bash
docker compose down -v   # descarta el volumen de MongoDB
docker compose up --build
```

Una base anterior que no se recree deja sus documentos en `authusers`, donde el
servicio ya no los busca: las cuentas parecerán no existir en lugar de fallar.

---

## 🏗️ Estructura Completa del Directorio

```text
auth-microservice/
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
