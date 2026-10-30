# Backend — Sistema de stock para pymes (V1)

API REST para gestionar el stock de mercancía de una pyme: catálogo de
productos, movimientos de entrada/salida/ajuste con historial auditable,
dashboard para administradores y contables, y configuración por empresa.

Stack: **Node + Express + Sequelize + SQLite**, autenticación con **JWT**.

---

## Puesta en marcha

```bash
cd backend
npm install
cp .env.example .env
npm run db:seed
npm run dev
```

La API queda en `http://localhost:4000/api`. Para comprobarlo:

```bash
curl http://localhost:4000/api/health
```

### Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor con recarga automática (nodemon) |
| `npm start` | Servidor sin recarga |
| `npm run db:sync` | Crea o actualiza las tablas sin tocar los datos |
| `npm run db:seed` | Carga datos de demo (no hace nada si la base ya tiene datos) |
| `npm run db:reset` | Borra todo y vuelve a cargar los datos de demo |

### Variables de entorno

Están documentadas en `.env.example`. Las que importan:

- `JWT_SECRET` — secreto de firma de los tokens. **Cambiar en producción**: el
  valor del ejemplo es público.
- `DB_STORAGE` — ruta del archivo SQLite (por defecto `data/inventario.sqlite`).
- `CORS_ORIGIN` — orígenes permitidos, separados por coma. Por defecto apunta
  al dev server de Vite (`http://localhost:5173`).
- `DB_SYNC` — si es `true`, sincroniza el esquema al arrancar. Útil en
  desarrollo; en producción conviene pasar a migraciones.

---

## Cuentas de demo

Todas usan la contraseña `Password123`.

| Email | Rol | Para qué sirve |
| --- | --- | --- |
| `superadmin@sistema.test` | Administrador de plataforma | Crea y administra empresas |
| `admin@eltornillo.test` | Admin de empresa | Todo dentro de Ferretería El Tornillo |
| `contable@eltornillo.test` | Contable | Dashboard e historial, sin escritura |
| `deposito@eltornillo.test` | Operador | Ve el stock y lo mueve |
| `admin@laesquina.test` | Admin de empresa | Segunda empresa, para probar el aislamiento |
| `deposito@laesquina.test` | Operador | Segunda empresa |

---

## Roles y permisos

| | `super_admin` | `admin` | `accountant` | `operator` |
| --- | :-: | :-: | :-: | :-: |
| Empresas (`/companies`) | ✅ | — | — | — |
| Usuarios de la empresa | ✅ | ✅ | — | — |
| Configuración de la empresa | ✅ | ✅ | solo lectura | — |
| Dashboard | ✅ | ✅ | ✅ | — |
| Productos y categorías | ✅ | ✅ | solo lectura | solo lectura |
| Movimientos de stock | ✅ | ✅ | solo lectura | ✅ |

`super_admin` es el único rol sin empresa asignada: para operar sobre una
empresa concreta tiene que indicarla con el header `X-Company-Id` o el
parámetro `?companyId=`. Sin eso, los endpoints con alcance de empresa
responden `400`.

### Aislamiento entre empresas

Es la pieza central del diseño. Todas las tablas de negocio llevan
`companyId`, y ese valor **nunca** se lee del body ni de la query: lo resuelve
`src/middleware/tenant.js` a partir del token y lo deja en `req.companyId`, que
es lo que usan todas las consultas. Pedir un recurso de otra empresa devuelve
`404`, no `403`, para no filtrar que ese recurso existe.

---

## Endpoints

Base: `/api`. Salvo `login` y `health`, todos piden
`Authorization: Bearer <token>`.

### Autenticación

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/auth/login` | Devuelve `{ token, user }`. Limitado a 20 intentos cada 15 min |
| `GET` | `/auth/me` | Usuario actual con su empresa y configuración |
| `POST` | `/auth/change-password` | Cambia la contraseña propia |

### Productos

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/products` | Listado paginado |
| `POST` | `/products` | Alta. Con `initialQuantity` genera el movimiento de apertura |
| `GET` | `/products/:id` | Detalle |
| `PATCH` | `/products/:id` | Edición (el stock **no** se toca por acá) |
| `DELETE` | `/products/:id` | Baja lógica (`active: false`) |
| `GET` | `/products/:id/movements` | Historial del producto |

Filtros de `GET /products`: `search` (nombre, SKU o código de barras),
`categoryId`, `active`, `lowStock`, `sortBy` (`name`, `sku`, `quantity`,
`createdAt`, `updatedAt`), `sortDir`, `page`, `limit`.

Cada producto viene con dos campos calculados para que el frontend no repita la
regla del umbral: `effectiveMinStock` (el mínimo del producto o, si no tiene, el
de la empresa) y `stockStatus` (`ok` | `low` | `out`).

### Movimientos de stock

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/stock/movements` | Historial de la empresa |
| `GET` | `/stock/movements/:id` | Detalle |
| `POST` | `/stock/movements` | Registra un movimiento |
| `POST` | `/stock/movements/batch` | Varios movimientos en una transacción |

Filtros: `productId`, `userId`, `type`, `from`, `to`, `days`, `search`, `page`,
`limit`.

`days=30` es un atajo para "los últimos 30 días". Lo resuelve el backend usando
la zona horaria de la empresa, así que no depende del reloj de quien consulta;
si además se manda `from`, gana `from`.

Tres tipos de movimiento:

- `in` — entrada. `quantity` es cuánto entra.
- `out` — salida. `quantity` es cuánto sale. Falla con `400` si no hay stock
  suficiente, salvo que la empresa tenga `allowNegativeStock: true`.
- `adjustment` — ajuste por conteo físico. `quantity` es **el conteo final**,
  no la diferencia; el backend calcula el delta.

```bash
curl -X POST http://localhost:4000/api/stock/movements \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"productId":"...","type":"out","quantity":3,"reason":"Venta mostrador","reference":"FC-0042"}'
```

Cada movimiento guarda `quantityBefore`, `delta`, `quantityAfter`, el autor y la
fecha. Son registro de auditoría: no se editan ni se borran.

### Dashboard

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/dashboard/summary` | Totales, valorización del inventario y actividad |
| `GET` | `/dashboard/low-stock` | Productos a reponer, con `missingUnits` |
| `GET` | `/dashboard/movements?days=30` | Serie diaria de entradas, salidas y ajustes |
| `GET` | `/dashboard/top-products?days=30` | Productos con más rotación |
| `GET` | `/dashboard/stock-by-category` | Valorización agrupada por categoría |

