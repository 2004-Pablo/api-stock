#!/usr/bin/env bash
# Prueba de humo de la API: recorre login, stock, dashboard, configuracion y
# verifica que los permisos por rol y el aislamiento entre empresas funcionen.
#
#   1. npm run db:reset
#   2. npm start
#   3. bash scripts/smoke-test.sh
#
set -uo pipefail

BASE="${BASE:-http://localhost:4000/api}"
PASS="${DEMO_PASSWORD:-Password123}"
ok=0
fail=0

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }

# check <descripcion> <esperado> <metodo> <ruta> [token] [body]
check() {
  local desc="$1" expected="$2" method="$3" path="$4" token="${5:-}" body="${6:-}"
  local args=(-s -o /tmp/smoke_body -w '%{http_code}' -X "$method" "$BASE$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi
  local code
  code=$(curl "${args[@]}")
  if [ "$code" = "$expected" ]; then
    green "  ok   $desc ($code)"
    ok=$((ok + 1))
  else
    red "  FALLA $desc: esperaba $expected, recibio $code"
    head -c 300 /tmp/smoke_body
    echo
    fail=$((fail + 1))
  fi
}

login() {
  curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" |
    node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).token||"")}catch{process.stdout.write("")}})'
}

jsonfield() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);process.stdout.write(String($1??''))}catch{process.stdout.write('')}})"
}

echo
echo "=== 1. Autenticacion ==="
check "login con credenciales validas" 200 POST /auth/login "" \
  "{\"email\":\"admin@eltornillo.test\",\"password\":\"$PASS\"}"
check "login con contrasena incorrecta" 401 POST /auth/login "" \
  '{"email":"admin@eltornillo.test","password":"incorrecta"}'
check "login con email inexistente" 401 POST /auth/login "" \
  "{\"email\":\"nadie@nada.test\",\"password\":\"$PASS\"}"
check "login sin email" 400 POST /auth/login "" '{"password":"x"}'
check "acceso sin token" 401 GET /products
check "acceso con token invalido" 401 GET /products "token-falso"

ADMIN=$(login admin@eltornillo.test)
CONTABLE=$(login contable@eltornillo.test)
OPERADOR=$(login deposito@eltornillo.test)
OTRA_ADMIN=$(login admin@laesquina.test)
SUPER=$(login superadmin@sistema.test)

for name in ADMIN CONTABLE OPERADOR OTRA_ADMIN SUPER; do
  if [ -z "${!name}" ]; then
    red "No se pudo obtener token para $name. Corriste 'npm run db:reset'?"
    exit 1
  fi
done
green "  ok   tokens obtenidos para los 5 roles"
ok=$((ok + 1))

check "GET /auth/me" 200 GET /auth/me "$ADMIN"

echo
echo "=== 2. Permisos por rol ==="
check "admin lista usuarios" 200 GET /users "$ADMIN"
check "operador NO lista usuarios" 403 GET /users "$OPERADOR"
check "contable NO lista usuarios" 403 GET /users "$CONTABLE"
check "admin ve el dashboard" 200 GET /dashboard/summary "$ADMIN"
check "contable ve el dashboard" 200 GET /dashboard/summary "$CONTABLE"
check "operador NO ve el dashboard" 403 GET /dashboard/summary "$OPERADOR"
check "operador lee productos" 200 GET /products "$OPERADOR"
check "operador NO crea productos" 403 POST /products "$OPERADOR" \
  '{"sku":"X-1","name":"No deberia entrar"}'
check "contable NO mueve stock" 403 POST /stock/movements "$CONTABLE" \
  '{"productId":"00000000-0000-4000-8000-000000000000","type":"in","quantity":1}'
check "admin NO entra al panel de plataforma" 403 GET /companies "$ADMIN"
check "super_admin lista empresas" 200 GET /companies "$SUPER"

echo
echo "=== 3. Aislamiento entre empresas ==="
PROD_OTRA=$(curl -s -H "Authorization: Bearer $OTRA_ADMIN" "$BASE/products?limit=1" |
  jsonfield 'o.data[0].id')
if [ -n "$PROD_OTRA" ]; then
  check "producto de otra empresa da 404 (no 403)" 404 GET "/products/$PROD_OTRA" "$ADMIN"
  check "mover stock de otra empresa da 404" 404 POST /stock/movements "$ADMIN" \
    "{\"productId\":\"$PROD_OTRA\",\"type\":\"in\",\"quantity\":1}"
