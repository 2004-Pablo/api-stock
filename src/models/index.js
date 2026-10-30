import { sequelize } from '../config/database.js';
import { defineCompany } from './Company.js';
import { defineUser } from './User.js';
import { defineCategory } from './Category.js';
import { defineProduct } from './Product.js';
import { defineStockMovement } from './StockMovement.js';

export const Company = defineCompany(sequelize);
export const User = defineUser(sequelize);
export const Category = defineCategory(sequelize);
export const Product = defineProduct(sequelize);
export const StockMovement = defineStockMovement(sequelize);

// --- Asociaciones ---------------------------------------------------------
// Todo lo que pertenece a una pyme cuelga de Company. Ese companyId es la
// unica frontera entre empresas y se aplica en cada consulta (ver
// middleware/tenant.js).

Company.hasMany(User, { foreignKey: 'companyId', as: 'users' });
User.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(Category, { foreignKey: 'companyId', as: 'categories', onDelete: 'CASCADE' });
Category.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(Product, { foreignKey: 'companyId', as: 'products', onDelete: 'CASCADE' });
Product.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products', onDelete: 'SET NULL' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

Company.hasMany(StockMovement, { foreignKey: 'companyId', as: 'movements', onDelete: 'CASCADE' });
StockMovement.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Product.hasMany(StockMovement, { foreignKey: 'productId', as: 'movements', onDelete: 'CASCADE' });
StockMovement.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

User.hasMany(StockMovement, { foreignKey: 'userId', as: 'movements' });
StockMovement.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export const models = { Company, User, Category, Product, StockMovement };
export { sequelize };
