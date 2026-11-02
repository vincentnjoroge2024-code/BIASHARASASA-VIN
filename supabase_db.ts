import pg from 'pg';
import { dbAll, dbRun } from './database';

const { Pool } = pg;

let pool: any = null;

export function getPool() {
    if (!pool && process.env.DATABASE_URL) {
        try {
            pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: {
                    rejectUnauthorized: false
                }
            });
        } catch (err) {
            console.warn('[AI Studio] PostgreSQL not connected - using mock');
            pool = {
                query: async () => ({ rows: [] }),
                connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} })
            };
        }
    }
    return pool;
}

export async function initSupabaseSchema() {
    const p = getPool();
    if (!p) return;

    const client = await p.connect();
    try {
        await client.query('BEGIN');
        
        // Create tables in Supabase matching the SQLite schema
        await client.query(`
            CREATE TABLE IF NOT EXISTS traders (
                id SERIAL PRIMARY KEY,
                external_id TEXT UNIQUE,
                full_name TEXT,
                email TEXT UNIQUE,
                phone TEXT,
                location TEXT,
                business_name TEXT,
                plan TEXT,
                status TEXT,
                instance_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS inventory_items (
                id SERIAL PRIMARY KEY,
                external_id TEXT UNIQUE,
                trader_id INTEGER,
                name TEXT,
                sku TEXT,
                barcode TEXT,
                category TEXT,
                location TEXT,
                quantity INTEGER,
                unit_price DECIMAL,
                cost_price DECIMAL,
                reorder_level INTEGER,
                instance_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS sales_transactions (
                id SERIAL PRIMARY KEY,
                external_id TEXT UNIQUE,
                invoice_no TEXT UNIQUE,
                trader_id INTEGER,
                business_name TEXT,
                customer_name TEXT,
                cashier_name TEXT,
                total_amount DECIMAL,
                items_json JSONB,
                date TEXT,
                instance_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT,
                trader_id INTEGER,
                is_active BOOLEAN DEFAULT TRUE,
                instance_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
                role TEXT PRIMARY KEY,
                onboard BOOLEAN,
                inventory BOOLEAN,
                pos BOOLEAN,
                transactions BOOLEAN,
                traders BOOLEAN,
                members BOOLEAN,
                reports BOOLEAN,
                settings BOOLEAN,
                interop BOOLEAN,
                procurement BOOLEAN,
                instance_url TEXT
            );

            CREATE TABLE IF NOT EXISTS trader_members (
                id SERIAL PRIMARY KEY,
                trader_id INTEGER,
                user_id INTEGER,
                role TEXT,
                status TEXT,
                instance_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(trader_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS devices (
                id SERIAL PRIMARY KEY,
                trader_id INTEGER,
                device_id TEXT,
                device_name TEXT,
                device_type TEXT,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_trusted BOOLEAN DEFAULT TRUE,
                instance_url TEXT,
                UNIQUE(trader_id, device_id)
            );
        `);
        
        await client.query('COMMIT');
        console.log("[Cloud] Supabase schema initialized/verified.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("[Cloud] Failed to initialize Supabase schema:", e);
    } finally {
        client.release();
    }
}

export async function fullCloudSync() {
    console.log("[Cloud] Starting full synchronization...");
    const p = getPool();
    if (!p) {
        console.warn("[Cloud] Skipping full sync: No DATABASE_URL provided.");
        return;
    }

    try {
        // 1. Sync Traders
        const traders = await dbAll('SELECT * FROM traders');
        for (const t of traders) {
            await p.query(`
                INSERT INTO traders (external_id, full_name, email, phone, location, business_name, plan, status, instance_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (external_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    business_name = EXCLUDED.business_name,
                    plan = EXCLUDED.plan,
                    status = EXCLUDED.status
            `, [`trader-${t.id}`, t.full_name, t.email, t.phone, t.location, t.business_name, t.plan, t.status, process.env.APP_URL || 'local']);
        }

        // 2. Sync Inventory
        const items = await dbAll('SELECT * FROM inventory');
        for (const i of items) {
            await p.query(`
                INSERT INTO inventory_items (external_id, trader_id, name, sku, barcode, category, location, quantity, unit_price, cost_price, reorder_level, instance_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (external_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    location = EXCLUDED.location,
                    quantity = EXCLUDED.quantity,
                    unit_price = EXCLUDED.unit_price,
                    cost_price = EXCLUDED.cost_price,
                    reorder_level = EXCLUDED.reorder_level
            `, [`inv-${i.id}`, i.trader_id, i.name, i.sku, i.barcode, i.category, i.location, i.quantity, i.unit_price, i.cost_price, i.reorder_level, process.env.APP_URL || 'local']);
        }

        // 3. Sync Transactions
        const txs = await dbAll('SELECT * FROM transactions');
        for (const tx of txs) {
            await p.query(`
                INSERT INTO sales_transactions (external_id, invoice_no, trader_id, business_name, customer_name, cashier_name, total_amount, items_json, date, instance_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (invoice_no) DO UPDATE SET
                    total_amount = EXCLUDED.total_amount,
                    items_json = EXCLUDED.items_json
            `, [`tx-${tx.id}`, tx.invoice_no, tx.trader_id, tx.business_name, tx.customer_name, tx.cashier_name, tx.total, tx.items, tx.date, process.env.APP_URL || 'local']);
        }

        // 4. Sync Users
        const users = await dbAll('SELECT * FROM users');
        for (const u of users) {
            await p.query(`
                INSERT INTO users (username, password_hash, role, trader_id, is_active, instance_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (username) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    role = EXCLUDED.role,
                    is_active = EXCLUDED.is_active
            `, [u.username, u.password_hash, u.role, u.trader_id, u.is_active === 1, process.env.APP_URL || 'local']);
        }

        // 5. Sync Role Permissions
        const perms = await dbAll('SELECT * FROM role_permissions');
        for (const pr of perms) {
            await p.query(`
                INSERT INTO role_permissions (role, onboard, inventory, pos, transactions, traders, members, reports, settings, interop, procurement, instance_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (role) DO UPDATE SET
                    onboard = EXCLUDED.onboard,
                    inventory = EXCLUDED.inventory,
                    pos = EXCLUDED.pos,
                    transactions = EXCLUDED.transactions,
                    traders = EXCLUDED.traders,
                    members = EXCLUDED.members,
                    reports = EXCLUDED.reports,
                    settings = EXCLUDED.settings,
                    interop = EXCLUDED.interop,
                    procurement = EXCLUDED.procurement
            `, [pr.role, pr.onboard === 1, pr.inventory === 1, pr.pos === 1, pr.transactions === 1, pr.traders === 1, pr.members === 1, pr.reports === 1, pr.settings === 1, pr.interop === 1, pr.procurement === 1, process.env.APP_URL || 'local']);
        }

        // 6. Sync Trader Members
        const members = await dbAll('SELECT * FROM trader_members');
        for (const m of members) {
            await p.query(`
                INSERT INTO trader_members (trader_id, user_id, role, status, instance_url)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (trader_id, user_id) DO UPDATE SET
                    role = EXCLUDED.role,
                    status = EXCLUDED.status
            `, [m.trader_id, m.user_id, m.role, m.status, process.env.APP_URL || 'local']);
        }

        // 7. Sync Devices
        const devices = await dbAll('SELECT * FROM devices');
        for (const d of devices) {
            await p.query(`
                INSERT INTO devices (trader_id, device_id, device_name, device_type, last_active, is_trusted, instance_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (trader_id, device_id) DO UPDATE SET
                    device_name = EXCLUDED.device_name,
                    last_active = EXCLUDED.last_active,
                    is_trusted = EXCLUDED.is_trusted
            `, [d.trader_id, d.device_id, d.device_name, d.device_type, d.last_active, d.is_trusted === 1, process.env.APP_URL || 'local']);
        }

        console.log(`[Cloud] Sync complete: ${traders.length} traders, ${items.length} items, ${txs.length} transactions, ${users.length} users, ${perms.length} roles, ${members.length} members, ${devices.length} devices.`);
    } catch (e) {
        console.error("[Cloud] Full sync error:", e);
    }
}

export async function restoreFromCloud() {
    console.log("[Cloud] Attempting data restoration from Supabase...");
    const p = getPool();
    if (!p) return;

    try {
        // 1. Restore Traders
        const { rows: cloudTraders } = await p.query('SELECT * FROM traders');
        for (const t of cloudTraders) {
            await dbRun(
                `INSERT OR IGNORE INTO traders (full_name, email, phone, location, business_name, plan, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [t.full_name, t.email, t.phone, t.location, t.business_name, t.plan, t.status]
            );
        }

        // 2. Restore Inventory
        const { rows: cloudItems } = await p.query('SELECT * FROM inventory_items');
        for (const i of cloudItems) {
            await dbRun(
                `INSERT OR IGNORE INTO inventory (trader_id, name, sku, barcode, category, location, quantity, unit_price, cost_price, reorder_level)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [i.trader_id, i.name, i.sku, i.barcode, i.category, i.location, i.quantity, i.unit_price, i.cost_price, i.reorder_level]
            );
        }

        // 3. Restore Transactions
        const { rows: cloudTxs } = await p.query('SELECT * FROM sales_transactions');
        for (const tx of cloudTxs) {
            await dbRun(
                `INSERT OR IGNORE INTO transactions (invoice_no, trader_id, business_name, customer_name, cashier_name, total, items, date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [tx.invoice_no, tx.trader_id, tx.business_name, tx.customer_name, tx.cashier_name, tx.total_amount, JSON.stringify(tx.items_json), tx.date]
            );
        }

        // 4. Restore Users
        const { rows: cloudUsers } = await p.query('SELECT * FROM users');
        for (const u of cloudUsers) {
            await dbRun(
                `INSERT OR IGNORE INTO users (username, password_hash, role, trader_id, is_active)
                 VALUES (?, ?, ?, ?, ?)`,
                [u.username, u.password_hash, u.role, u.trader_id, u.is_active ? 1 : 0]
            );
        }

        // 5. Restore Role Permissions
        const { rows: cloudPerms } = await p.query('SELECT * FROM role_permissions');
        for (const pr of cloudPerms) {
            await dbRun(
                `INSERT OR REPLACE INTO role_permissions (role, onboard, inventory, pos, transactions, traders, members, reports, settings, interop, procurement)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [pr.role, pr.onboard ? 1 : 0, pr.inventory ? 1 : 0, pr.pos ? 1 : 0, pr.transactions ? 1 : 0, pr.traders ? 1 : 0, pr.members ? 1 : 0, pr.reports ? 1 : 0, pr.settings ? 1 : 0, pr.interop ? 1 : 0, pr.procurement ? 1 : 0]
            );
        }

        // 6. Restore Trader Members
        const { rows: cloudMembers } = await p.query('SELECT * FROM trader_members');
        for (const m of cloudMembers) {
            await dbRun(
                `INSERT OR IGNORE INTO trader_members (trader_id, user_id, role, status)
                 VALUES (?, ?, ?, ?)`,
                [m.trader_id, m.user_id, m.role, m.status]
            );
        }

        // 7. Restore Devices
        const { rows: cloudDevices } = await p.query('SELECT * FROM devices');
        for (const d of cloudDevices) {
            await dbRun(
                `INSERT OR IGNORE INTO devices (trader_id, device_id, device_name, device_type, last_active, is_trusted)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [d.trader_id, d.device_id, d.device_name, d.device_type, d.last_active, d.is_trusted ? 1 : 0]
            );
        }

        console.log(`[Cloud] Restoration complete.`);
    } catch (e) {
        console.error("[Cloud] Restoration error:", e);
    }
}