else
  red "  FALLA no se pudo leer un producto de la otra empresa"
  fail=$((fail + 1))
fi
check "super_admin sin empresa indicada da 400" 400 GET /products "$SUPER"
check "super_admin con empresa indicada" 200 GET "/products?companyId=$(
  curl -s -H "Authorization: Bearer $SUPER" "$BASE/companies?limit=1" | jsonfield 'o.data[0].id'
)" "$SUPER"

echo
echo "=== 4. Catalogo ==="
CAT_ID=$(curl -s -X POST "$BASE/categories" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Prueba humo","description":"Categoria temporal"}' | jsonfield 'o.data.id')
[ -n "$CAT_ID" ] && { green "  ok   categoria creada"; ok=$((ok + 1)); } ||
  { red "  FALLA no se pudo crear la categoria"; fail=$((fail + 1)); }
check "categoria duplicada da 409" 409 POST /categories "$ADMIN" '{"name":"Prueba humo"}'

SKU="SMOKE-$RANDOM"
PROD_ID=$(curl -s -X POST "$BASE/products" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU\",\"name\":\"Producto de prueba\",\"categoryId\":\"$CAT_ID\",\"costPrice\":100,\"salePrice\":250,\"minStock\":10,\"initialQuantity\":20}" |
  jsonfield 'o.data.id')
[ -n "$PROD_ID" ] && { green "  ok   producto creado con stock inicial"; ok=$((ok + 1)); } ||
  { red "  FALLA no se pudo crear el producto"; fail=$((fail + 1)); }
check "SKU duplicado da 409" 409 POST /products "$ADMIN" \
  "{\"sku\":\"$SKU\",\"name\":\"Otro\"}"
check "producto sin nombre da 400" 400 POST /products "$ADMIN" '{"sku":"ZZZ-9"}'
check "id mal formado da 400" 400 GET /products/no-es-un-uuid "$ADMIN"
check "filtro de stock bajo" 200 GET "/products?lowStock=true" "$ADMIN"
check "busqueda por texto" 200 GET "/products?search=taladro" "$ADMIN"
check "orden por cantidad" 200 GET "/products?sortBy=quantity&sortDir=desc" "$ADMIN"

echo
echo "=== 5. Movimientos de stock ==="
QTY() { curl -s -H "Authorization: Bearer $ADMIN" "$BASE/products/$PROD_ID" | jsonfield 'o.data.quantity'; }
before=$(QTY)
check "entrada de stock" 201 POST /stock/movements "$OPERADOR" \
  "{\"productId\":\"$PROD_ID\",\"type\":\"in\",\"quantity\":5,\"reason\":\"Prueba\"}"
check "salida de stock" 201 POST /stock/movements "$OPERADOR" \
  "{\"productId\":\"$PROD_ID\",\"type\":\"out\",\"quantity\":3,\"reason\":\"Prueba\"}"
after=$(QTY)
if [ "$after" = "$(node -e "process.stdout.write(String($before + 2))")" ]; then
  green "  ok   el stock paso de $before a $after (+5 -3)"
  ok=$((ok + 1))
else
  red "  FALLA el stock quedo en $after, se esperaba $before + 2"
  fail=$((fail + 1))
fi
check "salida mayor al stock da 400" 400 POST /stock/movements "$OPERADOR" \
  "{\"productId\":\"$PROD_ID\",\"type\":\"out\",\"quantity\":99999}"
check "cantidad cero en una entrada da 400" 400 POST /stock/movements "$OPERADOR" \
  "{\"productId\":\"$PROD_ID\",\"type\":\"in\",\"quantity\":0}"
check "ajuste por conteo fisico" 201 POST /stock/movements "$ADMIN" \
  "{\"productId\":\"$PROD_ID\",\"type\":\"adjustment\",\"quantity\":7,\"reason\":\"Conteo\"}"
adjusted=$(QTY)
if [ "$adjusted" = "7" ]; then
  green "  ok   el ajuste dejo el stock en 7"
  ok=$((ok + 1))
else
  red "  FALLA tras el ajuste el stock quedo en $adjusted, se esperaba 7"
  fail=$((fail + 1))
fi
check "ajuste que no cambia nada da 400" 400 POST /stock/movements "$ADMIN" \
  "{\"productId\":\"$PROD_ID\",\"type\":\"adjustment\",\"quantity\":7}"
check "lote de movimientos" 201 POST /stock/movements/batch "$ADMIN" \
  "{\"reference\":\"REM-SMOKE\",\"items\":[{\"productId\":\"$PROD_ID\",\"type\":\"in\",\"quantity\":4},{\"productId\":\"$PROD_ID\",\"type\":\"in\",\"quantity\":6}]}"
check "lote con un item invalido se revierte entero" 400 POST /stock/movements/batch "$ADMIN" \
  "{\"items\":[{\"productId\":\"$PROD_ID\",\"type\":\"in\",\"quantity\":1},{\"productId\":\"$PROD_ID\",\"type\":\"out\",\"quantity\":99999}]}"
batched=$(QTY)
if [ "$batched" = "17" ]; then
  green "  ok   el lote fallido no dejo cambios (stock en 17)"
  ok=$((ok + 1))
else
  red "  FALLA el stock quedo en $batched, se esperaba 17"
  fail=$((fail + 1))
fi
check "historial del producto" 200 GET "/products/$PROD_ID/movements" "$ADMIN"
check "historial filtrado por tipo" 200 GET "/stock/movements?type=out" "$ADMIN"
check "historial filtrado por producto" 200 GET "/stock/movements?productId=$PROD_ID" "$CONTABLE"

echo
echo "=== 6. Dashboard ==="
check "resumen" 200 GET /dashboard/summary "$ADMIN"
check "stock bajo" 200 GET /dashboard/low-stock "$ADMIN"
check "serie de movimientos" 200 GET "/dashboard/movements?days=14" "$ADMIN"
check "productos mas movidos" 200 GET "/dashboard/top-products?days=30&limit=5" "$ADMIN"
check "stock por categoria" 200 GET /dashboard/stock-by-category "$CONTABLE"

echo
echo "=== 7. Usuarios y configuracion ==="
NEW_EMAIL="smoke-$RANDOM@eltornillo.test"
USER_ID=$(curl -s -X POST "$BASE/users" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Usuario Humo\",\"email\":\"$NEW_EMAIL\",\"password\":\"Password123\",\"role\":\"operator\"}" |
  jsonfield 'o.data.id')
[ -n "$USER_ID" ] && { green "  ok   usuario creado"; ok=$((ok + 1)); } ||
  { red "  FALLA no se pudo crear el usuario"; fail=$((fail + 1)); }
check "email repetido da 409" 409 POST /users "$ADMIN" \
  "{\"name\":\"Otro\",\"email\":\"$NEW_EMAIL\",\"password\":\"Password123\",\"role\":\"operator\"}"
check "contrasena corta da 400" 400 POST /users "$ADMIN" \
  '{"name":"Corto","email":"corto@eltornillo.test","password":"123","role":"operator"}'
check "no se puede asignar super_admin" 400 POST /users "$ADMIN" \
  '{"name":"Hack","email":"hack@eltornillo.test","password":"Password123","role":"super_admin"}'
check "desactivar usuario" 200 DELETE "/users/$USER_ID" "$ADMIN"
check "el admin no se desactiva a si mismo" 400 PATCH "/users/$(
  curl -s -H "Authorization: Bearer $ADMIN" "$BASE/auth/me" | jsonfield 'o.user.id'
)" "$ADMIN" '{"active":false}'
check "leer configuracion de la empresa" 200 GET /settings/company "$ADMIN"
check "editar configuracion de la empresa" 200 PATCH /settings/company "$ADMIN" \
  '{"settings":{"defaultMinStock":12}}'
check "contable NO edita la configuracion" 403 PATCH /settings/company "$CONTABLE" \
  '{"settings":{"defaultMinStock":99}}'
check "catalogos para selects" 200 GET /settings/options "$OPERADOR"
check "cambio de contrasena con la actual incorrecta" 400 POST /auth/change-password "$ADMIN" \
  '{"currentPassword":"incorrecta","newPassword":"NuevaPassword123"}'
check "ruta inexistente da 404" 404 GET /no-existe "$ADMIN"

echo
echo "========================================"
if [ "$fail" -eq 0 ]; then
  green "$ok pruebas pasaron, 0 fallaron"
else
  red "$ok pruebas pasaron, $fail fallaron"
fi
echo "========================================"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