La serie diaria rellena los días sin movimientos, así que el frontend puede
graficarla directo sin completar huecos.

### Categorías, usuarios, configuración y empresas

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` `POST` | `/categories` | Listar y crear |
| `GET` `PATCH` `DELETE` | `/categories/:id` | Detalle, edición y baja |
| `GET` `POST` | `/users` | Usuarios de la empresa (solo admin) |
| `GET` `PATCH` `DELETE` | `/users/:id` | Detalle, edición y baja lógica |
| `GET` `PATCH` | `/settings/company` | Datos y preferencias de la propia empresa |
| `GET` | `/settings/options` | Roles, unidades y tipos de movimiento para los selects |
| `GET` `POST` | `/companies` | Panel de plataforma (solo `super_admin`) |
| `GET` `PATCH` | `/companies/:id` | Detalle y edición de una empresa |

`POST /companies` acepta un objeto `admin` opcional y crea la empresa junto con
su primer administrador en una sola transacción.

Borrar una categoría con productos la desactiva en lugar de eliminarla, para no
dejar productos apuntando a nada. Los usuarios tampoco se borran: se desactivan,
porque los movimientos guardan quién los hizo. Tampoco se puede dejar una
empresa sin ningún administrador activo, ni desactivarse a uno mismo.

---

## Formato de las respuestas

Listados paginados:

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 25, "total": 137, "totalPages": 6 }
}
```

Un solo recurso: `{ "data": { ... } }`.

Errores, siempre con la misma forma:

```json
{
  "error": {
    "message": "Los datos enviados no son validos",
    "details": [{ "field": "quantity", "message": "Debe ser mayor a cero" }]
  }
}
```

Códigos: `400` validación o regla de negocio, `401` sin token o token vencido,
`403` rol insuficiente, `404` no existe (o es de otra empresa), `409` duplicado.

---

## Estructura

```
src/
  config/        env y conexión a la base
  constants/     roles, tipos de movimiento, unidades
  models/        modelos Sequelize y asociaciones
  middleware/    auth, authorize, tenant, validate, errorHandler
  validators/    esquemas zod por recurso
  services/      lógica transaccional de stock y firma de tokens
  controllers/   handlers HTTP
  routes/        montaje de rutas y permisos por endpoint
seeders/         datos de demo
scripts/         smoke-test.sh y sync del esquema
```

El stock sólo se modifica en `src/services/stockService.js`, dentro de una
transacción que guarda el producto y su movimiento juntos. Los controladores no
escriben `quantity` directamente, así que el stock y su historial no pueden
quedar desincronizados. SQLite no tiene `SELECT ... FOR UPDATE`, así que las
transacciones se abren en modo `IMMEDIATE` para tomar el lock de escritura
desde el principio y evitar que dos movimientos simultáneos lean el mismo stock.

---

## Pruebas

`scripts/smoke-test.sh` recorre la API de punta a punta con curl: login, los
cuatro roles, aislamiento entre empresas, catálogo, los tres tipos de
movimiento, reversión de lotes fallidos, dashboard y configuración.

```bash
npm run db:reset
npm start
# en otra terminal
bash scripts/smoke-test.sh
```

Son 63 comprobaciones. Dejan algunos registros de prueba en la base, así que
conviene un `npm run db:reset` después.

---

## Decisiones y límites conocidos

**Multiempresa desde el primer día.** El modelo ya está preparado aunque la V1
no tenga pantallas para gestionar empresas: agregar `companyId` después hubiera
significado tocar todos los modelos, consultas y endpoints.

**Sin refresh tokens.** Hay un único access token (`JWT_EXPIRES_IN`, 1 día por
defecto). Cuando vence, hay que volver a iniciar sesión. Alcanza para la V1,
pero es lo primero a agregar si se quiere mantener la sesión viva.

**El token se revalida en cada pedido.** `src/middleware/auth.js` relee el
usuario de la base, así que una baja o un cambio de rol tiene efecto inmediato
sin esperar a que expire el token. Cuesta una consulta extra por request.

**Importes en `DECIMAL(12,2)` sobre SQLite.** SQLite no tiene un tipo decimal
real y lo guarda con afinidad numérica, así que los importes son floats por
debajo. Para la V1 va bien; si la contabilidad se vuelve seria, conviene pasar a
enteros en centavos o a Postgres.

**`sync` en lugar de migraciones.** Alcanza mientras el esquema se mueve rápido.
Antes de poner esto en producción hay que pasar a `sequelize-cli` migrations:
con `sync` un cambio de columna puede implicar perder datos.

**Las fechas del dashboard usan la zona horaria de la empresa.** SQLite agrupa
en UTC, así que las consultas aplican el desplazamiento de
`settings.timezone` para que "hoy" sea el día local de la pyme y no el del
servidor.

**Sin exportación.** Un contable va a querer sacar el inventario a Excel o PDF.
No está en la V1.
