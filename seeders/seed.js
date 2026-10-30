import { sequelize, Company, User, Category, Product } from '../src/models/index.js';
import { connectDatabase } from '../src/config/database.js';
import { registerMovement } from '../src/services/stockService.js';
import { MOVEMENT_TYPES, ROLES } from '../src/constants/roles.js';
import { DEFAULT_COMPANY_SETTINGS } from '../src/models/Company.js';

const force = process.argv.includes('--force');

// Contrasenas de demo. Sirven para probar la API en local; en una instalacion
// real se cambian en el primer ingreso.
const DEMO_PASSWORD = 'Password123';

const COMPANIES = [
  {
    name: 'Ferreteria El Tornillo',
    slug: 'ferreteria-el-tornillo',
    taxId: '30-71234567-9',
    email: 'contacto@eltornillo.test',
    phone: '+54 11 4555-1234',
    address: 'Av. Rivadavia 1234, CABA',
    settings: { ...DEFAULT_COMPANY_SETTINGS, defaultMinStock: 10 },
    users: [
      { name: 'Laura Gimenez', email: 'admin@eltornillo.test', role: ROLES.ADMIN },
      { name: 'Diego Ferrer', email: 'contable@eltornillo.test', role: ROLES.ACCOUNTANT },
      { name: 'Marcos Rios', email: 'deposito@eltornillo.test', role: ROLES.OPERATOR },
    ],
    categories: [
      { name: 'Herramientas', description: 'Herramientas manuales y electricas' },
      { name: 'Tornilleria', description: 'Tornillos, tuercas y arandelas' },
      { name: 'Pinturas', description: 'Pinturas, barnices y accesorios' },
      { name: 'Electricidad', description: 'Cables, llaves y tomas' },
    ],
    products: [
      { sku: 'HER-001', name: 'Taladro percutor 650W', category: 'Herramientas', unit: 'unidad', costPrice: 48000, salePrice: 79900, minStock: 3, initial: 8, location: 'Pasillo A - Est. 1' },
      { sku: 'HER-002', name: 'Juego de destornilladores 6 piezas', category: 'Herramientas', unit: 'pack', costPrice: 6200, salePrice: 11500, minStock: 10, initial: 24, location: 'Pasillo A - Est. 2' },
      { sku: 'HER-003', name: 'Martillo carpintero 500g', category: 'Herramientas', unit: 'unidad', costPrice: 4100, salePrice: 7900, minStock: 8, initial: 5, location: 'Pasillo A - Est. 2' },
      { sku: 'TOR-010', name: 'Tornillo autoperforante 8x1 (caja x100)', category: 'Tornilleria', unit: 'caja', costPrice: 3500, salePrice: 6400, minStock: 15, initial: 60, location: 'Pasillo B - Est. 1' },
      { sku: 'TOR-011', name: 'Tuerca hexagonal M8 (caja x200)', category: 'Tornilleria', unit: 'caja', costPrice: 2800, salePrice: 5200, minStock: 15, initial: 12, location: 'Pasillo B - Est. 1' },
      { sku: 'PIN-020', name: 'Latex interior blanco 20L', category: 'Pinturas', unit: 'unidad', costPrice: 32000, salePrice: 54900, minStock: 5, initial: 14, location: 'Pasillo C - Est. 3' },
      { sku: 'PIN-021', name: 'Rodillo de lana 22cm', category: 'Pinturas', unit: 'unidad', costPrice: 2400, salePrice: 4900, minStock: 12, initial: 9, location: 'Pasillo C - Est. 1' },
      { sku: 'ELE-030', name: 'Cable unipolar 2.5mm (rollo 100m)', category: 'Electricidad', unit: 'unidad', costPrice: 41000, salePrice: 68000, minStock: 4, initial: 9, location: 'Pasillo D - Est. 2' },
      { sku: 'ELE-031', name: 'Llave termica bipolar 25A', category: 'Electricidad', unit: 'unidad', costPrice: 8900, salePrice: 15900, minStock: 10, initial: 31, location: 'Pasillo D - Est. 1' },
      { sku: 'ELE-032', name: 'Cinta aisladora 20m', category: 'Electricidad', unit: 'unidad', costPrice: 950, salePrice: 2200, minStock: 20, initial: 18, location: 'Mostrador' },
    ],
  },
  {
    name: 'Distribuidora La Esquina',
    slug: 'distribuidora-la-esquina',
    taxId: '30-70987654-3',
    email: 'ventas@laesquina.test',
    phone: '+54 341 555-7788',
    address: 'San Martin 880, Rosario',
    settings: { ...DEFAULT_COMPANY_SETTINGS, defaultMinStock: 24 },
    users: [
      { name: 'Sofia Paz', email: 'admin@laesquina.test', role: ROLES.ADMIN },
      { name: 'Ruben Salas', email: 'deposito@laesquina.test', role: ROLES.OPERATOR },
    ],
    categories: [
      { name: 'Bebidas', description: 'Gaseosas, aguas y cervezas' },
      { name: 'Almacen', description: 'Secos y conservas' },
      { name: 'Limpieza', description: 'Articulos de limpieza' },
    ],
    products: [
      { sku: 'BEB-100', name: 'Gaseosa cola 2.25L', category: 'Bebidas', unit: 'unidad', costPrice: 1450, salePrice: 2600, minStock: 48, initial: 120 },
      { sku: 'BEB-101', name: 'Agua mineral 1.5L', category: 'Bebidas', unit: 'unidad', costPrice: 780, salePrice: 1500, minStock: 48, initial: 36 },
      { sku: 'BEB-102', name: 'Cerveza rubia lata 473ml', category: 'Bebidas', unit: 'unidad', costPrice: 1100, salePrice: 2100, minStock: 72, initial: 240 },
      { sku: 'ALM-200', name: 'Arroz largo fino 1kg', category: 'Almacen', unit: 'kg', costPrice: 1250, salePrice: 2300, minStock: 40, initial: 85 },
      { sku: 'ALM-201', name: 'Fideos guiseros 500g', category: 'Almacen', unit: 'unidad', costPrice: 890, salePrice: 1700, minStock: 40, initial: 22 },
      { sku: 'LIM-300', name: 'Lavandina 1L', category: 'Limpieza', unit: 'unidad', costPrice: 690, salePrice: 1400, minStock: 30, initial: 64 },
      { sku: 'LIM-301', name: 'Detergente 750ml', category: 'Limpieza', unit: 'unidad', costPrice: 1180, salePrice: 2200, minStock: 30, initial: 12 },
    ],
  },
];

