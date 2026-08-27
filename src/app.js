const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { setupSwagger } = require('./config/swagger');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const config = require('./config');

const app = express();

// Los microservicios sólo son alcanzables a través de Kong: la IP real del
// cliente llega en X-Forwarded-For y la escribe la pasarela.
app.set('trust proxy', 1);

// ---------------------
// Seguridad
// ---------------------
app.use((req, res, next) => {
  if (req.path.startsWith('/docs')) {
    // Swagger UI necesita estilos y scripts en línea; el relajo se acota a ella.
    helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })(req, res, next);
  } else {
    helmet()(req, res, next);
  }
});

app.use(cors());

// El limitador de tasa se monta por operación en `src/routes/auth.routes.js`:
// sólo tres del contrato declaran 429 y devolverlo en las demás sería una
// respuesta no conforme.

// ---------------------
// Lectura del cuerpo
// ---------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------------
// Trazas HTTP
// ---------------------
if (!config.isTest) {
  app.use(morgan('dev'));
}

// ---------------------
// Documentación (/docs y /openapi.json)
// ---------------------
setupSwagger(app);

// ---------------------
// Rutas
// ---------------------
app.use(routes);

// ---------------------
// Errores — patrón ERROR REPORT
// ---------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
