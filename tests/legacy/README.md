# Suite anterior (excluida de la ejecución)

Estos tests **no se ejecutan**: `jest.config.js` los excluye mediante
`testPathIgnorePatterns`. Se conservan a propósito.

## Por qué se retiran

Fijaban un contrato que ya no es el vigente. Documentaban, y por tanto
protegían, exactamente aquello que hay que cambiar:

| Elemento | Suite anterior | `openapi/auth.yaml` |
|---|---|---|
| Prefijo de ruta | `/api/v1/auth/...` | `/v1/auth/...` |
| Envoltorio de respuesta | `{ status, message, data }` | recurso plano |
| Cuerpo de error | `{ status, message }` | `{ code, message }` (Error Report) |
| Roles | `user`, `admin`, `researcher` | `CUSTOMER`, `ADMIN` |
| Estados de cuenta | `active`, `inactive`, `suspended` | `active`, `suspended` |
| Identificador | `user.id` | `accountId` |
| Validación de API KEY | `POST /internal/validate-api-key`, clave en el cuerpo, protegida por `x-internal-secret` | `POST /v1/auth/validate-key`, clave en la cabecera `X-API-Key` |
| Rotación de clave | `POST /rotate-api-key`, `200`, sin confirmar contraseña | `POST /rotate-key`, `201`, exige `password` |
| Recuperación | `forgot-password` → `200`, y `404` si el correo no existe | `202` siempre (impide enumerar usuarios) |

Mientras estos tests estuvieran en verde, cualquier avance hacia la
especificación aparecía como una regresión. Eran la razón de que no hubiera red
de seguridad: no protegían el contrato, protegían su versión obsoleta.

## Por qué se conservan

1. Documentan el comportamiento previo con precisión, que es lo que permite
   redactar en la memoria del TFM *qué* cambió y *por qué*.
2. Sirven de contraste con `tests/contract/`, que se derivan de la
   especificación en lugar de describir la implementación.

No deben corregirse ni adaptarse. Se borrarán cuando el capítulo
correspondiente de la memoria esté escrito.