// Movimientos de los ultimos dias para que el dashboard tenga una serie real.
// La fecha se fuerza despues de crear el movimiento, porque el servicio
// siempre registra con la fecha actual.
const MOVEMENT_SCRIPT = [
  { daysAgo: 12, sku: 'HER-001', type: MOVEMENT_TYPES.OUT, quantity: 2, reason: 'Venta mostrador', reference: 'FC-0001' },
  { daysAgo: 11, sku: 'TOR-010', type: MOVEMENT_TYPES.OUT, quantity: 8, reason: 'Venta mayorista', reference: 'FC-0002' },
  { daysAgo: 10, sku: 'PIN-020', type: MOVEMENT_TYPES.IN, quantity: 6, reason: 'Compra a proveedor', reference: 'REM-5521' },
  { daysAgo: 9, sku: 'ELE-031', type: MOVEMENT_TYPES.OUT, quantity: 5, reason: 'Venta mostrador', reference: 'FC-0003' },
  { daysAgo: 8, sku: 'HER-003', type: MOVEMENT_TYPES.OUT, quantity: 3, reason: 'Venta mostrador', reference: 'FC-0004' },
  { daysAgo: 7, sku: 'ELE-032', type: MOVEMENT_TYPES.OUT, quantity: 12, reason: 'Venta mayorista', reference: 'FC-0005' },
  { daysAgo: 6, sku: 'TOR-011', type: MOVEMENT_TYPES.OUT, quantity: 4, reason: 'Venta mostrador', reference: 'FC-0006' },
  { daysAgo: 5, sku: 'HER-002', type: MOVEMENT_TYPES.IN, quantity: 12, reason: 'Compra a proveedor', reference: 'REM-5610' },
  { daysAgo: 4, sku: 'PIN-021', type: MOVEMENT_TYPES.OUT, quantity: 9, reason: 'Venta mostrador', reference: 'FC-0007' },
  { daysAgo: 3, sku: 'ELE-030', type: MOVEMENT_TYPES.OUT, quantity: 2, reason: 'Obra cliente', reference: 'FC-0008' },
  { daysAgo: 2, sku: 'HER-001', type: MOVEMENT_TYPES.OUT, quantity: 1, reason: 'Venta mostrador', reference: 'FC-0009' },
  { daysAgo: 1, sku: 'TOR-010', type: MOVEMENT_TYPES.OUT, quantity: 6, reason: 'Venta mayorista', reference: 'FC-0010' },
  { daysAgo: 1, sku: 'ELE-032', type: MOVEMENT_TYPES.ADJUSTMENT, quantity: 18, reason: 'Conteo fisico de deposito' },
  { daysAgo: 0, sku: 'PIN-020', type: MOVEMENT_TYPES.OUT, quantity: 3, reason: 'Venta mostrador', reference: 'FC-0011' },
  { daysAgo: 0, sku: 'HER-002', type: MOVEMENT_TYPES.OUT, quantity: 2, reason: 'Venta mostrador', reference: 'FC-0012' },
];

function daysAgoDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  // Una hora fija de media manana para que no caiga fuera del dia por la zona.
  date.setHours(10, 30, 0, 0);
  return date;
}

// Sequelize trata createdAt como atributo de solo lectura y lo ignora en un
// update(), asi que para fechar el historial hacia atras hace falta un UPDATE
// directo. Las replacements pasan por el escape del dialecto, de modo que la
// fecha queda guardada en el mismo formato que usa el ORM.
async function backdate(movement, date) {
  await sequelize.query('UPDATE stock_movements SET createdAt = :date WHERE id = :id', {
    replacements: { date, id: movement.id },
  });
}

async function seed() {
  await connectDatabase();
  await sequelize.sync({ force });

  if (!force) {
    const existing = await Company.count();
    if (existing > 0) {
      console.log(
        'La base ya tiene datos. Usa "npm run db:reset" para borrarla y volver a cargarla.',
      );
      await sequelize.close();
      return;
    }
  }

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);

  // Administrador de plataforma: no pertenece a ninguna empresa.
  await User.create({
    name: 'Soporte Plataforma',
    email: 'superadmin@sistema.test',
    role: ROLES.SUPER_ADMIN,
    companyId: null,
    passwordHash,
  });

  const productsBySku = new Map();
  const operatorByCompany = new Map();

  for (const spec of COMPANIES) {
    const company = await Company.create({
      name: spec.name,
      slug: spec.slug,
      taxId: spec.taxId,
      email: spec.email,
      phone: spec.phone,
      address: spec.address,
      settings: spec.settings,
    });

    for (const userSpec of spec.users) {
      const user = await User.create({ ...userSpec, companyId: company.id, passwordHash });
      if (userSpec.role === ROLES.OPERATOR) operatorByCompany.set(company.id, user);
    }

    const categoryByName = new Map();
    for (const categorySpec of spec.categories) {
      const category = await Category.create({ ...categorySpec, companyId: company.id });
      categoryByName.set(categorySpec.name, category);
    }

    for (const productSpec of spec.products) {
      const { category, initial, ...data } = productSpec;
      const product = await Product.create({
        ...data,
        companyId: company.id,
        categoryId: categoryByName.get(category)?.id ?? null,
        quantity: 0,
      });
      productsBySku.set(product.sku, { product, company, initial });
    }
  }

  // Carga inicial de stock, fechada dos semanas atras.
  for (const { product, company, initial } of productsBySku.values()) {
    if (!initial) continue;
    const author = operatorByCompany.get(company.id);
    const movement = await registerMovement({
      companyId: company.id,
      userId: author.id,
      productId: product.id,
      type: MOVEMENT_TYPES.IN,
      quantity: initial,
      unitCost: product.costPrice,
      reason: 'Carga inicial de inventario',
      settings: company.settings,
    });
    await backdate(movement, daysAgoDate(14));
  }

  // Historial reciente de entradas, salidas y un ajuste por conteo.
  for (const step of MOVEMENT_SCRIPT) {
    const entry = productsBySku.get(step.sku);
    if (!entry) continue;
    const author = operatorByCompany.get(entry.company.id);
    const movement = await registerMovement({
      companyId: entry.company.id,
      userId: author.id,
      productId: entry.product.id,
      type: step.type,
      quantity: step.quantity,
      reason: step.reason,
      reference: step.reference,
      settings: entry.company.settings,
    });
    await backdate(movement, daysAgoDate(step.daysAgo));
  }

  const [companyCount, userCount, productCount] = await Promise.all([
    Company.count(),
    User.count(),
    Product.count(),
  ]);

  console.log('\nDatos de demo cargados');
  console.log(`  Empresas: ${companyCount}`);
  console.log(`  Usuarios: ${userCount}`);
  console.log(`  Productos: ${productCount}`);
  console.log(`\nTodas las cuentas usan la contrasena: ${DEMO_PASSWORD}`);
  console.log('  superadmin@sistema.test      -> administrador de plataforma');
  console.log('  admin@eltornillo.test        -> admin de Ferreteria El Tornillo');
  console.log('  contable@eltornillo.test     -> contable de Ferreteria El Tornillo');
  console.log('  deposito@eltornillo.test     -> operador de Ferreteria El Tornillo');
  console.log('  admin@laesquina.test         -> admin de Distribuidora La Esquina');
  console.log('  deposito@laesquina.test      -> operador de Distribuidora La Esquina');

  await sequelize.close();
}

seed().catch(async (error) => {
  console.error('Fallo el seed:', error);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
