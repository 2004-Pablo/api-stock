export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  OPERATOR: 'operator',
};

export const ROLE_VALUES = Object.values(ROLES);

// Etiquetas pensadas para mostrarse en el frontend.
export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Administrador de plataforma',
  [ROLES.ADMIN]: 'Administrador de la empresa',
  [ROLES.ACCOUNTANT]: 'Contable',
  [ROLES.OPERATOR]: 'Operador de stock',
};

export const MOVEMENT_TYPES = {
  IN: 'in',
  OUT: 'out',
  ADJUSTMENT: 'adjustment',
};

export const MOVEMENT_TYPE_VALUES = Object.values(MOVEMENT_TYPES);

export const PRODUCT_UNITS = ['unidad', 'kg', 'g', 'l', 'ml', 'm', 'caja', 'pack'];
