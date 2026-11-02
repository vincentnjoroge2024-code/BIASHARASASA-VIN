import sqlite3 from 'sqlite3';
import crypto from 'crypto';

const dbFile = 'database.sqlite';
const db = new sqlite3.Database(dbFile);

// Helper function to hash passwords with SHA-256
export function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Promisify common SQLite methods
export const dbRun = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

export const dbAll = <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows as T[]);
        });
    });
};

export const dbGet = <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row as T | undefined);
        });
    });
};

export async function initDatabase() {
    // 0. Create metadata table for version tracking
    await dbRun(`
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    // 1. Create traders table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS traders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            location TEXT,
            business_name TEXT,
            tax_id TEXT,
            plan TEXT DEFAULT 'Basic',
            status TEXT DEFAULT 'active',
            discount_rate DECIMAL DEFAULT 0,
            pending_discount_rate DECIMAL DEFAULT 0,
            discount_status TEXT DEFAULT 'approved',
            customer_since DATE,
            joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            receipt_header TEXT DEFAULT 'Your trusted wholesale partner',
            receipt_footer TEXT DEFAULT 'Goods once sold are not returnable.',
            show_logo INTEGER DEFAULT 1,
            show_business_name INTEGER DEFAULT 1,
            show_location INTEGER DEFAULT 1,
            show_phone INTEGER DEFAULT 1,
            show_tax_id INTEGER DEFAULT 1,
            show_discount INTEGER DEFAULT 1,
            logo_url TEXT,
            server_ip TEXT,
            server_port INTEGER DEFAULT 8080,
            backup_path TEXT DEFAULT '/var/backup/biashara',
            last_backup_at TEXT,
            is_cashier INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            distributor_id INTEGER REFERENCES traders(id)
        );
    `);

    // 2. Create inventory table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trader_id INTEGER,
            name TEXT NOT NULL,
            sku TEXT,
            barcode TEXT,
            category TEXT,
            brand TEXT,
            model TEXT,
            uom TEXT DEFAULT 'pcs',
            quantity INTEGER DEFAULT 0,
            unit_price DECIMAL DEFAULT 0,
            cost_price DECIMAL DEFAULT 0,
            wholesale_price DECIMAL DEFAULT 0,
            retail_price DECIMAL DEFAULT 0,
            tax_category TEXT DEFAULT 'General',
            tax_rate DECIMAL DEFAULT 0,
            supplier TEXT,
            manufacturer TEXT,
            country_of_origin TEXT,
            reorder_level INTEGER DEFAULT 0,
            stock_alert INTEGER DEFAULT 0,
            description TEXT,
            images TEXT, -- JSON array
            location TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trader_id) REFERENCES traders(id)
        );
    `);

    // Migrate existing DB schemas if tables exist without new columns
    try {
        await dbRun(`ALTER TABLE inventory ADD COLUMN barcode TEXT`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE inventory ADD COLUMN cost_price DECIMAL DEFAULT 0`);
    } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN wholesale_price DECIMAL DEFAULT 0`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN retail_price DECIMAL DEFAULT 0`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN tax_category TEXT DEFAULT 'General'`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN tax_rate DECIMAL DEFAULT 0`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN brand TEXT`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN model TEXT`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN uom TEXT DEFAULT 'pcs'`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN manufacturer TEXT`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN country_of_origin TEXT`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN description TEXT`); } catch (e) {}
    try { await dbRun(`ALTER TABLE inventory ADD COLUMN images TEXT`); } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN receipt_header TEXT DEFAULT 'Your trusted wholesale partner'`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN receipt_footer TEXT DEFAULT 'Goods once sold are not returnable.'`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN show_logo INTEGER DEFAULT 1`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN show_business_name INTEGER DEFAULT 1`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN show_location INTEGER DEFAULT 1`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN show_phone INTEGER DEFAULT 1`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN show_tax_id INTEGER DEFAULT 1`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN distributor_id INTEGER REFERENCES traders(id)`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN show_discount INTEGER DEFAULT 1`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN logo_url TEXT`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN pending_discount_rate DECIMAL DEFAULT 0`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN discount_status TEXT DEFAULT 'approved'`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN server_ip TEXT`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN server_port INTEGER DEFAULT 8080`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN backup_path TEXT DEFAULT '/var/backup/biashara'`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN last_backup_at TEXT`);
    } catch (e) {}
    try {
        await dbRun(`
            CREATE TABLE IF NOT EXISTS subscription_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subscription_id TEXT,
                action TEXT, -- 'approved' or 'rejected'
                admin_username TEXT,
                store_name TEXT,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE traders ADD COLUMN is_cashier INTEGER DEFAULT 0`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE inventory ADD COLUMN category TEXT`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE inventory ADD COLUMN location TEXT`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE inventory ADD COLUMN trader_id INTEGER REFERENCES traders(id)`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE inventory ADD COLUMN stock_alert INTEGER DEFAULT 0`);
    } catch (e) {}
    try {
        await dbRun(`ALTER TABLE users ADD COLUMN trader_id INTEGER REFERENCES traders(id)`);
    } catch (e) {}

    // 3. Create transactions table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT UNIQUE,
            cashier_name TEXT,
            trader_id INTEGER,
            trader_name TEXT,
            business_name TEXT,
            customer_name TEXT,
            payment_method TEXT,
            items TEXT, -- JSON array of items [{id, name, price, icon, qty, code}]
            item_count INTEGER,
            subtotal DECIMAL,
            discount_rate DECIMAL,
            discount_amount DECIMAL,
            tax DECIMAL,
            total DECIMAL,
            date TEXT,
            time TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trader_id) REFERENCES traders(id)
        );
    `);

    // 4. Create users table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'cashier',
            trader_id INTEGER,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trader_id) REFERENCES traders(id)
        );
    `);

    // 4b. Create role_permissions table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS role_permissions (
            role TEXT PRIMARY KEY,
            onboard INTEGER DEFAULT 0,
            pos INTEGER DEFAULT 1,
            traders INTEGER DEFAULT 0,
            inventory INTEGER DEFAULT 0,
            regime INTEGER DEFAULT 0,
            reports INTEGER DEFAULT 0,
            system INTEGER DEFAULT 0
        );
    `);

    // 5. Create devices table for multi-device tracking
    await dbRun(`
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trader_id INTEGER,
            device_id TEXT NOT NULL,
            device_name TEXT,
            device_type TEXT,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_trusted INTEGER DEFAULT 1,
            FOREIGN KEY (trader_id) REFERENCES traders(id),
            UNIQUE(trader_id, device_id)
        );
    `);

    // 4c. Create interop_requests table for merchant interoperability
    await dbRun(`
        CREATE TABLE IF NOT EXISTS interop_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requester_id INTEGER NOT NULL,
            provider_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            sku TEXT,
            quantity INTEGER NOT NULL,
            price DECIMAL,
            status TEXT DEFAULT 'pending', -- pending, approved, rejected, shipped, received
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requester_id) REFERENCES traders(id),
            FOREIGN KEY (provider_id) REFERENCES traders(id)
        );
    `);

    // 4d. Create billing_invoices table for subscription history
    await dbRun(`
        CREATE TABLE IF NOT EXISTS billing_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trader_id INTEGER NOT NULL,
            invoice_no TEXT UNIQUE NOT NULL,
            amount DECIMAL NOT NULL,
            plan_name TEXT NOT NULL,
            status TEXT DEFAULT 'pending', -- paid, pending, failed
            billing_date DATE,
            due_date DATE,
            payment_method TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trader_id) REFERENCES traders(id)
        );
    `);

    // 4f. Create vendor_requests table for Tier 4 approvals
    await dbRun(`
        CREATE TABLE IF NOT EXISTS vendor_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trader_id INTEGER NOT NULL,
            business_name TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT DEFAULT 'pending', -- pending, approved, rejected
            admin_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trader_id) REFERENCES traders(id)
        );
    `);

    // 4g. Create trader_members table
    await dbRun(`
        CREATE TABLE IF NOT EXISTS trader_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trader_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL, -- cashier, manager, staff
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trader_id) REFERENCES traders(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `);

    // 4h. Create audit_logs table
    try {
        await dbRun(`ALTER TABLE transactions ADD COLUMN cashier_name TEXT`);
    } catch (e) {}

    await dbRun(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            trader_id INTEGER,
            action TEXT NOT NULL, -- e.g., 'update_plan', 'approve_discount', 'update_printer'
            details TEXT, -- JSON details
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (trader_id) REFERENCES traders(id)
        );
    `);

    // Seed default permissions if table is empty
    const permCount = await dbGet<{ count: number }>('SELECT COUNT(*) as count FROM role_permissions');
    if (permCount && permCount.count === 0) {
        await dbRun(`
            INSERT INTO role_permissions (role, onboard, pos, traders, inventory, regime, reports, system) VALUES
            ('admin', 1, 1, 1, 1, 1, 1, 1),
            ('manager', 0, 1, 1, 1, 1, 1, 0),
            ('cashier', 0, 1, 0, 0, 0, 0, 0),
            ('staff', 0, 1, 0, 0, 0, 0, 0),
            ('promoter', 1, 1, 1, 0, 0, 0, 0)
        `);
    }

    // Migration: Ensure users table has trader_id column
    try {
        await dbRun('ALTER TABLE users ADD COLUMN trader_id INTEGER REFERENCES traders(id)');
    } catch (e) {}
    try {
        await dbRun('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1');
    } catch (e) {}

    const isProductionOrNetlify = process.env.NODE_ENV === 'production' || 
                                  process.env.NETLIFY === 'true' || 
                                  !!process.env.NETLIFY ||
                                  process.env.CONTEXT === 'production' ||
                                  !!process.env.DEPLOY_PRIME_URL;

    // Seed initial users if table is empty
    const usersCount = await dbGet<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (usersCount && usersCount.count === 0) {
        // passwords: admin123, manager123, cashier123
        if (isProductionOrNetlify) {
            // Keep only essential clean login credentials, removing any simulated test accounts
            await dbRun(`
                INSERT INTO users (username, password_hash, role) VALUES
                ('admin@businesspro.com', '${hashPassword("Businesspro9900")}', 'admin'),
                ('promoter@businesspro.com', '${hashPassword("Promoter123")}', 'promoter'),
                ('baraka@businesspro.com', '${hashPassword("Baraka123")}', 'promoter'),
                ('philiam@businesspeo.com', '${hashPassword("Philiam123")}', 'promoter'),
                ('Joy@businesspeo.com', '${hashPassword("joy123")}', 'promoter');
            `);
        } else {
            await dbRun(`
                INSERT INTO users (username, password_hash, role) VALUES
                ('admin@businesspro.com', '${hashPassword("Businesspro9900")}', 'admin'),
                ('promoter@businesspro.com', '${hashPassword("Promoter123")}', 'promoter'),
                ('baraka@businesspro.com', '${hashPassword("Baraka123")}', 'promoter'),
                ('philiam@businesspeo.com', '${hashPassword("Philiam123")}', 'promoter'),
                ('Joy@businesspeo.com', '${hashPassword("joy123")}', 'promoter'),
                ('manager', '${hashPassword("manager123")}', 'manager'),
                ('cashier', '${hashPassword("cashier123")}', 'cashier'),
                ('kamau@biasharasasa.com', '${hashPassword("Kamau123")}', 'manager'),
                ('salome@biasharasasa.com', '${hashPassword("Salome123")}', 'cashier');
            `);
        }
    }

    // Ensure essential users exist even if table wasn't empty
    const essentialUsers = [
        { user: 'admin@businesspro.com', pass: 'Businesspro9900', role: 'admin' },
        { user: 'baraka@businesspro.com', pass: 'Baraka123', role: 'promoter' },
        { user: 'philiam@businesspeo.com', pass: 'Philiam123', role: 'promoter' },
        { user: 'Joy@businesspeo.com', pass: 'joy123', role: 'promoter' },
        { user: 'promoter@businesspro.com', pass: 'Promoter123', role: 'promoter' }
    ];

    for (const p of essentialUsers) {
        const existing = await dbGet<{id: number}>('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [p.user]);
        let userId: number;
        if (existing) {
            await dbRun('UPDATE users SET username = ?, password_hash = ?, role = ? WHERE id = ?', [p.user, hashPassword(p.pass), p.role, existing.id]);
            userId = existing.id;
        } else {
            const result = await dbRun('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [p.user, hashPassword(p.pass), p.role]);
            userId = result.lastID;
        }

        // Link promoters to all existing traders
        if (p.role === 'promoter') {
            const allTraders = await dbAll<{id: number}>('SELECT id FROM traders');
            for (const trader of allTraders) {
                const isMember = await dbGet('SELECT * FROM trader_members WHERE trader_id = ? AND user_id = ?', [trader.id, userId]);
                if (!isMember) {
                    await dbRun('INSERT INTO trader_members (trader_id, user_id, role) VALUES (?, ?, ?)', [trader.id, userId, 'promoter']);
                }
            }
        }
    }

    // To maintain strict regulatory compliance and ensure that uploaded traders, their users, 
    // and their inventory stock are NEVER interfered with or deleted during any system upgrades 
    // or server restarts/updates, all automatic deletion routines have been completely removed.
    // This guarantees total data persistence and integrity for all traders.

    // Seed initial traders if table is empty
    const tradersCount = await dbGet<{ count: number }>('SELECT COUNT(*) as count FROM traders');
    if (tradersCount && tradersCount.count === 0) {
        if (!isProductionOrNetlify) {
            await dbRun(`
                INSERT INTO traders (id, full_name, email, phone, location, business_name, tax_id, plan, status, discount_rate, customer_since) VALUES
                (1, 'James Ochieng', 'james@biashara.co.ke', '+254 712 345 678', 'Nairobi', 'Green Grocers', 'A1234567', 'Pro', 'active', 10, '2025-01-15'),
                (2, 'Faith Akinyi', 'faith@biashara.co.ke', '+254 723 456 789', 'Kisumu', 'Fresh Farms', 'B7654321', 'Enterprise', 'active', 15, '2025-01-20'),
                (3, 'David Mwangi', 'david@biashara.co.ke', '+254 734 567 890', 'Mombasa', 'Coastal Traders', 'C9876543', 'Basic', 'pending', 5, '2025-01-25'),
                (4, 'Kamau', 'kamau@biasharasasa.com', '—', 'Muramvia', 'Kamau general trader', '—', 'Basic', 'active', 0, '2026-07-16')
            `);
        }
    }

    // Seed initial inventory if table is empty
    const invCount = await dbGet<{ count: number }>('SELECT COUNT(*) as count FROM inventory');
    if (invCount && invCount.count === 0) {
        if (!isProductionOrNetlify) {
            await dbRun(`
                INSERT INTO inventory (id, trader_id, name, sku, quantity, unit_price, supplier, reorder_level) VALUES
                (1, 1, 'Tomatoes', 'T001', 50, 80, 'Green Farms', 10),
                (2, 1, 'Onions', 'O002', 30, 60, 'Green Farms', 8),
                (3, 2, 'Milk 1L', 'M006', 20, 150, 'Dairy Co', 5)
            `);
        }
    }

    // Seed initial transactions if table is empty
    const txCount = await dbGet<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
    if (txCount && txCount.count === 0) {
        if (!isProductionOrNetlify) {
            const initialItems = JSON.stringify([{id: 1, name: "Tomatoes", price: 80, icon: "🍅", qty: 5, code: "T001"}]);
            await dbRun(`
                INSERT INTO transactions (id, invoice_no, trader_id, trader_name, business_name, customer_name, payment_method, items, item_count, subtotal, discount_rate, discount_amount, tax, total, date, time) VALUES
                (1, 'INV-1001', 1, 'James Ochieng', 'Green Grocers', 'James Ochieng', 'Cash', ?, 5, 400, 10, 40, 28.8, 388.8, '15 Jan 2025', '14:30')
            `, [initialItems]);
        }
    }

    // Seed initial billing invoices
    const billingCount = await dbGet<{ count: number }>('SELECT COUNT(*) as count FROM billing_invoices');
    if (billingCount && billingCount.count === 0) {
        if (!isProductionOrNetlify) {
            await dbRun(`
                INSERT INTO billing_invoices (trader_id, invoice_no, amount, plan_name, status, billing_date, due_date, payment_method) VALUES
                (1, 'BILL-1001', 5000, 'Pro', 'paid', '2025-01-01', '2025-01-05', 'M-Pesa'),
                (1, 'BILL-1002', 5000, 'Pro', 'paid', '2025-02-01', '2025-02-05', 'Bank Transfer'),
                (2, 'BILL-2001', 12000, 'Enterprise', 'paid', '2025-01-10', '2025-01-15', 'Check'),
                (3, 'BILL-3001', 0, 'Basic', 'paid', '2025-01-25', '2025-01-30', 'System Free')
            `);
        }
    }
}

export async function executeRawSQL(sqlString: string) {
    // Translate some Postgres-specific syntax to SQLite to ensure their queries succeed perfectly!
    let translatedSql = sqlString
        .replace(/\bSERIAL PRIMARY KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/\bSERIAL\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/\bJSONB\b/gi, 'TEXT')
        .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');

    // Split statements on semicolons while ignoring them inside strings if any, but a simple split works well for general usage
    const statements = translatedSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const results = [];
    for (const stmt of statements) {
        try {
            const isSelect = stmt.toLowerCase().startsWith('select') || stmt.toLowerCase().startsWith('pragma') || stmt.toLowerCase().startsWith('explain');
            if (isSelect) {
                const rows = await dbAll(stmt);
                results.push({
                    query: stmt,
                    success: true,
                    type: 'select',
                    rows,
                    columns: rows.length > 0 ? Object.keys(rows[0]) : []
                });
            } else {
                const outcome = await dbRun(stmt);
                results.push({
                    query: stmt,
                    success: true,
                    type: 'write',
                    changes: outcome.changes,
                    lastID: outcome.lastID
                });
            }
        } catch (err: any) {
            results.push({
                query: stmt,
                success: false,
                error: err.message
            });
        }
    }
    return results;
}
