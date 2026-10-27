// Advanced IndexedDB Database System v3.0
// Professional database management for warehouse inventory

class DatabaseManager {
    constructor() {
        this.dbName = 'warehouse_inventory_db';
        this.version = 1;
        this.db = null;
        this.stores = {
            users: '++id,username,role,permission,status,createdAt,updatedAt',
            warehouses: '++id,name,location,capacity,status,createdAt,updatedAt',
            products: '++id,code,name,category,unit,minStock,barcode,createdAt,updatedAt',
            counts: '++id,warehouseId,productCode,productName,lotNumber,quantity,location,notes,userId,userName,date,timestamp,createdAt,updatedAt',
            settings: 'key,value',
            logs: '++id,action,userId,userName,timestamp,details'
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                    userStore.createIndex('username', 'username', { unique: true });
                    userStore.createIndex('role', 'role', { unique: false });
                }

                if (!db.objectStoreNames.contains('warehouses')) {
                    const warehouseStore = db.createObjectStore('warehouses', { keyPath: 'id', autoIncrement: true });
                    warehouseStore.createIndex('name', 'name', { unique: true });
                }

                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                    productStore.createIndex('code', 'code', { unique: true });
                    productStore.createIndex('barcode', 'barcode', { unique: true });
                }

                if (!db.objectStoreNames.contains('counts')) {
                    const countStore = db.createObjectStore('counts', { keyPath: 'id', autoIncrement: true });
                    countStore.createIndex('warehouseId', 'warehouseId', { unique: false });
                    countStore.createIndex('productCode', 'productCode', { unique: false });
                    countStore.createIndex('date', 'date', { unique: false });
                    countStore.createIndex('userId', 'userId', { unique: false });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains('logs')) {
                    const logStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                    logStore.createIndex('timestamp', 'timestamp', { unique: false });
                    logStore.createIndex('userId', 'userId', { unique: false });
                }
            };
        });
    }

    // Generic CRUD operations
    async add(storeName, data) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        return store.add({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }

    async getAll(storeName) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        return store.getAll();
    }

    async get(storeName, id) {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        return store.get(id);
    }

    async update(storeName, id, data) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const existing = await store.get(id);
        return store.put({ ...existing, ...data, updatedAt: new Date().toISOString() });
    }

    async delete(storeName, id) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        return store.delete(id);
    }

    async clear(storeName) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        return store.clear();
    }

    // User management
    async addUser(user) {
        await this.log('user_added', null, user.username, { role: user.role });
        return this.add('users', user);
    }

    async getUsers() {
        return this.getAll('users');
    }

    async getUserById(id) {
        return this.get('users', id);
    }

    async updateUser(id, user) {
        await this.log('user_updated', id, user.username, { changes: user });
        return this.update('users', id, user);
    }

    async deleteUser(id) {
        await this.log('user_deleted', id, null, {});
        return this.delete('users', id);
    }

    // Warehouse management
    async addWarehouse(warehouse) {
        await this.log('warehouse_added', null, null, { name: warehouse.name });
        return this.add('warehouses', warehouse);
    }

    async getWarehouses() {
        return this.getAll('warehouses');
    }

    async getWarehouseById(id) {
        return this.get('warehouses', id);
    }

    async updateWarehouse(id, warehouse) {
        await this.log('warehouse_updated', id, null, { changes: warehouse });
        return this.update('warehouses', id, warehouse);
    }

    async deleteWarehouse(id) {
        await this.log('warehouse_deleted', id, null, {});
        return this.delete('warehouses', id);
    }

    // Product management
    async addProduct(product) {
        await this.log('product_added', null, null, { code: product.code });
        return this.add('products', product);
    }

    async getProducts() {
        return this.getAll('products');
    }

    async getProductById(id) {
        return this.get('products', id);
    }

    async getProductByBarcode(barcode) {
        const tx = this.db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const index = store.index('barcode');
        return index.get(barcode);
    }

    async updateProduct(id, product) {
        await this.log('product_updated', id, null, { changes: product });
        return this.update('products', id, product);
    }

    async deleteProduct(id) {
        await this.log('product_deleted', id, null, {});
        return this.delete('products', id);
    }

    // Count management
    async addCount(count) {
        await this.log('count_added', count.userId, count.userName, { 
            productCode: count.productCode, 
            quantity: count.quantity 
        });
        return this.add('counts', count);
    }

    async getCounts() {
        return this.getAll('counts');
    }

    async getCountById(id) {
        return this.get('counts', id);
    }

    async getCountsByWarehouse(warehouseId) {
        const tx = this.db.transaction('counts', 'readonly');
        const store = tx.objectStore('counts');
        const index = store.index('warehouseId');
        return index.getAll(warehouseId);
    }

    async updateCount(id, count) {
        await this.log('count_updated', count.userId, count.userName, { changes: count });
        return this.update('counts', id, count);
    }

    async deleteCount(id) {
        const count = await this.get('counts', id);
        await this.log('count_deleted', count.userId, count.userName, { productCode: count.productCode });
        return this.delete('counts', id);
    }

    async clearCounts(warehouseId = null) {
        if (warehouseId) {
            const counts = await this.getCountsByWarehouse(warehouseId);
            for (const count of counts) {
                await this.delete('counts', count.id);
            }
        } else {
            await this.clear('counts');
        }
        await this.log('counts_cleared', null, null, { warehouseId });
    }

    // Settings management
    async setSetting(key, value) {
        const tx = this.db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        return store.put({ key, value });
    }

    async getSetting(key) {
        const setting = await this.get('settings', key);
        return setting ? setting.value : null;
    }

    // Logging
    async log(action, userId, userName, details) {
        const logEntry = {
            action,
            userId,
            userName,
            timestamp: new Date().toISOString(),
            details: JSON.stringify(details)
        };
        const tx = this.db.transaction('logs', 'readwrite');
        const store = tx.objectStore('logs');
        return store.add(logEntry);
    }

    async getLogs(limit = 100) {
        const tx = this.db.transaction('logs', 'readonly');
        const store = tx.objectStore('logs');
        const index = store.index('timestamp');
        const logs = await index.getAll();
        return logs.slice(-limit).reverse();
    }

    // Statistics
    async getStatistics(warehouseId = null) {
        const counts = warehouseId 
            ? await this.getCountsByWarehouse(warehouseId)
            : await this.getCounts();
        
        const today = new Date().toISOString().split('T')[0];
        const todayCounts = counts.filter(c => c.date === today);
        
        return {
            total: counts.length,
            totalQuantity: counts.reduce((sum, c) => sum + (parseInt(c.quantity) || 0), 0),
            uniqueProducts: new Set(counts.map(c => c.productCode)).size,
            today: todayCounts.length,
            todayQuantity: todayCounts.reduce((sum, c) => sum + (parseInt(c.quantity) || 0), 0)
        };
    }

    // Backup & Restore
    async exportData() {
        const [users, warehouses, products, counts, settings] = await Promise.all([
            this.getUsers(),
            this.getWarehouses(),
            this.getProducts(),
            this.getCounts(),
            this.getAll('settings')
        ]);

        return {
            version: this.version,
            exportDate: new Date().toISOString(),
            users,
            warehouses,
            products,
            counts,
            settings
        };
    }

    async importData(data) {
        const tx = this.db.transaction(['users', 'warehouses', 'products', 'counts', 'settings'], 'readwrite');
        
        if (data.users) {
            const store = tx.objectStore('users');
            for (const user of data.users) {
                await store.put(user);
            }
        }
        
        if (data.warehouses) {
            const store = tx.objectStore('warehouses');
            for (const warehouse of data.warehouses) {
                await store.put(warehouse);
            }
        }
        
        if (data.products) {
            const store = tx.objectStore('products');
            for (const product of data.products) {
                await store.put(product);
            }
        }
        
        if (data.counts) {
            const store = tx.objectStore('counts');
            for (const count of data.counts) {
                await store.put(count);
            }
        }
        
        if (data.settings) {
            const store = tx.objectStore('settings');
            for (const setting of data.settings) {
                await store.put(setting);
            }
        }
        
        await this.log('data_imported', null, null, { items: data });
    }
}

// Create singleton instance
const dbManager = new DatabaseManager();

// Initialize database
dbManager.init().catch(console.error);

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = dbManager;
}

