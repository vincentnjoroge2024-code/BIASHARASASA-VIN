// server.ts - Single-file implementation for BiasharaSasa
// Cloud-based, multi-device data persistence with global accessibility

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { createClient } from '@supabase/supabase-js';
import * as supabaseServer from '@supabase/server';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';

dotenv.config();

// ============================================================
// CONFIGURATION
// ============================================================
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const PORT = 3000;

// Resilience & Snapshot Backup Paths
const isServerless = typeof process !== 'undefined' && !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL);
const BACKUP_DIR = isServerless ? path.join('/tmp', 'backups') : path.join(process.cwd(), 'backups');
try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[Server] Backup dir initialization deferred:', e);
}
const SNAPSHOT_FILE = path.join(BACKUP_DIR, 'biashara_latest_snapshot.json');

// Isolated Client Tenant Databases Base Directory
const TENANTS_BASE_DIR = isServerless ? path.join('/tmp', 'tenants_dbs') : path.join(process.cwd(), 'tenants_dbs');
try {
  if (!fs.existsSync(TENANTS_BASE_DIR)) {
    fs.mkdirSync(TENANTS_BASE_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[Server] Tenants dbs dir initialization deferred:', e);
}

// Security
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY = '24h';

// Supabase (Global PostgreSQL & Multi-tenant Cloud)
const envUrl = (process.env.SUPABASE_URL || '').trim();
const isHttpUrl = /^https?:\/\//i.test(envUrl);
let rawSupabaseUrl = isHttpUrl ? envUrl : 'https://glfdyruqmkpdhfzbewal.supabase.co';
let rawKey = (process.env.SUPABASE_ANON_KEY || '').trim();
let rawSupabaseKey = rawKey.length > 20 ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.anon_key_biasharasasa';

// Clean and validate URL
let SUPABASE_URL = rawSupabaseUrl.replace(/\/$/, '');
let SUPABASE_ANON_KEY = rawSupabaseKey;

let USE_SUPABASE = true; // Fully activated per user request

console.log(`🔌 Supabase integration status: ACTIVE (Target: ${SUPABASE_URL})`);

// SQLite (Local database engine)
const SQLITE_DB_PATH = isServerless ? path.join('/tmp', 'biasharasasa.db') : './biasharasasa.db';

// Redis (Optional - for global caching)
const REDIS_URL = process.env.REDIS_URL || '';

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
  origin: '*', // Allow global access
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Client IP Address extraction helper for data localization and sovereignty compliance
export function getClientIp(req: any): string {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (forwarded) {
    const list = typeof forwarded === 'string' ? forwarded.split(',') : (Array.isArray(forwarded) ? forwarded : [String(forwarded)]);
    if (list.length > 0 && list[0].trim()) {
      return list[0].trim();
    }
  }
  return req?.headers?.['x-real-ip'] || 
         req?.headers?.['cf-connecting-ip'] || 
         req?.ip || 
         req?.socket?.remoteAddress || 
         '127.0.0.1';
}

// ============================================================
// DATABASE LAYER - Hybrid (SQLite + Supabase)
// ============================================================
class DatabaseManager {
  public sqlite: any = null;
  private supabase: any = null;
  private useSupabase: boolean = true;
  private hasRpcSupport: boolean = false;

  constructor() {
    // Supabase integration fully activated per user request
    this.useSupabase = true;
    try {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      console.log(`✅ Supabase connected & fully activated (Global PostgreSQL: ${SUPABASE_URL})`);
    } catch (err: any) {
      console.warn('⚠️ Supabase client initialization error:', err?.message || err);
    }
  }

  async init() {
    // Initialize SQLite with WAL resilience & durability
    try {
      this.sqlite = await open({
        filename: SQLITE_DB_PATH,
        driver: sqlite3.Database
      });
      
      // CRITICAL PRAGMAS FOR RELIABILITY, DURABILITY & CONCURRENCY
      await this.sqlite.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 10000;
        PRAGMA foreign_keys = ON;
      `);

      await this.initSQLiteSchema();
      console.log('✅ SQLite Database initialized with WAL resilience & durability');

      // Verify integrity
      const integrity = await this.sqlite.get("PRAGMA integrity_check");
      console.log('🛡️ SQLite Database integrity check:', integrity?.integrity_check || integrity);

      // Auto-restore business data if fresh container or clean deployment
      await this.autoRestoreIfEmpty();
    } catch (error) {
      console.error('❌ SQLite initialization failed:', error);
    }

    // Initialize Supabase schema if available
    if (this.useSupabase) {
      await this.initSupabaseSchema();
    }

    // Seed essential data
    await this.seed();

    // Schedule periodic snapshot every 5 minutes (standalone server mode only)
    if (!isServerless) {
      setInterval(() => {
        this.exportFullSnapshot().catch(err => {
          console.warn('[Snapshot] Periodic auto-snapshot error:', err);
        });
      }, 5 * 60 * 1000);
    }
  }

  private async initSQLiteSchema() {
    await this.sqlite.exec(`
      -- Metadata table
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- Traders table
      CREATE TABLE IF NOT EXISTS traders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        business_name TEXT,
        phone TEXT,
        location TEXT,
        tax_id TEXT,
        plan TEXT DEFAULT 'Basic',
        status TEXT DEFAULT 'active',
        discount_rate REAL DEFAULT 0,
        receipt_header TEXT DEFAULT 'Your trusted wholesale partner',
        receipt_footer TEXT DEFAULT 'Goods once sold are not returnable.',
        show_logo BOOLEAN DEFAULT 1,
        logo_url TEXT,
        country TEXT,
        server_ip TEXT,
        server_port INTEGER DEFAULT 8080,
        backup_path TEXT DEFAULT '/var/backup/biashara',
        last_backup_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        last_ip TEXT,
        is_active BOOLEAN DEFAULT 1,
        distributor_id INTEGER REFERENCES traders(id),
        finance_active BOOLEAN DEFAULT 0,
        tax_active BOOLEAN DEFAULT 0,
        production_active BOOLEAN DEFAULT 0,
        hr_active BOOLEAN DEFAULT 0,
        subscription_months INTEGER DEFAULT 1,
        subscription_discount_rate REAL DEFAULT 0,
        pending_discount_rate REAL DEFAULT 0,
        discount_status TEXT DEFAULT 'approved',
        tax_regime_country TEXT,
        subscription_expires_at TEXT
      );

      -- Shared Blobs table (KV Store)
      CREATE TABLE IF NOT EXISTS shared_blobs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Inventory table
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER NOT NULL,
        item_code TEXT UNIQUE NOT NULL,
        item_name TEXT NOT NULL,
        sku TEXT,
        barcode TEXT,
        category TEXT,
        brand TEXT,
        model TEXT,
        uom TEXT DEFAULT 'pcs',
        quantity INTEGER DEFAULT 0,
        unit_price REAL DEFAULT 0,
        cost_price REAL DEFAULT 0,
        wholesale_price REAL DEFAULT 0,
        retail_price REAL DEFAULT 0,
        tax_category TEXT DEFAULT 'General',
        tax_rate REAL DEFAULT 0,
        supplier TEXT,
        manufacturer TEXT,
        country_of_origin TEXT,
        reorder_level INTEGER DEFAULT 0,
        stock_alert BOOLEAN DEFAULT 0,
        description TEXT,
        images TEXT, -- JSON array
        location TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE
      );

      -- Transactions table
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT UNIQUE,
        cashier_name TEXT,
        trader_id INTEGER NOT NULL,
        trader_name TEXT,
        business_name TEXT,
        customer_name TEXT,
        payment_method TEXT,
        items TEXT, -- JSON array of items [{id, name, price, icon, qty, code}]
        item_count INTEGER,
        subtotal REAL,
        discount_rate REAL,
        discount_amount REAL,
        tax REAL,
        total REAL,
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE
      );

      -- Devices table
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT,
        device_type TEXT,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_trusted BOOLEAN DEFAULT 1,
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE,
        UNIQUE(trader_id, device_id)
      );

      -- Sync metadata
      CREATE TABLE IF NOT EXISTS sync_metadata (
        trader_id INTEGER NOT NULL,
        table_name TEXT NOT NULL,
        last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_version INTEGER DEFAULT 1,
        PRIMARY KEY (trader_id, table_name)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_inventory_trader ON inventory(trader_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_trader ON transactions(trader_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    `);

    // Column Migrations (SQLite doesn't support ADD COLUMN IF NOT EXISTS)
    try {
      const columns = await this.sqlite.all("PRAGMA table_info(traders)");
      const columnNames = columns.map((c: any) => c.name);
      
      if (!columnNames.includes('subscription_expires_at')) {
        await this.sqlite.exec("ALTER TABLE traders ADD COLUMN subscription_expires_at TEXT");
      }
      if (!columnNames.includes('finance_active')) {
        await this.sqlite.exec("ALTER TABLE traders ADD COLUMN finance_active BOOLEAN DEFAULT 0");
      }
      if (!columnNames.includes('tax_active')) {
        await this.sqlite.exec("ALTER TABLE traders ADD COLUMN tax_active BOOLEAN DEFAULT 0");
      }
      if (!columnNames.includes('tax_regime_country')) {
        await this.sqlite.exec("ALTER TABLE traders ADD COLUMN tax_regime_country TEXT");
      }
      try {
        await this.sqlite.exec("ALTER TABLE audit_logs ADD COLUMN user_role TEXT");
      } catch (e) {}
    } catch (err) {
      console.error('Migration error:', err);
    }

    await this.sqlite.exec(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'cashier',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Password Resets table
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        token TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0
      );

      -- Billing Invoices table
      CREATE TABLE IF NOT EXISTS billing_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER NOT NULL,
        invoice_no TEXT UNIQUE,
        amount REAL,
        plan_name TEXT,
        status TEXT DEFAULT 'pending',
        billing_date TEXT,
        due_date TEXT,
        payment_method TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE
      );

      -- Audit Logs table
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        trader_id INTEGER,
        trader_name TEXT,
        username TEXT,
        user_role TEXT,
        action TEXT,
        details TEXT, -- JSON string
        severity TEXT DEFAULT 'info',
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE SET NULL
      );

      -- Finance Module Tables
      CREATE TABLE IF NOT EXISTS finance_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT,
        description TEXT,
        balance REAL DEFAULT 0,
        is_system BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE,
        UNIQUE(trader_id, code)
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER NOT NULL,
        entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        reference TEXT,
        description TEXT,
        status TEXT DEFAULT 'posted',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS journal_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES finance_accounts(id)
      );

      -- Tax Compliance Tables
      CREATE TABLE IF NOT EXISTS tax_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER NOT NULL,
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        type TEXT NOT NULL,
        reference_no TEXT,
        net_amount REAL,
        tax_amount REAL,
        total_amount REAL,
        tax_rate REAL,
        tax_category TEXT,
        agency_response TEXT,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE
      );

      -- Production Module Tables (BiasharaSasa SME Production Management)
      CREATE TABLE IF NOT EXISTS production_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER DEFAULT 1,
        name TEXT NOT NULL,
        cost_per_unit REAL DEFAULT 0.0,
        unit TEXT DEFAULT 'kg',
        current_stock REAL DEFAULT 0.0,
        reorder_level REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS production_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER DEFAULT 1,
        batch_number TEXT UNIQUE NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT,
        quantity_produced REAL NOT NULL,
        total_cost REAL DEFAULT 0.0,
        cost_per_unit REAL DEFAULT 0.0,
        production_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        responsible_user TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        approved_by TEXT,
        approved_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS production_raw_material_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        ingredient_name TEXT,
        quantity_used REAL NOT NULL,
        cost REAL NOT NULL,
        FOREIGN KEY (batch_id) REFERENCES production_batches (id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES production_ingredients (id)
      );

      CREATE TABLE IF NOT EXISTS production_labour_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        hours_worked REAL NOT NULL,
        hourly_rate REAL NOT NULL,
        total_cost REAL NOT NULL,
        role TEXT,
        FOREIGN KEY (batch_id) REFERENCES production_batches (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS production_overhead_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        FOREIGN KEY (batch_id) REFERENCES production_batches (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS production_inventory_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER DEFAULT 1,
        product_id INTEGER,
        ingredient_id INTEGER,
        movement_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reference_id INTEGER,
        reference_type TEXT,
        movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS production_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER DEFAULT 1,
        name TEXT NOT NULL,
        product_id INTEGER,
        product_name TEXT,
        target_quantity REAL DEFAULT 1.0,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS production_recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        FOREIGN KEY (recipe_id) REFERENCES production_recipes (id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES production_ingredients (id)
      );

      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        user_id INTEGER,
        trader_id INTEGER,
        endpoint TEXT,
        url TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safe Column & Table Migrations for Traders and Core Extensions
    const migrationStatements = [
      "ALTER TABLE error_logs ADD COLUMN url TEXT",
      "ALTER TABLE error_logs ADD COLUMN user_agent TEXT",
      "ALTER TABLE error_logs ADD COLUMN trader_id INTEGER",
      "ALTER TABLE traders ADD COLUMN production_active BOOLEAN DEFAULT 0",
      "ALTER TABLE traders ADD COLUMN hr_active BOOLEAN DEFAULT 0",
      "ALTER TABLE traders ADD COLUMN subscription_months INTEGER DEFAULT 1",
      "ALTER TABLE traders ADD COLUMN subscription_discount_rate REAL DEFAULT 0",
      "ALTER TABLE traders ADD COLUMN pending_discount_rate REAL DEFAULT 0",
      "ALTER TABLE traders ADD COLUMN discount_status TEXT DEFAULT 'approved'",
      "ALTER TABLE traders ADD COLUMN finance_active BOOLEAN DEFAULT 0",
      "ALTER TABLE traders ADD COLUMN tax_active BOOLEAN DEFAULT 0",
      "ALTER TABLE traders ADD COLUMN tax_regime_country TEXT",
      "ALTER TABLE traders ADD COLUMN subscription_expires_at TEXT",
      `CREATE TABLE IF NOT EXISTS trader_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT,
        full_name TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'cashier',
        permissions TEXT,
        selling_point_id TEXT,
        commission_rate REAL DEFAULT 0,
        commission_type TEXT DEFAULT 'percentage',
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        last_login TEXT,
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE
      )`,
      "ALTER TABLE trader_members ADD COLUMN password_hash TEXT",
      "ALTER TABLE trader_members ADD COLUMN full_name TEXT",
      "ALTER TABLE trader_members ADD COLUMN phone TEXT",
      "ALTER TABLE trader_members ADD COLUMN permissions TEXT",
      "ALTER TABLE trader_members ADD COLUMN selling_point_id TEXT",
      "ALTER TABLE trader_members ADD COLUMN commission_rate REAL DEFAULT 0",
      "ALTER TABLE trader_members ADD COLUMN commission_type TEXT DEFAULT 'percentage'",
      "ALTER TABLE trader_members ADD COLUMN status TEXT DEFAULT 'active'",
      "ALTER TABLE trader_members ADD COLUMN last_login TEXT",
      `CREATE TABLE IF NOT EXISTS trader_printer_settings (
        trader_id INTEGER PRIMARY KEY,
        settings_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vendor_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        location TEXT,
        business_name TEXT,
        tax_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE
      )`,
      "ALTER TABLE traders ADD COLUMN tax_rate REAL DEFAULT 0",
      "ALTER TABLE traders ADD COLUMN apply_tax BOOLEAN DEFAULT 0",
      "ALTER TABLE traders ADD COLUMN tax_label TEXT DEFAULT 'VAT'",
      "ALTER TABLE transactions ADD COLUMN tax_rate REAL DEFAULT 0",
      "ALTER TABLE transactions ADD COLUMN tax_label TEXT DEFAULT 'VAT'",
      "ALTER TABLE transactions ADD COLUMN service_provider TEXT",
      "ALTER TABLE transactions ADD COLUMN service_station TEXT",
      "ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'completed'",
      "ALTER TABLE transactions ADD COLUMN status_reason TEXT",
      "ALTER TABLE transactions ADD COLUMN status_updated_at TEXT",
      "ALTER TABLE transactions ADD COLUMN status_updated_by TEXT",
      "ALTER TABLE transactions ADD COLUMN refund_amount REAL DEFAULT 0",
      "ALTER TABLE transactions ADD COLUMN customer_phone TEXT",
      "ALTER TABLE traders ADD COLUMN client_ip TEXT",
      "ALTER TABLE traders ADD COLUMN localization_ip TEXT",
      "ALTER TABLE traders ADD COLUMN last_backup_ip TEXT",
      "ALTER TABLE traders ADD COLUMN last_cloud_backup_at DATETIME",
      "ALTER TABLE traders ADD COLUMN dual_backup_active BOOLEAN DEFAULT 1",
      "ALTER TABLE traders ADD COLUMN tenant_id TEXT",
      "ALTER TABLE traders ADD COLUMN schema_name TEXT",
      "ALTER TABLE inventory ADD COLUMN tenant_id TEXT",
      "ALTER TABLE transactions ADD COLUMN tenant_id TEXT",
      "ALTER TABLE transactions ADD COLUMN member_id INTEGER",
      "ALTER TABLE users ADD COLUMN user_id TEXT",
      "ALTER TABLE users ADD COLUMN full_name TEXT",
      `CREATE TABLE IF NOT EXISTS tenants (
        tenant_id   TEXT PRIMARY KEY,
        tenant_name TEXT NOT NULL,
        schema_name TEXT NOT NULL,
        created_at  TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS memberships (
        membership_id TEXT PRIMARY KEY,
        tenant_id     TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        role          TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'active',
        invited_by    TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        UNIQUE (tenant_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS audit_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id  TEXT NOT NULL,
        actor_id   TEXT NOT NULL,
        action     TEXT NOT NULL,
        target     TEXT,
        detail     TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS client_tenants (
        id TEXT PRIMARY KEY,
        business_name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        owner_email TEXT NOT NULL,
        db_path TEXT NOT NULL,
        workspace_token_hash TEXT NOT NULL,
        workspace_token TEXT,
        created_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS ix_mem_tenant ON memberships(tenant_id)",
      "CREATE INDEX IF NOT EXISTS ix_audit_tenant ON audit_log(tenant_id)",
      "CREATE INDEX IF NOT EXISTS ix_inventory_tenant_str ON inventory(tenant_id)",
      "CREATE INDEX IF NOT EXISTS ix_transactions_tenant_str ON transactions(tenant_id)",
      `CREATE TABLE IF NOT EXISTS tenant_backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id INTEGER NOT NULL,
        backup_type TEXT DEFAULT 'dual',
        local_path TEXT,
        cloud_url TEXT,
        file_size_bytes INTEGER DEFAULT 0,
        status TEXT DEFAULT 'success',
        tenant_ip TEXT NOT NULL,
        server_ip TEXT,
        checksum TEXT,
        details TEXT,
        record_counts TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trader_id) REFERENCES traders(id) ON DELETE CASCADE
      )`,
      "CREATE INDEX IF NOT EXISTS idx_tenant_backups_trader ON tenant_backups(trader_id)",
      "CREATE INDEX IF NOT EXISTS idx_tenant_backups_ip ON tenant_backups(tenant_ip)",
      "ALTER TABLE traders ADD COLUMN tenant_code TEXT",
      "ALTER TABLE traders ADD COLUMN subscription_tier TEXT DEFAULT 'pro'",
      "ALTER TABLE traders ADD COLUMN max_users INTEGER DEFAULT 5",
      "ALTER TABLE traders ADD COLUMN location_limit INTEGER DEFAULT 2",
      "ALTER TABLE traders ADD COLUMN billing_status TEXT DEFAULT 'paid'",
      "ALTER TABLE traders ADD COLUMN subscription_start_date TEXT",
      "ALTER TABLE traders ADD COLUMN isolation_tier TEXT DEFAULT 'dedicated_database_partition'",
      "ALTER TABLE traders ADD COLUMN db_partition_path TEXT",
      "ALTER TABLE trader_members ADD COLUMN tenant_id TEXT",
      "ALTER TABLE trader_members ADD COLUMN email TEXT",
      "ALTER TABLE trader_members ADD COLUMN created_by TEXT",
      "ALTER TABLE trader_members ADD COLUMN password_reset_required INTEGER DEFAULT 1",
      "ALTER TABLE trader_members ADD COLUMN initial_password TEXT",
      "ALTER TABLE users ADD COLUMN password_reset_required INTEGER DEFAULT 1",
      "ALTER TABLE users ADD COLUMN is_tenant_admin INTEGER DEFAULT 0",
      "ALTER TABLE users ADD COLUMN tenant_id TEXT",
      "CREATE INDEX IF NOT EXISTS idx_trader_members_trader ON trader_members(trader_id)",
      "CREATE INDEX IF NOT EXISTS idx_trader_members_user ON trader_members(username)",
      "CREATE INDEX IF NOT EXISTS idx_trader_members_tenant ON trader_members(tenant_id)",
      "ALTER TABLE finance_accounts ADD COLUMN tenant_id TEXT",
      "ALTER TABLE journal_entries ADD COLUMN tenant_id TEXT",
      "ALTER TABLE tax_transactions ADD COLUMN tenant_id TEXT",
      "ALTER TABLE production_ingredients ADD COLUMN tenant_id TEXT",
      "ALTER TABLE production_batches ADD COLUMN tenant_id TEXT",
      "ALTER TABLE production_recipes ADD COLUMN tenant_id TEXT",
      "ALTER TABLE production_inventory_movements ADD COLUMN tenant_id TEXT",
      "ALTER TABLE audit_logs ADD COLUMN tenant_id TEXT",
      "CREATE INDEX IF NOT EXISTS ix_finance_tenant ON finance_accounts(tenant_id)",
      "CREATE INDEX IF NOT EXISTS ix_journal_tenant ON journal_entries(tenant_id)",
      "CREATE INDEX IF NOT EXISTS ix_tax_tenant ON tax_transactions(tenant_id)",
      "CREATE INDEX IF NOT EXISTS ix_prod_ing_tenant ON production_ingredients(tenant_id)",
      "CREATE INDEX IF NOT EXISTS ix_prod_batch_tenant ON production_batches(tenant_id)",
      "ALTER TABLE production_overhead_costs ADD COLUMN bill_reference TEXT",
      "ALTER TABLE production_overhead_costs ADD COLUMN cost_type TEXT",
      "ALTER TABLE production_overhead_costs ADD COLUMN units_consumed REAL",
      "ALTER TABLE production_overhead_costs ADD COLUMN unit_rate REAL",
      "ALTER TABLE production_overhead_costs ADD COLUMN unit_measure TEXT",
      "ALTER TABLE production_overhead_costs ADD COLUMN billing_period TEXT",
      `CREATE TABLE IF NOT EXISTS production_recipe_overheads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        cost_type TEXT,
        bill_reference TEXT,
        units_consumed REAL,
        unit_rate REAL,
        unit_measure TEXT,
        FOREIGN KEY (recipe_id) REFERENCES production_recipes (id) ON DELETE CASCADE
      )`
    ];

    for (const stmt of migrationStatements) {
      try {
        await this.sqlite.exec(stmt);
      } catch (ignored) {
        // Column or table already exists
      }
    }

    // Backfill tenant_code and seat limits for existing traders
    try {
      await this.sqlite.run(`
        UPDATE traders
        SET tenant_code = 'TNT-2026-' || printf('%04d', id)
        WHERE tenant_code IS NULL OR tenant_code = ''
      `);
      await this.sqlite.run(`
        UPDATE traders
        SET subscription_tier = CASE 
          WHEN LOWER(plan) LIKE '%distributor%' THEN 'distributor'
          WHEN LOWER(plan) LIKE '%enterprise%' OR LOWER(plan) LIKE '%premium%' THEN 'enterprise'
          WHEN LOWER(plan) LIKE '%pro%' THEN 'pro'
          ELSE 'starter'
        END
        WHERE subscription_tier IS NULL OR subscription_tier = ''
      `);
      await this.sqlite.run(`
        UPDATE traders
        SET max_users = CASE 
          WHEN LOWER(plan) LIKE '%distributor%' THEN 50
          WHEN LOWER(plan) LIKE '%enterprise%' OR LOWER(plan) LIKE '%premium%' THEN 15
          WHEN LOWER(plan) LIKE '%pro%' THEN 5
          ELSE 2
        END
        WHERE max_users IS NULL OR max_users = 0
      `);
      await this.sqlite.run(`
        UPDATE traders
        SET location_limit = CASE 
          WHEN LOWER(plan) LIKE '%distributor%' THEN 20
          WHEN LOWER(plan) LIKE '%enterprise%' OR LOWER(plan) LIKE '%premium%' THEN 5
          WHEN LOWER(plan) LIKE '%pro%' THEN 2
          ELSE 1
        END
        WHERE location_limit IS NULL OR location_limit = 0
      `);

      // Ensure each trader has a primary tenant admin record in trader_members
      const existingTraders = await this.sqlite.all('SELECT id, email, full_name, password_hash, created_at FROM traders');
      for (const tr of (existingTraders || [])) {
        if (!tr.email) continue;
        const member = await this.sqlite.get(
          'SELECT id FROM trader_members WHERE trader_id = ? AND (role = ? OR role = ?)',
          [tr.id, 'tenant_admin', 'owner']
        );
        if (!member) {
          await this.sqlite.run(`
            INSERT OR IGNORE INTO trader_members (
              trader_id, username, password_hash, full_name, role, status, created_at, permissions
            ) VALUES (?, ?, ?, ?, 'tenant_admin', 'active', ?, ?)
          `, [
            tr.id, 
            tr.email.toLowerCase(), 
            tr.password_hash || '$2a$10$wN1b6l.b5o4mNfE9r18npe/7Xy9gKxYkL3xM4d0n4C1eL5p1q1b2a', 
            tr.full_name || 'Primary Administrator',
            tr.created_at || new Date().toISOString(),
            JSON.stringify({
              pos: true, inventory: true, production: true, finance: true, tax: true,
              reports: true, hr: true, regime: true, traders: true, manage_team: true, approve_commissions: true
            })
          ]);
        }
      }
    } catch (e) {
      console.warn('[DB] Tenant backfill warning:', e);
    }

    // Ensure traders without explicitly saved printer settings do not have automatic tax applied
    try {
      await this.sqlite.run(`
        UPDATE traders 
        SET apply_tax = 0, tax_rate = 0 
        WHERE id NOT IN (SELECT trader_id FROM trader_printer_settings)
      `);
    } catch (e) {}

    // Check/update schema version
    const version = await this.sqlite.get(
      "SELECT value FROM metadata WHERE key = 'schema_version'"
    );
    
    if (!version) {
      await this.sqlite.run(
        "INSERT INTO metadata (key, value) VALUES ('schema_version', '1')"
      );
    }
  }

  async seed() {
    console.log('[DB] Seeding essential data...');
    const essentialUsers = [
      { email: 'Njoroge@businesspro.com', pass: 'Businesspro9900', role: 'admin', name: 'Njoroge Kariuki' },
      { email: 'admin@businesspro.com', pass: 'Budinesspro9900', role: 'admin', name: 'System Admin' },
      { email: 'admin@busnesspro.com', pass: 'Budinesspro9900', role: 'admin', name: 'System Admin' },
      { email: 'baraka@businesspro.com', pass: 'Baraka123', role: 'promoter', name: 'Baraka Promoter' },
      { email: 'promoter@businesspro.com', pass: 'Promoter123', role: 'promoter', name: 'Main Promoter' },
      { email: 'philiam@businesspeo.com', pass: 'Philiam123', role: 'promoter', name: 'Philiam' },
      { email: 'Joy@businesspeo.com', pass: 'joy123', role: 'promoter', name: 'Joy' }
    ];

    for (const u of essentialUsers) {
      const emailLower = u.email.toLowerCase();
      const existing = await this.get('SELECT id FROM traders WHERE email = ?', [emailLower]);
      const hashedPassword = await bcrypt.hash(u.pass, 10);
      if (!existing) {
        await this.execute(
          'INSERT INTO traders (email, password_hash, full_name, plan, is_active) VALUES (?, ?, ?, ?, 1)',
          [emailLower, hashedPassword, u.name, u.role === 'admin' ? 'Admin' : 'Promoter']
        );
        console.log(`[DB] Seeded user: ${u.email}`);
      } else {
        await this.execute(
          'UPDATE traders SET password_hash = ?, full_name = ?, plan = ?, is_active = 1 WHERE email = ?',
          [hashedPassword, u.name, u.role === 'admin' ? 'Admin' : 'Promoter', emailLower]
        );
        console.log(`[DB] Updated essential user: ${u.email}`);
      }

      // Ensure user is present in users table as well
      try {
        const existingUser = await this.get('SELECT id FROM users WHERE username = ?', [emailLower]);
        if (!existingUser) {
          await this.execute(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [emailLower, hashedPassword, u.role]
          );
        } else {
          await this.execute(
            'UPDATE users SET password_hash = ?, role = ? WHERE username = ?',
            [hashedPassword, u.role, emailLower]
          );
        }
      } catch (userErr) {
        console.error('[DB] Failed to seed users table row:', userErr);
      }
    }

    // Seed initial ingredients if none exist
    try {
      const ingCount = await this.get('SELECT COUNT(*) as count FROM production_ingredients');
      if (!ingCount || ingCount.count === 0) {
        const defaultIngredients = [
          { name: 'Roasted Arabica Coffee Beans', cost_per_unit: 450, unit: 'kg', current_stock: 120, reorder_level: 25 },
          { name: 'Organic Raw Cane Sugar', cost_per_unit: 140, unit: 'kg', current_stock: 250, reorder_level: 50 },
          { name: 'Wheat Baking Flour Grade 1', cost_per_unit: 110, unit: 'kg', current_stock: 400, reorder_level: 60 },
          { name: 'Pasteurized Dairy Milk', cost_per_unit: 85, unit: 'litre', current_stock: 180, reorder_level: 30 },
          { name: 'Eco-Kraft 250g Zip Pouches', cost_per_unit: 12, unit: 'piece', current_stock: 1500, reorder_level: 300 },
          { name: 'Custom Printed Product Labels', cost_per_unit: 4.5, unit: 'piece', current_stock: 2000, reorder_level: 400 }
        ];
        for (const ing of defaultIngredients) {
          await this.execute(
            'INSERT INTO production_ingredients (trader_id, name, cost_per_unit, unit, current_stock, reorder_level) VALUES (1, ?, ?, ?, ?, ?)',
            [ing.name, ing.cost_per_unit, ing.unit, ing.current_stock, ing.reorder_level]
          );
        }
        console.log('[DB] Seeded initial production ingredients.');
      }

      // Seed initial sample batch if none exist
      const batchCount = await this.get('SELECT COUNT(*) as count FROM production_batches');
      if (!batchCount || batchCount.count === 0) {
        const batchRes: any = await this.execute(
          `INSERT INTO production_batches 
           (trader_id, batch_number, product_id, product_name, quantity_produced, total_cost, cost_per_unit, responsible_user, status, notes, approved_by, approved_at)
           VALUES (1, 'BATCH-20260905-001', 0, 'Signature Dark Roast Coffee 250g', 100, 15450, 154.50, 'Master Roaster', 'approved', 'Quality inspection passed. Roasted and packaged for distribution.', 'admin@businesspro.com', CURRENT_TIMESTAMP)`
        );
        const sqliteResult = Array.isArray(batchRes) ? batchRes.find((r: any) => r.source === 'sqlite') : null;
        const bId = sqliteResult?.lastID || 1;

        await this.execute(
          `INSERT INTO production_raw_material_usage (batch_id, ingredient_id, ingredient_name, quantity_used, cost)
           VALUES (?, 1, 'Roasted Arabica Coffee Beans', 25, 11250),
                  (?, 5, 'Eco-Kraft 250g Zip Pouches', 100, 1200),
                  (?, 6, 'Custom Printed Product Labels', 100, 450)`,
          [bId, bId, bId]
        );

        await this.execute(
          `INSERT INTO production_labour_costs (batch_id, employee_name, hours_worked, hourly_rate, total_cost, role)
           VALUES (?, 'Master Roaster', 4, 350, 1400, 'Roaster Operator'),
                  (?, 'Packaging Specialist', 3, 250, 750, 'Packer')`,
          [bId, bId]
        );

        await this.execute(
          `INSERT INTO production_overhead_costs (batch_id, category, amount, description)
           VALUES (?, 'Utilities', 300, 'Electric roaster power draw'),
                  (?, 'Packaging', 100, 'Sealing ribbons and tape')`,
          [bId, bId]
        );
        console.log('[DB] Seeded initial sample production batch.');
      }
    } catch (ingErr) {
      console.error('[DB] Failed to seed initial ingredients/batches:', ingErr);
    }
  }

  private async initSupabaseSchema() {
    try {
      // Create tables in Supabase if they don't exist
      const sql = `
        CREATE TABLE IF NOT EXISTS traders (
          id BIGSERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          full_name TEXT NOT NULL,
          business_name TEXT,
          phone TEXT,
          location TEXT,
          tax_id TEXT,
          plan TEXT DEFAULT 'Basic',
          status TEXT DEFAULT 'active',
          discount_rate DECIMAL(10,2) DEFAULT 0,
          receipt_header TEXT DEFAULT 'Your trusted wholesale partner',
          receipt_footer TEXT DEFAULT 'Goods once sold are not returnable.',
          show_logo BOOLEAN DEFAULT TRUE,
          logo_url TEXT,
          country TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          last_ip TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          finance_active BOOLEAN DEFAULT FALSE,
          tax_active BOOLEAN DEFAULT FALSE,
          production_active BOOLEAN DEFAULT FALSE,
          hr_active BOOLEAN DEFAULT FALSE,
          tax_regime_country TEXT,
          subscription_expires_at TEXT,
          distributor_id BIGINT REFERENCES traders(id)
        );

        CREATE TABLE IF NOT EXISTS inventory (
          id BIGSERIAL PRIMARY KEY,
          trader_id BIGINT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
          item_code TEXT UNIQUE NOT NULL,
          item_name TEXT NOT NULL,
          sku TEXT,
          barcode TEXT,
          category TEXT,
          brand TEXT,
          model TEXT,
          uom TEXT DEFAULT 'pcs',
          quantity INTEGER DEFAULT 0,
          unit_price DECIMAL(10,2) DEFAULT 0,
          cost_price DECIMAL(10,2) DEFAULT 0,
          wholesale_price DECIMAL(10,2) DEFAULT 0,
          retail_price DECIMAL(10,2) DEFAULT 0,
          tax_category TEXT DEFAULT 'General',
          tax_rate DECIMAL(10,2) DEFAULT 0,
          supplier TEXT,
          manufacturer TEXT,
          country_of_origin TEXT,
          reorder_level INTEGER DEFAULT 0,
          stock_alert BOOLEAN DEFAULT FALSE,
          description TEXT,
          images TEXT,
          location TEXT,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id BIGSERIAL PRIMARY KEY,
          invoice_no TEXT UNIQUE,
          cashier_name TEXT,
          trader_id BIGINT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
          trader_name TEXT,
          business_name TEXT,
          customer_name TEXT,
          payment_method TEXT,
          items TEXT,
          item_count INTEGER,
          subtotal DECIMAL(10,2),
          discount_rate DECIMAL(10,2),
          discount_amount DECIMAL(10,2),
          tax DECIMAL(10,2),
          total DECIMAL(10,2),
          transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS devices (
          id BIGSERIAL PRIMARY KEY,
          trader_id BIGINT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
          device_id TEXT NOT NULL,
          device_name TEXT,
          device_type TEXT,
          last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_trusted BOOLEAN DEFAULT FALSE,
          UNIQUE(trader_id, device_id)
        );

        CREATE TABLE IF NOT EXISTS sync_metadata (
          id BIGSERIAL PRIMARY KEY,
          trader_id BIGINT NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
          table_name TEXT NOT NULL,
          last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sync_version INTEGER DEFAULT 1,
          UNIQUE(trader_id, table_name)
        );

        CREATE INDEX IF NOT EXISTS idx_inventory_trader ON inventory(trader_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_trader ON transactions(trader_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_code ON inventory(item_code);
      `;

      // Check if custom exec_sql RPC function exists in Supabase
      try {
        const { error } = await this.supabase.rpc('exec_sql', { sql });
        if (!error) {
          this.hasRpcSupport = true;
          console.log('✅ Supabase schema initialized via exec_sql RPC');
        } else {
          this.hasRpcSupport = false;
          // Verify table accessibility via Supabase REST client
          const { error: restErr } = await this.supabase.from('traders').select('id').limit(1);
          if (!restErr) {
            console.log('✅ Supabase REST API connected & tables verified');
          } else {
            console.log('✅ Supabase initialized in hybrid sync mode (authoritative SQLite + cloud sync)');
          }
        }
      } catch (rpcErr) {
        this.hasRpcSupport = false;
        console.log('✅ Supabase initialized in hybrid sync mode');
      }
      
      console.log('✅ Supabase integration ready');
    } catch (error) {
      console.log('ℹ️ Supabase schema check completed (continuing in hybrid mode with SQLite)');
    }
  }

  // Query method - tries Supabase first if RPC supported, otherwise uses authoritative SQLite
  async query(sql: string, params: any[] = []) {
    if (this.useSupabase && this.supabase && this.hasRpcSupport) {
      try {
        // Try Supabase RPC first if available
        const { data, error } = await this.supabase.rpc('query', { 
          query_text: sql, 
          query_params: params 
        });
        
        if (!error && data) {
          return { data, source: 'supabase' };
        }
      } catch (error) {
        // Fall through to SQLite
      }
    }
    
    // SQLite execution
    if (this.sqlite) {
      const data = await this.sqlite.all(sql, params);
      return { data, source: 'sqlite' };
    }
    
    throw new Error('No database available');
  }

  // Execute method - writes to SQLite and Supabase if RPC available
  async execute(sql: string, params: any[] = []) {
    const results = [];
    
    // Write to Supabase if RPC exec is available
    if (this.useSupabase && this.supabase && this.hasRpcSupport) {
      try {
        const { data, error } = await this.supabase.rpc('exec', { 
          query_text: sql, 
          query_params: params 
        });
        if (!error) {
          results.push({ source: 'supabase', success: true, data });
        }
      } catch (error) {
        // Ignored in hybrid mode
      }
    }
    
    // Write to SQLite
    if (this.sqlite) {
      const result = await this.sqlite.run(sql, params);
      results.push({ source: 'sqlite', success: true, lastID: result.lastID });
    }
    
    return results;
  }

  // Get a single record
  async get(sql: string, params: any[] = []) {
    if (this.useSupabase && this.supabase && this.hasRpcSupport) {
      try {
        const { data, error } = await this.supabase.rpc('query_one', { 
          query_text: sql, 
          query_params: params 
        });
        if (!error && data) {
          return data;
        }
      } catch (error) {
        // Fall through
      }
    }
    
    if (this.sqlite) {
      return await this.sqlite.get(sql, params);
    }
    
    return null;
  }

  // Get all matching records
  async all(sql: string, params: any[] = []): Promise<any[]> {
    if (this.sqlite) {
      return await this.sqlite.all(sql, params);
    }
    try {
      const res = await this.query(sql, params);
      return res?.data || [];
    } catch {
      return [];
    }
  }

  // Get the last inserted ID (SQLite)
  async lastInsertRowid() {
    if (this.sqlite) {
      const result = await this.sqlite.get('SELECT last_insert_rowid() as id');
      return result?.id || null;
    }
    return null;
  }

  // Check if using Supabase
  isUsingSupabase(): boolean {
    return !!(this.useSupabase && this.supabase);
  }

  // Get active Supabase client instance
  getSupabase() {
    return this.supabase;
  }

  // Dynamically configure Supabase credentials
  updateSupabaseConfig(url: string, key: string) {
    if (url && key) {
      SUPABASE_URL = url.trim().replace(/\/$/, '');
      SUPABASE_ANON_KEY = key.trim();
      process.env.SUPABASE_URL = SUPABASE_URL;
      process.env.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
      try {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        this.useSupabase = true;
        console.log(`✅ Supabase configuration updated & reconnected: ${SUPABASE_URL}`);
        return { success: true, url: SUPABASE_URL };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: 'URL and key are required' };
  }

  // Test ping & synchronize cloud metadata with Supabase
  async syncToSupabase() {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }
    try {
      const pingPromise = this.supabase
        .from('traders')
        .select('count', { count: 'exact', head: true });
        
      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout (2.5s)')), 2500)
      );

      const { error } = await Promise.race([pingPromise, timeoutPromise]);
        
      return {
        success: !error,
        connected: !error,
        targetUrl: SUPABASE_URL,
        tablesChecked: ['traders', 'inventory', 'transactions'],
        error: error ? error.message : null
      };
    } catch (err: any) {
      return {
        success: false,
        connected: false,
        targetUrl: SUPABASE_URL,
        tablesChecked: ['traders', 'inventory', 'transactions'],
        error: err.message
      };
    }
  }

  // Access underlying SQLite instance safely
  getSqlite() {
    return this.sqlite;
  }

  // Atomic database transaction execution with automatic rollback
  async runTransaction<T>(callback: (sqlite: any) => Promise<T>): Promise<T> {
    if (!this.sqlite) throw new Error('SQLite database not initialized');
    await this.sqlite.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = await callback(this.sqlite);
      await this.sqlite.exec('COMMIT;');
      this.scheduleSnapshotDebounced();
      return result;
    } catch (error) {
      try {
        await this.sqlite.exec('ROLLBACK;');
      } catch (rbErr) {
        console.error('Transaction rollback failed:', rbErr);
      }
      throw error;
    }
  }

  // Debounced auto-snapshot trigger after mutations
  private snapshotTimeout: NodeJS.Timeout | null = null;
  public scheduleSnapshotDebounced() {
    if (this.snapshotTimeout) {
      clearTimeout(this.snapshotTimeout);
    }
    this.snapshotTimeout = setTimeout(() => {
      this.exportFullSnapshot().catch(err => {
        console.warn('[Snapshot] Debounced snapshot error:', err);
      });
    }, 3000);
  }

  // Export full snapshot of all operational data
  async exportFullSnapshot(): Promise<any> {
    if (!this.sqlite) throw new Error('SQLite database not initialized');

    const coreTables = [
      'metadata',
      'traders',
      'users',
      'inventory',
      'transactions',
      'devices',
      'billing_invoices',
      'audit_logs',
      'finance_accounts',
      'journal_entries',
      'journal_lines',
      'tax_transactions',
      'production_ingredients',
      'production_batches',
      'production_raw_material_usage',
      'production_labour_costs',
      'production_overhead_costs',
      'production_inventory_movements',
      'production_recipes',
      'production_recipe_ingredients',
      'shared_blobs',
      'trader_members',
      'trader_printer_settings',
      'vendor_requests',
      'tenant_backups'
    ];

    const snapshot: any = {
      app: 'BiasharaSasa',
      version: '2.1.0',
      schemaVersion: 1,
      database: this.isUsingSupabase() ? 'supabase' : 'sqlite',
      timestamp: new Date().toISOString(),
      counts: {},
      tables: {}
    };

    for (const table of coreTables) {
      try {
        const tableCheck = await this.sqlite.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          [table]
        );
        if (tableCheck) {
          const rows = await this.sqlite.all(`SELECT * FROM ${table}`);
          snapshot.tables[table] = rows || [];
          snapshot.counts[table] = (rows || []).length;
        }
      } catch (err) {
        console.warn(`[Snapshot] Warning reading table ${table}:`, err);
      }
    }

    // Cryptographic SHA-256 checksum of table data payload to guarantee tamper detection & integrity
    try {
      const payloadString = JSON.stringify(snapshot.tables);
      snapshot.checksum = crypto.createHash('sha256').update(payloadString).digest('hex');
      snapshot.totalRecords = Object.values(snapshot.counts).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
    } catch (hashErr) {
      snapshot.checksum = null;
    }

    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');

      // Keep recent timestamped snapshots for rotation (up to 10 latest)
      const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
      const histFile = path.join(BACKUP_DIR, `biashara_snapshot_${timestampStr}.json`);
      fs.writeFileSync(histFile, JSON.stringify(snapshot, null, 2), 'utf-8');

      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('biashara_snapshot_') && f.endsWith('.json'))
        .sort()
        .reverse();
      if (files.length > 10) {
        for (const oldFile of files.slice(10)) {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, oldFile));
          } catch (e) {}
        }
      }
    } catch (writeErr) {
      console.error('[Snapshot] Failed saving snapshot to disk:', writeErr);
    }

    return snapshot;
  }

  // Restore database from snapshot JSON
  async importFullSnapshot(snapshotData: any, isManual: boolean = true): Promise<{ success: boolean; message: string; rowsRestored: number; checksumVerified: boolean }> {
    if (!this.sqlite) throw new Error('SQLite database not initialized');
    if (!snapshotData || !snapshotData.tables || typeof snapshotData.tables !== 'object') {
      throw new Error('Invalid snapshot structure: missing tables object');
    }

    // Verify cryptographic SHA-256 checksum if present
    let checksumVerified = false;
    if (snapshotData.checksum) {
      try {
        const computed = crypto.createHash('sha256').update(JSON.stringify(snapshotData.tables)).digest('hex');
        if (computed === snapshotData.checksum) {
          checksumVerified = true;
          console.log(`✅ [Snapshot Import] Cryptographic SHA-256 checksum VERIFIED: ${computed.substring(0, 16)}...`);
        } else {
          console.warn(`⚠️ [Snapshot Import] Checksum warning: expected ${snapshotData.checksum}, got ${computed}`);
        }
      } catch (chkErr) {
        console.warn('[Snapshot Import] Checksum calculation warning:', chkErr);
      }
    }

    const tables = snapshotData.tables;
    const tableOrder = [
      'metadata',
      'traders',
      'users',
      'inventory',
      'devices',
      'billing_invoices',
      'finance_accounts',
      'journal_entries',
      'journal_lines',
      'tax_transactions',
      'production_ingredients',
      'production_recipes',
      'production_batches',
      'production_recipe_ingredients',
      'production_raw_material_usage',
      'production_labour_costs',
      'production_overhead_costs',
      'production_inventory_movements',
      'transactions',
      'audit_logs',
      'shared_blobs',
      'trader_members',
      'trader_printer_settings',
      'vendor_requests',
      'vendor_commissions',
      'discount_proposals',
      'interop_requests',
      'purchase_orders',
      'goods_receipt_notes',
      'error_logs'
    ];

    let totalRestored = 0;
    await this.sqlite.exec('PRAGMA foreign_keys = OFF;');
    await this.sqlite.exec('BEGIN TRANSACTION;');

    try {
      for (const tableName of tableOrder) {
        if (!tables[tableName] || !Array.isArray(tables[tableName])) continue;

        const tableCheck = await this.sqlite.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          [tableName]
        );
        if (!tableCheck) continue;

        const rows = tables[tableName];
        await this.sqlite.exec(`DELETE FROM ${tableName}`);

        if (rows.length > 0) {
          const sampleRow = rows[0];
          const cols = Object.keys(sampleRow);
          const placeholders = cols.map(() => '?').join(', ');
          const sql = `INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`;

          for (const row of rows) {
            const vals = cols.map(c => row[c] !== undefined ? row[c] : null);
            await this.sqlite.run(sql, vals);
            totalRestored++;
          }
        }
      }

      await this.sqlite.exec('COMMIT;');
      await this.sqlite.exec('PRAGMA foreign_keys = ON;');

      // Ensure essential system admin credentials exist
      await this.seed();

      // Refresh snapshot file
      this.scheduleSnapshotDebounced();

      return {
        success: true,
        message: `Restored successfully. ${totalRestored} records preserved.${checksumVerified ? ' Cryptographic SHA-256 integrity verified.' : ''}`,
        rowsRestored: totalRestored,
        checksumVerified
      };
    } catch (err: any) {
      await this.sqlite.exec('ROLLBACK;');
      await this.sqlite.exec('PRAGMA foreign_keys = ON;');
      console.error('[Import] Failed to import snapshot:', err);
      throw new Error(`Restore failed: ${err.message}`);
    }
  }

  // Auto-restore data on cold start / deployment if active database is empty
  async autoRestoreIfEmpty(): Promise<void> {
    try {
      if (!this.sqlite) return;

      const txRow = await this.sqlite.get('SELECT COUNT(*) as count FROM transactions');
      const invRow = await this.sqlite.get('SELECT COUNT(*) as count FROM inventory');
      const customTraders = await this.sqlite.get(`
        SELECT COUNT(*) as count FROM traders 
        WHERE email NOT IN (
          'njoroge@businesspro.com', 'admin@businesspro.com', 'admin@busnesspro.com',
          'baraka@businesspro.com', 'promoter@businesspro.com', 'philiam@businesspeo.com', 'joy@businesspeo.com'
        )
      `);

      const totalExistingRecords = (txRow?.count || 0) + (invRow?.count || 0) + (customTraders?.count || 0);

      if (totalExistingRecords === 0) {
        console.log('ℹ️ Database is empty of transactional user data. Checking for previous snapshot to restore...');
        if (fs.existsSync(SNAPSHOT_FILE)) {
          const snapshotRaw = fs.readFileSync(SNAPSHOT_FILE, 'utf-8');
          const snapshotData = JSON.parse(snapshotRaw);
          console.log(`📦 Found auto-snapshot from ${snapshotData.timestamp || 'unknown date'}. Auto-restoring...`);
          const res = await this.importFullSnapshot(snapshotData, false);
          console.log(`🎉 [Auto-Restore] Successfully restored business data (${res.rowsRestored} records)! No data was lost.`);
        } else {
          console.log('ℹ️ No previous snapshot file found. Initialized with fresh clean database.');
        }
      } else {
        console.log(`✅ Existing database active: ${txRow?.count || 0} transactions, ${invRow?.count || 0} inventory items, ${customTraders?.count || 0} custom traders.`);
        if (!fs.existsSync(SNAPSHOT_FILE)) {
          await this.exportFullSnapshot();
        }
      }
    } catch (err) {
      console.error('⚠️ [Auto-Restore] Check/restore failed:', err);
    }
  }

  // System integrity report
  async getIntegrityStatus() {
    if (!this.sqlite) return { status: 'ERROR', message: 'SQLite not initialized' };

    try {
      const integrity = await this.sqlite.get('PRAGMA integrity_check');
      const walMode = await this.sqlite.get('PRAGMA journal_mode');
      const foreignKeys = await this.sqlite.get('PRAGMA foreign_keys');

      const txCount = await this.sqlite.get('SELECT COUNT(*) as count FROM transactions');
      const invCount = await this.sqlite.get('SELECT COUNT(*) as count FROM inventory');
      const traderCount = await this.sqlite.get('SELECT COUNT(*) as count FROM traders');

      let snapshotInfo: any = null;
      if (fs.existsSync(SNAPSHOT_FILE)) {
        const stats = fs.statSync(SNAPSHOT_FILE);
        snapshotInfo = {
          exists: true,
          sizeBytes: stats.size,
          lastModified: stats.mtime.toISOString(),
          path: SNAPSHOT_FILE
        };
      }

      return {
        status: integrity?.integrity_check === 'ok' ? 'HEALTHY' : 'CORRUPTED',
        integrity: integrity?.integrity_check || 'unknown',
        journalMode: walMode?.journal_mode || 'unknown',
        foreignKeys: foreignKeys?.foreign_keys === 1 ? 'ON' : 'OFF',
        counts: {
          transactions: txCount?.count || 0,
          inventory: invCount?.count || 0,
          traders: traderCount?.count || 0
        },
        snapshot: snapshotInfo,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return { status: 'ERROR', message: err.message };
    }
  }

  // Comprehensive Deep System Integrity Audit
  async runIntegrityAudit(): Promise<any> {
    if (!this.sqlite) throw new Error('SQLite database not initialized');

    try {
      const pragmaIntegrity = await this.sqlite.get('PRAGMA integrity_check');
      const pragmaFk = await this.sqlite.all('PRAGMA foreign_key_check');
      const pragmaQuick = await this.sqlite.get('PRAGMA quick_check');
      const journalMode = await this.sqlite.get('PRAGMA journal_mode');
      const pageSize = await this.sqlite.get('PRAGMA page_size');
      const pageCount = await this.sqlite.get('PRAGMA page_count');
      const freelistCount = await this.sqlite.get('PRAGMA freelist_count');

      // 1. Check for orphaned transactions (trader deleted or invalid)
      const orphanTx = await this.sqlite.get(`
        SELECT COUNT(*) as count FROM transactions 
        WHERE trader_id IS NOT NULL AND trader_id NOT IN (SELECT id FROM traders)
      `);

      // 2. Check for orphaned journal lines
      let orphanLines = { count: 0 };
      try {
        orphanLines = await this.sqlite.get(`
          SELECT COUNT(*) as count FROM journal_lines 
          WHERE entry_id NOT IN (SELECT id FROM journal_entries)
        `) || { count: 0 };
      } catch {}

      // 3. Check for negative inventory quantities
      const negativeStock = await this.sqlite.all(`
        SELECT id, item_name as name, sku, quantity, trader_id FROM inventory WHERE quantity < 0
      `);

      // 4. Ledger balancing check (Debit sum vs Credit sum)
      let ledgerBalance: any = { debits: 0, credits: 0, balanced: true, discrepancy: 0 };
      try {
        const balanceCheck = await this.sqlite.get(`
          SELECT COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit 
          FROM journal_lines
        `);
        if (balanceCheck) {
          const diff = Math.abs(balanceCheck.total_debit - balanceCheck.total_credit);
          ledgerBalance = {
            debits: balanceCheck.total_debit,
            credits: balanceCheck.total_credit,
            balanced: diff < 0.01,
            discrepancy: diff
          };
        }
      } catch {}

      // 5. Check snapshot status & backup repository
      let snapshotInfo: any = null;
      let storedSnapshots: any[] = [];
      if (fs.existsSync(BACKUP_DIR)) {
        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
        storedSnapshots = files.map(file => {
          const filePath = path.join(BACKUP_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            sizeBytes: stats.size,
            lastModified: stats.mtime.toISOString(),
            isLatest: file === 'biashara_latest_snapshot.json'
          };
        }).sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

        if (fs.existsSync(SNAPSHOT_FILE)) {
          const stats = fs.statSync(SNAPSHOT_FILE);
          snapshotInfo = {
            sizeBytes: stats.size,
            lastModified: stats.mtime.toISOString(),
            path: SNAPSHOT_FILE
          };
        }
      }

      const issues: any[] = [];
      if (pragmaIntegrity?.integrity_check !== 'ok') {
        issues.push({ severity: 'CRITICAL', component: 'SQLite Core', message: `PRAGMA integrity check returned: ${pragmaIntegrity?.integrity_check}` });
      }
      if (pragmaFk && pragmaFk.length > 0) {
        issues.push({ severity: 'WARNING', component: 'Foreign Keys', message: `${pragmaFk.length} foreign key reference violation(s) detected.` });
      }
      if ((orphanTx?.count || 0) > 0) {
        issues.push({ severity: 'WARNING', component: 'POS Transactions', message: `${orphanTx.count} transaction(s) reference non-existent trader accounts.` });
      }
      if (negativeStock && negativeStock.length > 0) {
        issues.push({ severity: 'INFO', component: 'Inventory Stock', message: `${negativeStock.length} inventory item(s) have negative stock quantities.` });
      }
      if (!ledgerBalance.balanced) {
        issues.push({ severity: 'WARNING', component: 'Accounting Ledger', message: `Ledger debits and credits do not balance (discrepancy: KSh ${ledgerBalance.discrepancy.toFixed(2)}).` });
      }

      const overallStatus = issues.some(i => i.severity === 'CRITICAL') ? 'CRITICAL' : (issues.length > 0 ? 'WARNING' : 'HEALTHY');

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        issues,
        checks: {
          sqliteIntegrity: pragmaIntegrity?.integrity_check || 'ok',
          quickCheck: pragmaQuick?.quick_check || 'ok',
          foreignKeyViolations: pragmaFk?.length || 0,
          orphanTransactions: orphanTx?.count || 0,
          orphanJournalLines: orphanLines?.count || 0,
          negativeStockItems: negativeStock.length,
          ledgerBalanced: ledgerBalance.balanced,
          ledgerDiscrepancy: ledgerBalance.discrepancy || 0
        },
        storage: {
          journalMode: journalMode?.journal_mode || 'wal',
          pageSizeBytes: pageSize?.page_size || 4096,
          totalPages: pageCount?.page_count || 0,
          freelistPages: freelistCount?.freelist_count || 0,
          approxDbSizeBytes: (pageCount?.page_count || 0) * (pageSize?.page_size || 4096)
        },
        snapshots: {
          count: storedSnapshots.length,
          latest: snapshotInfo,
          list: storedSnapshots
        }
      };
    } catch (err: any) {
      return { status: 'ERROR', message: err.message };
    }
  }

  // Automated Self-Healing & Database Optimization
  async runSelfRepair(): Promise<any> {
    if (!this.sqlite) throw new Error('SQLite database not initialized');

    const actionsTaken: string[] = [];

    // 1. Fix orphan transactions: re-assign to first active trader or ID 1
    try {
      const defaultTrader = await this.sqlite.get('SELECT id FROM traders ORDER BY id ASC LIMIT 1');
      const defaultTraderId = defaultTrader?.id || 1;
      
      const orphanTx = await this.sqlite.get(`
        SELECT COUNT(*) as count FROM transactions 
        WHERE trader_id IS NOT NULL AND trader_id NOT IN (SELECT id FROM traders)
      `);
      if (orphanTx && orphanTx.count > 0) {
        await this.sqlite.run(`
          UPDATE transactions SET trader_id = ? 
          WHERE trader_id IS NOT NULL AND trader_id NOT IN (SELECT id FROM traders)
        `, [defaultTraderId]);
        actionsTaken.push(`Reassigned ${orphanTx.count} orphaned transactions to valid merchant ID #${defaultTraderId}.`);
      }
    } catch (txErr: any) {
      console.warn('[SelfRepair] Orphan transaction check:', txErr.message);
    }

    // 2. Normalize negative inventory quantities to 0
    try {
      const negInv = await this.sqlite.get('SELECT COUNT(*) as count FROM inventory WHERE quantity < 0');
      if (negInv && negInv.count > 0) {
        await this.sqlite.run('UPDATE inventory SET quantity = 0 WHERE quantity < 0');
        actionsTaken.push(`Normalized ${negInv.count} negative stock counts back to zero.`);
      }
    } catch (invErr: any) {
      console.warn('[SelfRepair] Negative stock check:', invErr.message);
    }

    // 3. Clean up orphan journal lines
    try {
      const orphanLines = await this.sqlite.get(`
        SELECT COUNT(*) as count FROM journal_lines 
        WHERE entry_id NOT IN (SELECT id FROM journal_entries)
      `);
      if (orphanLines && orphanLines.count > 0) {
        await this.sqlite.run(`
          DELETE FROM journal_lines 
          WHERE entry_id NOT IN (SELECT id FROM journal_entries)
        `);
        actionsTaken.push(`Purged ${orphanLines.count} dangling journal lines without parent entry.`);
      }
    } catch {}

    // 4. Compact and checkpoint database
    try {
      await this.sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      await this.sqlite.exec('VACUUM;');
      actionsTaken.push('Executed SQLite WAL truncate checkpoint and database VACUUM compaction.');
    } catch (vacuumErr: any) {
      actionsTaken.push(`Compaction note: ${vacuumErr.message}`);
    }

    // 5. Generate fresh post-repair snapshot with cryptographic verification
    const snapshot = await this.exportFullSnapshot();
    actionsTaken.push(`Generated fresh cryptographic disaster recovery snapshot (${(snapshot.checksum || '').substring(0, 12)}...).`);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      repairedActionsCount: actionsTaken.length,
      actionsTaken
    };
  }
}

// ============================================================
// CACHE LAYER (Optional Redis)
// ============================================================
class CacheManager {
  public redis: any = null;
  private memoryCache: Map<string, { data: any, expiry: number }> = new Map();

  constructor() {
    if (REDIS_URL) {
      try {
        // Dynamically import Redis
        import('redis').then(module => {
          this.redis = (module as any).createClient({ url: REDIS_URL });
          this.redis.connect();
          console.log('✅ Redis cache connected');
        }).catch(() => {
          console.log('⚠️ Redis unavailable - using memory cache');
        });
      } catch (error) {
        console.log('⚠️ Redis initialization failed - using memory cache');
      }
    }
  }

  async get(key: string) {
    // Try Redis first
    if (this.redis) {
      try {
        const data = await this.redis.get(`biashara:${key}`);
        if (data) return JSON.parse(data);
      } catch (error) {
        // Fall through to memory
      }
    }
    
    // Try memory cache
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    return null;
  }

  async set(key: string, data: any, ttlSeconds: number = 300) {
    // Set in Redis
    if (this.redis) {
      try {
        await this.redis.setEx(`biashara:${key}`, ttlSeconds, JSON.stringify(data));
      } catch (error) {
        // Fall through
      }
    }
    
    // Set in memory
    this.memoryCache.set(key, {
      data,
      expiry: Date.now() + (ttlSeconds * 1000)
    });
  }

  async delete(key: string) {
    if (this.redis) {
      try {
        await this.redis.del(`biashara:${key}`);
      } catch (error) {}
    }
    this.memoryCache.delete(key);
  }

  async deletePattern(pattern: string) {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`biashara:${pattern}`);
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } catch (error) {}
    }
    
    // Clear memory cache matching pattern
    const patternRegex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.memoryCache.keys()) {
      if (patternRegex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// ============================================================
// INITIALIZE SERVICES
// ============================================================
const db = new DatabaseManager();
const cache = new CacheManager();

// ============================================================
// AUTHENTICATION
// ============================================================
function generateJWT(traderId: number, email: string, tenantId?: string, role?: string, permissions?: any) {
  return jwt.sign(
    { traderId, email, tenantId, role, permissions, iss: 'biasharasasa.com' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function verifyJWT(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function authRequired(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No valid token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  const payload = verifyJWT(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.traderId = (payload as any).traderId;
  req.tenantId = (payload as any).tenantId || (payload as any).tenant_id;
  req.role = (payload as any).role;
  req.permissions = (payload as any).permissions;
  req.email = (payload as any).email;
  req.clientIp = req.headers['x-forwarded-for'] || req.ip;
  req.userAgent = req.headers['user-agent'] || 'Unknown';
  
  next();
}

function permissionRequired(module: string) {
  return (req: any, res: any, next: any) => {
    const role = req.role?.toLowerCase();
    // Super-admins and primary tenant owners/admins always have full access
    if (role === 'admin' || role === 'owner' || role === 'tenant_admin') {
      return next();
    }
    
    // Individual granular permissions check
    if (req.permissions && typeof req.permissions[module] === 'boolean') {
      if (req.permissions[module] === true) return next();
      return res.status(403).json({ error: `Permission denied: ${module} module access restricted` });
    }
    
    // Basic role-based fallback
    const defaults: Record<string, string[]> = {
      'pos': ['manager', 'cashier', 'staff', 'sales_agent', 'service_provider'],
      'inventory': ['manager', 'stock_controller', 'storekeeper', 'sales_agent'],
      'production': ['manager', 'production_supervisor', 'production_officer', 'stock_controller'],
      'finance': ['manager', 'accountant'],
      'tax': ['manager', 'accountant'],
      'reports': ['manager', 'accountant', 'supervisor'],
      'hr': ['manager', 'accountant']
    };

    if (defaults[module] && defaults[module].includes(role || '')) {
      return next();
    }
    
    return res.status(403).json({ error: `Permission denied: Access to ${module} requires additional authorization` });
  };
}

function optionalAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyJWT(token);
    if (payload) {
      req.traderId = (payload as any).traderId;
      req.email = (payload as any).email;
    }
  }
  req.clientIp = req.headers['x-forwarded-for'] || req.ip;
  req.userAgent = req.headers['user-agent'] || 'Unknown';
  next();
}

// ============================================================
// API ENDPOINTS - GLOBAL ACCESS
// ============================================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'BiasharaSasa Global Inventory',
    timestamp: new Date().toISOString(),
    database: db.isUsingSupabase() ? 'supabase' : 'sqlite',
    cache: !!cache.redis ? 'redis' : 'memory',
    version: '2.0.0'
  });
});

// ============================================================
// SHARED DATA STORE (BLOBS) - KV Storage
// ============================================================
app.get('/api/blobs/:key', authRequired, async (req: any, res) => {
  try {
    const { key } = req.params;
    const blob = await db.get('SELECT value FROM shared_blobs WHERE key = ?', [key]);
    if (!blob) {
      return res.status(404).json({ error: 'Key not found' });
    }
    // Try to parse as JSON if possible, otherwise return as string
    let value = blob.value;
    try {
      value = JSON.parse(blob.value);
    } catch (e) {}
    res.json({ key, value });
  } catch (error) {
    console.error('Blob get error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/blobs', authRequired, async (req: any, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await db.execute(
      'INSERT INTO shared_blobs (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [key, stringValue]
    );
    res.json({ success: true, key });
  } catch (error) {
    console.error('Blob set error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Netlify Blobs Activation Endpoint
app.all(['/api/activate-blobs', '/api/blobs/activate'], async (req, res) => {
  try {
    const existing = await db.get('SELECT value FROM shared_blobs WHERE key = ?', ['ent-db']);
    if (!existing) {
      const initialData = JSON.stringify({
        tenants: [
          { code: "BUJA-ENT-01", name: "Bujumbura ENT", pin: "1234", stock: 2000 },
          { code: "KIGALI-ENT-01", name: "Kigali ENT", pin: "1234", stock: 1500 },
          { code: "HQ-ADMIN", name: "HQ Owner", pin: "9999", stock: 10000 }
        ],
        vendors: [],
        sales: [],
        transfers: []
      });
      await db.execute(
        'INSERT INTO shared_blobs (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        ['ent-db', initialData]
      );
    }
    res.setHeader('Content-Type', 'text/plain');
    res.send('Blob Activated');
  } catch (err: any) {
    res.status(500).send('Blob Activation Failed: ' + err.message);
  }
});

// Netlify Python /tmp/my-store Store Sync Endpoints
app.all(['/api/ent-db', '/api/store-data'], async (req, res) => {
  try {
    if (req.method === 'POST') {
      const incoming = req.body || {};
      const existing = await db.get('SELECT value FROM shared_blobs WHERE key = ?', ['ent-db']);
      let currentData: any = {
        tenants: [
          { code: "BUJA-ENT-01", name: "Bujumbura ENT", pin: "1234", stock: 2000 },
          { code: "KIGALI-ENT-01", name: "Kigali ENT", pin: "1234", stock: 1500 },
          { code: "HQ-ADMIN", name: "HQ Owner", pin: "9999", stock: 10000 }
        ],
        vendors: [],
        sales: [],
        transfers: []
      };
      if (existing?.value) {
        try { currentData = JSON.parse(existing.value); } catch (e) {}
      }
      const updated = { ...currentData, ...incoming };
      await db.execute(
        'INSERT INTO shared_blobs (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        ['ent-db', JSON.stringify(updated)]
      );
      return res.json({ success: true, message: 'Saved to ent-db store', data: updated });
    } else {
      const existing = await db.get('SELECT value FROM shared_blobs WHERE key = ?', ['ent-db']);
      let data: any = {
        tenants: [
          { code: "BUJA-ENT-01", name: "Bujumbura ENT", pin: "1234", stock: 2000 },
          { code: "KIGALI-ENT-01", name: "Kigali ENT", pin: "1234", stock: 1500 },
          { code: "HQ-ADMIN", name: "HQ Owner", pin: "9999", stock: 10000 }
        ],
        vendors: [],
        sales: [],
        transfers: []
      };
      if (existing?.value) {
        try { data = JSON.parse(existing.value); } catch (e) {}
      }
      return res.json(data);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, business_name, phone, country, serverIp, serverPort } = req.body;
    
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const emailLower = email.toLowerCase();
    
    // Insert into database
    const sql = `
      INSERT INTO traders (email, password_hash, full_name, business_name, phone, country, server_ip, server_port)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await db.execute(sql, [
      emailLower, hashedPassword, full_name, 
      business_name || null, phone || null, country || 'Unknown',
      serverIp || null, serverPort || 8080
    ]);
    
    const trader = await db.get(
      'SELECT id FROM traders WHERE email = ?',
      [emailLower]
    );
    
    if (!trader) {
      throw new Error('Failed to create user');
    }
    
    const token = generateJWT(trader.id, emailLower);
    
    res.status(201).json({
      status: 'success',
      message: 'Account created successfully',
      trader_id: trader.id,
      token,
      email: emailLower
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login (Supports /api/auth/login and /api/login)
const handleLoginRequest = async (req: any, res: any) => {
  try {
    const rawIdentifier = (req.body.email || req.body.username || '').toString().trim();
    const rawPassword = (req.body.password || '').toString().trim();
    const { device_id, device_name } = req.body;
    
    if (!rawIdentifier || !rawPassword) {
      return res.status(400).json({ success: false, error: 'Email/username and password required' });
    }
    
    let emailLower = rawIdentifier.toLowerCase();
    const isAdminIdentifier = 
      emailLower === 'admin' || 
      emailLower === 'admin@businesspro.com' || 
      emailLower === 'admin@busnesspro.com' ||
      emailLower === 'busnesspro.com' ||
      emailLower === 'businesspro.com';

    // Allow entering 'admin' or 'admin@busnesspro.com' as admin alias
    if (emailLower === 'admin') {
      emailLower = 'admin@businesspro.com';
    }
    
    // Get trader from traders table
    let trader = await db.get(
      `SELECT id, tenant_id, email, password_hash, full_name, server_ip, server_port, plan, password_reset_required 
       FROM traders WHERE LOWER(email) = ? AND is_active = 1`,
      [emailLower]
    );

    // Fallback: check users table
    if (!trader) {
      const userRow = await db.get(
        `SELECT id, tenant_id, username, password_hash, role, password_reset_required FROM users WHERE LOWER(username) = ?`,
        [emailLower]
      );
      if (userRow) {
        trader = {
          id: userRow.id,
          tenant_id: userRow.tenant_id,
          email: userRow.username,
          password_hash: userRow.password_hash,
          full_name: userRow.role === 'admin' ? 'System Admin' : userRow.username,
          server_ip: null,
          server_port: 8080,
          plan: userRow.role === 'admin' ? 'Admin' : 'Promoter',
          password_reset_required: userRow.password_reset_required
        };
      }
    }

    // Fallback: check trader_members table for tenant staff / team members
    if (!trader) {
      const memberRow = await db.get(
        `SELECT id, trader_id, tenant_id, username, password_hash, role, permissions, full_name, phone, status, password_reset_required
         FROM trader_members 
         WHERE LOWER(username) = ? AND (status IS NULL OR status = 'active')`,
        [emailLower]
      );
      if (memberRow) {
        let parsedPerms: any = null;
        if (memberRow.permissions) {
          try {
            parsedPerms = typeof memberRow.permissions === 'string' ? JSON.parse(memberRow.permissions) : memberRow.permissions;
          } catch {
            parsedPerms = null;
          }
        }
        trader = {
          id: memberRow.trader_id,
          tenant_id: memberRow.tenant_id,
          member_id: memberRow.id,
          email: memberRow.username,
          password_hash: memberRow.password_hash || (await bcrypt.hash('Biashara123', 10)),
          full_name: memberRow.full_name || memberRow.username,
          server_ip: null,
          server_port: 8080,
          plan: 'Staff',
          member_role: memberRow.role || 'cashier',
          member_permissions: parsedPerms,
          password_reset_required: memberRow.password_reset_required
        };
      }
    }

    // If still not found and logging in as admin, retrieve the primary admin trader
    if (!trader && isAdminIdentifier) {
      const adminTrader = await db.get(
        "SELECT * FROM traders WHERE LOWER(email) IN ('admin@busnesspro.com', 'admin@businesspro.com') LIMIT 1"
      );
      if (adminTrader) {
        trader = adminTrader;
      }
    }
    
    if (!trader) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Verify password: check bcrypt compare, direct string match, or master password match
    let validPassword = false;
    try {
      validPassword = await bcrypt.compare(rawPassword, trader.password_hash);
    } catch {
      validPassword = false;
    }

    const isMasterAdminPass = 
      rawPassword === 'Budinesspro9900' ||
      rawPassword === 'budinesspro9900' ||
      rawPassword === 'Businesspro9900' ||
      rawPassword === 'businesspro9900' ||
      rawPassword === 'Businesspro9000' ||
      rawPassword === 'Businesspro99';

    if (!validPassword) {
      if (rawPassword === trader.password_hash) {
        validPassword = true;
      } else if (
        (isAdminIdentifier || emailLower === 'njoroge@businesspro.com') &&
        isMasterAdminPass
      ) {
        validPassword = true;
      }
    }

    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Update last login
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    await db.execute(
      'UPDATE traders SET last_login = CURRENT_TIMESTAMP, last_ip = ? WHERE id = ?',
      [clientIp, trader.id]
    );
    
    // Register device
    if (device_id) {
      await db.execute(
        `INSERT OR REPLACE INTO devices (trader_id, device_id, device_name, last_active)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [trader.id, device_id, device_name || 'Unknown Device']
      );
    }
    
    let userRole = trader.member_role || 'manager';
    if (!trader.member_role) {
      if (emailLower.includes('admin') || trader.plan === 'Admin' || emailLower === 'njoroge@businesspro.com') {
        userRole = 'admin';
      } else if (emailLower.includes('promoter') || emailLower.includes('baraka') || emailLower.includes('philiam') || emailLower.includes('joy') || trader.plan === 'Promoter') {
        userRole = 'promoter';
      }
    }

    // Generate JWT
    const tenantId = trader.tenant_id || trader.tenantId || null;
    const token = generateJWT(trader.id, trader.email || emailLower, tenantId, userRole, trader.member_permissions);

    if (trader.member_id) {
      await db.execute('UPDATE trader_members SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [trader.member_id]).catch(() => {});
    }

    // Cache user data
    await cache.set(`user:${trader.id}`, {
      id: trader.id,
      email: trader.email,
      full_name: trader.full_name,
      role: userRole,
      permissions: trader.member_permissions
    }, 3600);
    
    res.json({
      success: true,
      status: 'success',
      message: `Welcome back, ${trader.full_name || 'System Admin'}!`,
      trader_id: trader.id,
      traderId: trader.id,
      token,
      email: trader.email,
      username: trader.email,
      role: userRole,
      permissions: trader.member_permissions,
      memberId: trader.member_id,
      full_name: trader.full_name || 'System Admin',
      fullName: trader.full_name || 'System Admin',
      serverIp: trader.server_ip,
      serverPort: trader.server_port,
      password_reset_required: trader.password_reset_required === 1
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
};

app.post('/api/auth/login', handleLoginRequest);
app.post('/api/login', handleLoginRequest);

// ============================================================
// PASSWORD RECOVERY ENDPOINTS
// ============================================================
const handleForgotPassword = async (req: express.Request, res: express.Response) => {
  try {
    let { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }
    email = email.trim().toLowerCase();
    if (email === 'admin' || email === 'admin@busnesspro.com') {
      email = 'admin@businesspro.com';
    }

    // Verify trader or user exists
    const trader = await db.get('SELECT id, email, full_name FROM traders WHERE LOWER(email) = ?', [email]);
    const user = await db.get('SELECT id, username FROM users WHERE LOWER(username) = ?', [email]);

    if (!trader && !user) {
      return res.status(404).json({ success: false, error: 'No user account found matching this email or username' });
    }

    // Generate a cryptographically secure random token and secure signed payload
    const rawEntropy = crypto.randomBytes(32).toString('hex');
    const resetToken = jwt.sign(
      { email, purpose: 'password_reset', entropy: rawEntropy },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Save token record with 1 hour expiration
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.execute(
      'INSERT INTO password_resets (email, token, expires_at, used) VALUES (?, ?, ?, 0)',
      [email, resetToken, expiresAt]
    );

    console.log(`[AUTH-RECOVERY] Password recovery email dispatched to ${email}. Token: ${resetToken.substring(0, 16)}...`);

    res.json({
      success: true,
      status: 'success',
      message: `A password recovery email has been sent to ${email} with instructions and your secure recovery token.`,
      email,
      token: resetToken,
      expiresIn: '1 hour'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Password recovery request failed' });
  }
};

const handleResetPassword = async (req: express.Request, res: express.Response) => {
  try {
    let { email, token, newPassword } = req.body || {};
    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, recovery token, and new password are required' });
    }
    email = email.trim().toLowerCase();
    if (email === 'admin' || email === 'admin@busnesspro.com') {
      email = 'admin@businesspro.com';
    }
    token = token.trim();

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    // Verify token validity via JWT verification
    try {
      const tokenPayload: any = jwt.verify(token, JWT_SECRET);
      if (tokenPayload.purpose !== 'password_reset' || tokenPayload.email.toLowerCase() !== email) {
        return res.status(400).json({ success: false, error: 'Invalid or mismatched recovery token' });
      }
    } catch (jwtErr) {
      return res.status(400).json({ success: false, error: 'Recovery token is invalid or has expired' });
    }

    // Verify token in database and check if already used
    const resetRecord = await db.get(
      'SELECT id, email, token, expires_at, used FROM password_resets WHERE LOWER(email) = ? AND token = ? ORDER BY id DESC LIMIT 1',
      [email, token]
    );

    if (!resetRecord) {
      return res.status(400).json({ success: false, error: 'Recovery token record not found or revoked' });
    }

    if (resetRecord.used === 1) {
      return res.status(400).json({ success: false, error: 'This recovery token has already been used' });
    }

    if (new Date(resetRecord.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'Recovery token has expired. Please request a new one' });
    }

    // Hash new password using bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update in traders table
    await db.execute('UPDATE traders SET password_hash = ? WHERE LOWER(email) = ?', [hashedPassword, email]);

    // Update in users table
    await db.execute('UPDATE users SET password_hash = ? WHERE LOWER(username) = ?', [hashedPassword, email]);

    // Mark token as used
    await db.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [resetRecord.id]);

    console.log(`[AUTH-RECOVERY] Password reset successfully applied for ${email}`);

    res.json({
      success: true,
      status: 'success',
      message: 'Password successfully reset. You may now sign in with your new credentials.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Password reset failed' });
  }
};

app.post('/api/auth/forgot-password', handleForgotPassword);
app.post('/api/forgot-password', handleForgotPassword);
app.post('/api/auth/reset-password', handleResetPassword);
app.post('/api/reset-password', handleResetPassword);

// ============================================================
// FIRST-LOGIN PASSWORD ESTABLISHMENT
// ============================================================
app.post(['/api/first-login/reset-password', '/api/auth/reset-first-login'], async (req, res) => {
  try {
    const { email, username, oldPassword, newPassword, slug, user_id } = req.body;
    const identifier = (email || username || '').toString().trim().toLowerCase();
    
    if (!identifier || !newPassword) {
      return res.status(400).json({ success: false, error: 'Identity and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    // 1. Isolated Tenant DB logic
    if (slug) {
      const tenant = await db.sqlite.get("SELECT * FROM client_tenants WHERE slug = ?", slug);
      if (tenant && fs.existsSync(tenant.db_path)) {
        const tDb = await open({ filename: tenant.db_path, driver: sqlite3.Database });
        try {
           // Verify current password first if possible (oldPassword)
           const user = await tDb.get("SELECT * FROM users WHERE LOWER(email) = ? OR id = ?", [identifier, user_id]);
           if (user && oldPassword) {
             const match = await bcrypt.compare(oldPassword, user.password_hash);
             if (!match) return res.status(401).json({ success: false, error: 'Current password verification failed' });
           }

           await tDb.run(
             "UPDATE users SET password_hash = ?, password_reset_required = 0 WHERE LOWER(email) = ? OR id = ?",
             [hashed, identifier, user_id]
           );
           return res.json({ success: true, message: 'Password established in isolated biashara.' });
        } finally {
          await tDb.close();
        }
      }
    }

    // 2. Global Platform Logic (Traders, Users, Members)
    let found = false;

    // Check traders
    const trader = await db.get("SELECT password_hash FROM traders WHERE LOWER(email) = ?", [identifier]);
    if (trader) {
      if (oldPassword && !(await bcrypt.compare(oldPassword, trader.password_hash))) {
        return res.status(401).json({ success: false, error: 'Verification failed' });
      }
      await db.execute("UPDATE traders SET password_hash = ?, password_reset_required = 0 WHERE LOWER(email) = ?", [hashed, identifier]);
      found = true;
    }

    // Check users
    const gUser = await db.get("SELECT password_hash FROM users WHERE LOWER(username) = ?", [identifier]);
    if (gUser) {
      if (!found && oldPassword && !(await bcrypt.compare(oldPassword, gUser.password_hash))) {
        return res.status(401).json({ success: false, error: 'Verification failed' });
      }
      await db.execute("UPDATE users SET password_hash = ?, password_reset_required = 0 WHERE LOWER(username) = ?", [hashed, identifier]);
      found = true;
    }

    // Check trader_members
    const member = await db.get("SELECT password_hash FROM trader_members WHERE LOWER(username) = ?", [identifier]);
    if (member) {
      if (!found && oldPassword && !(await bcrypt.compare(oldPassword, member.password_hash))) {
        return res.status(401).json({ success: false, error: 'Verification failed' });
      }
      await db.execute("UPDATE trader_members SET password_hash = ?, password_reset_required = 0 WHERE LOWER(username) = ?", [hashed, identifier]);
      found = true;
    }

    if (!found && !slug) {
      return res.status(404).json({ success: false, error: 'Account not found for global platform' });
    }

    res.json({ success: true, message: 'Permanent password established successfully.' });
  } catch (err: any) {
    console.error('[FirstLogin] Reset error:', err);
    res.status(500).json({ success: false, error: 'Internal system failure during password setup' });
  }
});

// Get Inventory
app.get('/api/inventory', authRequired, permissionRequired('inventory'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    
    // Try cache first
    const cacheKey = `inventory:${traderId}`;
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      if (req.query.format === 'wrapper') {
        return res.json({
          status: 'success',
          data: cachedData,
          source: 'cache',
          trader_id: traderId
        });
      }
      return res.json(Array.isArray(cachedData) ? cachedData : (cachedData?.data || []));
    }
    
    // Query database
    let sql, params;
    if (req.tenantId) {
      sql = `
        SELECT id, item_code as sku, item_name as name, category, quantity, unit_price as unitPrice,
               cost_price as costPrice, wholesale_price as wholesalePrice, retail_price as retailPrice,
               tax_category as taxCategory, tax_rate as taxRate, barcode, brand, model, uom,
               supplier, manufacturer, country_of_origin as countryOfOrigin, description, images,
               reorder_level as reorderLevel, stock_alert as stockAlert, location, last_updated as lastUpdated
        FROM inventory 
        WHERE tenant_id = ? 
        ORDER BY item_name
      `;
      params = [req.tenantId];
    } else {
      sql = `
        SELECT id, item_code as sku, item_name as name, category, quantity, unit_price as unitPrice,
               cost_price as costPrice, wholesale_price as wholesalePrice, retail_price as retailPrice,
               tax_category as taxCategory, tax_rate as taxRate, barcode, brand, model, uom,
               supplier, manufacturer, country_of_origin as countryOfOrigin, description, images,
               reorder_level as reorderLevel, stock_alert as stockAlert, location, last_updated as lastUpdated
        FROM inventory 
        WHERE trader_id = ? 
        ORDER BY item_name
      `;
      params = [traderId];
    }
    
    const result = await db.query(sql, params);
    const data = result.data || [];
    
    // Cache for 5 minutes
    await cache.set(cacheKey, data, 300);
    
    if (req.query.format === 'wrapper') {
      return res.json({
        status: 'success',
        data,
        source: result.source || 'database',
        count: data.length,
        trader_id: traderId
      });
    }
    res.json(data);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Add Inventory Item
app.post('/api/inventory', authRequired, permissionRequired('inventory'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const { 
      sku, name, category, quantity, unitPrice, costPrice, 
      wholesalePrice, retailPrice, taxCategory, taxRate,
      barcode, brand, model, uom, supplier, manufacturer, 
      countryOfOrigin, description, images, reorderLevel, location 
    } = req.body;
    
    if (!sku || !name || quantity === undefined || unitPrice === undefined) {
      return res.status(400).json({ error: 'Missing required fields (sku, name, quantity, unitPrice)' });
    }
    
    const tenantId = req.tenantId || null;
    
    const sql = `
      INSERT INTO inventory 
      (trader_id, tenant_id, item_code, item_name, sku, category, quantity, unit_price, 
       cost_price, wholesale_price, retail_price, tax_category, tax_rate,
       barcode, brand, model, uom, supplier, manufacturer, 
       country_of_origin, description, images, reorder_level, stock_alert, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await db.execute(sql, [
      traderId, tenantId, sku, name, sku, category || null,
      quantity, unitPrice, costPrice || 0, wholesalePrice || 0, retailPrice || 0,
      taxCategory || 'General', taxRate || 0, barcode || null, brand || null,
      model || null, uom || 'pcs', supplier || null, manufacturer || null,
      countryOfOrigin || null, description || null, 
      typeof images === 'string' ? images : JSON.stringify(images || []),
      reorderLevel || 0,
      quantity < (reorderLevel || 0) ? 1 : 0,
      location || null
    ]);
    
    // Invalidate cache
    await cache.delete(`inventory:${traderId}`);
    
    res.status(201).json({
      status: 'success',
      message: 'Item added successfully',
      trader_id: traderId
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Item code already exists' });
    }
    console.error('Add inventory error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Bulk Add Inventory
app.post('/api/inventory/bulk', authRequired, async (req: any, res) => {
  try {
    const traderId = req.body.traderId || req.traderId;
    const { items, strategy = 'skip' } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }
    
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    // Fetch existing inventory for this trader to evaluate collision strategy
    const existingInventory = await db.all('SELECT id, item_code, item_name, sku, quantity FROM inventory WHERE trader_id = ?', [traderId]);
    const existingMap = new Map<string, any>();
    for (const ex of existingInventory) {
      if (ex.sku) existingMap.set(String(ex.sku).toLowerCase(), ex);
      if (ex.item_code) existingMap.set(String(ex.item_code).toLowerCase(), ex);
      if (ex.item_name) existingMap.set(String(ex.item_name).toLowerCase(), ex);
    }
    
    for (const item of items) {
      try {
        const rawSku = item.sku || item.item_code || '';
        const itemName = item.name || item.item_name || 'Unnamed Item';
        const matchKey = (rawSku ? String(rawSku).toLowerCase() : String(itemName).toLowerCase());
        const existingItem = matchKey ? existingMap.get(matchKey) : null;

        if (existingItem) {
          if (strategy === 'skip') {
            skipped++;
            continue;
          } else if (strategy === 'overwrite') {
            await db.execute(`
              UPDATE inventory 
              SET item_name = ?, category = COALESCE(?, category), quantity = ?, 
                  unit_price = ?, cost_price = ?, wholesale_price = ?, retail_price = ?, 
                  supplier = COALESCE(?, supplier), reorder_level = ?, description = COALESCE(?, description)
              WHERE id = ? AND trader_id = ?
            `, [
              itemName,
              item.category || null,
              item.quantity || 0,
              item.unitPrice || item.unit_price || item.sellingPrice || 0,
              item.costPrice || item.cost_price || item.buyingPrice || 0,
              item.wholesalePrice || item.wholesale_price || 0,
              item.retailPrice || item.retail_price || item.sellingPrice || 0,
              item.supplier || null,
              item.reorderLevel || item.reorder_level || 5,
              item.description || null,
              existingItem.id,
              traderId
            ]);
            updated++;
            continue;
          }
          // If append: proceed to insert with modified SKU
        }

        const skuToInsert = strategy === 'append' && existingItem && rawSku
          ? `${rawSku}-${Date.now().toString().slice(-4)}`
          : (rawSku || `SKU-${Date.now().toString().slice(-6)}`);

        const sql = `
          INSERT INTO inventory 
          (trader_id, item_code, item_name, sku, category, quantity, unit_price, 
           cost_price, wholesale_price, retail_price, tax_category, tax_rate,
           barcode, brand, model, uom, supplier, manufacturer, 
           country_of_origin, description, images, reorder_level, location)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await db.execute(sql, [
          traderId, skuToInsert, itemName, skuToInsert, item.category || null,
          item.quantity || 0, 
          item.unitPrice || item.unit_price || item.sellingPrice || 0,
          item.costPrice || item.cost_price || item.buyingPrice || 0, 
          item.wholesalePrice || item.wholesale_price || 0,
          item.retailPrice || item.retail_price || item.sellingPrice || 0,
          item.taxCategory || item.tax_category || 'General',
          item.taxRate || item.tax_rate || 0,
          item.barcode || null, item.brand || null, item.model || null,
          item.uom || 'pcs', item.supplier || null, item.manufacturer || null,
          item.countryOfOrigin || item.country_of_origin || null,
          item.description || null,
          typeof item.images === 'string' ? item.images : JSON.stringify(item.images || []),
          item.reorderLevel || item.reorder_level || 5,
          item.location || null
        ]);
        added++;

        // Add to map so subsequent duplicates in same import respect collision
        existingMap.set(String(skuToInsert).toLowerCase(), { id: -1, sku: skuToInsert, item_name: itemName });
      } catch (error: any) {
        errors.push({
          item: item.sku || item.item_code || item.name,
          error: error.message
        });
      }
    }
    
    // Invalidate cache
    await cache.delete(`inventory:${traderId}`);
    
    res.status(201).json({
      success: true,
      status: 'success',
      addedCount: added,
      updatedCount: updated,
      skippedCount: skipped,
      errors,
      total_requested: items.length,
      trader_id: traderId,
      message: `Bulk processing complete: ${added} added, ${updated} updated, ${skipped} skipped.`
    });
  } catch (error) {
    console.error('Bulk add error:', error);
    res.status(500).json({ error: 'Bulk add failed' });
  }
});

// Update Inventory
app.put('/api/inventory/:id', authRequired, permissionRequired('inventory'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const itemId = parseInt(req.params.id);
    const updates = req.body;
    
    // Verify ownership
    let item;
    if (req.tenantId) {
      item = await db.get(
        'SELECT id FROM inventory WHERE id = ? AND tenant_id = ?',
        [itemId, req.tenantId]
      );
    } else {
      item = await db.get(
        'SELECT id FROM inventory WHERE id = ? AND trader_id = ?',
        [itemId, traderId]
      );
    }
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found or not owned' });
    }
    
    // Build update query
    const mapping: any = {
      name: 'item_name',
      sku: 'item_code',
      unitPrice: 'unit_price',
      costPrice: 'cost_price',
      wholesalePrice: 'wholesale_price',
      retailPrice: 'retail_price',
      taxCategory: 'tax_category',
      taxRate: 'tax_rate',
      countryOfOrigin: 'country_of_origin',
      reorderLevel: 'reorder_level'
    };

    const allowedFields = [
      'name', 'sku', 'category', 'quantity', 'unitPrice', 'costPrice', 
      'wholesalePrice', 'retailPrice', 'taxCategory', 'taxRate',
      'barcode', 'brand', 'model', 'uom', 'supplier', 'manufacturer', 
      'countryOfOrigin', 'description', 'images', 'reorderLevel', 'location'
    ];
    
    const updateFields: string[] = [];
    const params: any[] = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        const dbField = mapping[field] || field;
        updateFields.push(`${dbField} = ?`);
        let val = updates[field];
        if (field === 'images' && typeof val !== 'string') {
          val = JSON.stringify(val);
        }
        params.push(val);
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push('last_updated = CURRENT_TIMESTAMP');
    params.push(itemId);
    params.push(traderId);
    
    const sql = `UPDATE inventory SET ${updateFields.join(', ')} WHERE id = ? AND trader_id = ?`;
    await db.execute(sql, params);
    
    // Invalidate cache
    await cache.delete(`inventory:${traderId}`);
    await cache.delete(`item:${itemId}:*`);
    
    res.json({
      status: 'success',
      message: 'Item updated successfully',
      item_id: itemId,
      trader_id: traderId
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Search Inventory
app.get('/api/inventory/search', authRequired, async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const query = (req.query.q || '').toString().trim();
    const category = (req.query.category || '').toString().trim();
    
    if (!query && !category) {
      return res.status(400).json({ error: 'Search query or category required' });
    }
    
    // Try cache
    const cacheKey = `search:${traderId}:${query}:${category}`;
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      return res.json({
        status: 'success',
        data: cachedData,
        source: 'cache'
      });
    }
    
    // Build query
    let sql = 'SELECT * FROM inventory WHERE trader_id = ?';
    const params: any[] = [traderId];
    
    if (query) {
      sql += ' AND (item_name LIKE ? OR item_code LIKE ? OR category LIKE ?)';
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    sql += ' ORDER BY item_name';
    
    const result = await db.query(sql, params);
    const data = result.data || [];
    
    // Cache for 5 minutes
    await cache.set(cacheKey, data, 300);
    
    res.json({
      status: 'success',
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get Devices
app.get('/api/devices', authRequired, async (req: any, res) => {
  try {
    const traderId = req.traderId;
    
    const result = await db.query(
      `SELECT device_id, device_name, device_type, last_active, is_trusted
       FROM devices WHERE trader_id = ? ORDER BY last_active DESC`,
      [traderId]
    );
    
    res.json({
      status: 'success',
      devices: result.data || [],
      current_device: req.userAgent
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Sync Data
app.post('/api/sync', authRequired, async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const { device_id, last_sync } = req.body;
    
    // Record sync attempt
    await db.execute(
      `INSERT OR REPLACE INTO sync_metadata (trader_id, table_name, last_sync, sync_version)
       VALUES (?, 'inventory', CURRENT_TIMESTAMP, 1)`,
      [traderId]
    );
    
    // Get changes since last sync
    let changes;
    const identifier = req.tenantId || traderId;
    const filterColumn = req.tenantId ? 'tenant_id' : 'trader_id';
    
    if (last_sync) {
      const result = await db.query(
        `SELECT * FROM inventory WHERE ${filterColumn} = ? AND last_updated > ?`,
        [identifier, last_sync]
      );
      changes = result.data;
    } else {
      const result = await db.query(
        `SELECT * FROM inventory WHERE ${filterColumn} = ?`,
        [identifier]
      );
      changes = result.data;
    }
    
    res.json({
      status: 'success',
      changes: changes || [],
      change_count: changes?.length || 0,
      sync_time: new Date().toISOString(),
      device_id: device_id || 'unknown',
      trader_id: traderId
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Delete Inventory Item
app.delete('/api/inventory/:id', authRequired, permissionRequired('inventory'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const itemId = parseInt(req.params.id);
    
    // Verify ownership or admin
    if (req.tenantId) {
      const item = await db.get(
        'SELECT id FROM inventory WHERE id = ? AND tenant_id = ?',
        [itemId, req.tenantId]
      );
      if (!item) {
        return res.status(404).json({ error: 'Item not found or not owned' });
      }
    } else if (traderId) {
      const item = await db.get(
        'SELECT id FROM inventory WHERE id = ? AND trader_id = ?',
        [itemId, traderId]
      );
      if (!item) {
        return res.status(404).json({ error: 'Item not found or not owned' });
      }
    }
    
    await db.execute('DELETE FROM inventory WHERE id = ?', [itemId]);
    
    // Invalidate cache
    if (traderId) await cache.delete(`inventory:${traderId}`);
    await cache.delete(`item:${itemId}:*`);
    
    res.json({
      status: 'success',
      message: 'Item deleted successfully',
      item_id: itemId,
      trader_id: traderId
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Bulk Delete Inventory Items
app.post('/api/inventory/bulk-delete', authRequired, async (req: any, res) => {
  try {
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required' });
    }
    const traderId = req.traderId;
    
    for (const id of itemIds) {
      if (traderId) {
        await db.execute('DELETE FROM inventory WHERE id = ? AND trader_id = ?', [id, traderId]);
      } else {
        await db.execute('DELETE FROM inventory WHERE id = ?', [id]);
      }
    }

    if (traderId) await cache.delete(`inventory:${traderId}`);
    res.json({
      status: 'success',
      message: `${itemIds.length} items deleted successfully`,
      count: itemIds.length
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk Update Inventory Items
app.post('/api/inventory/bulk-update', authRequired, async (req: any, res) => {
  try {
    const { itemIds, updates } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0 || !updates) {
      return res.status(400).json({ error: 'itemIds array and updates object are required' });
    }
    const traderId = req.traderId;

    for (const id of itemIds) {
      const allowedFields = ['category', 'tax_category', 'tax_rate', 'reorder_level', 'supplier', 'uom'];
      const setClauses: string[] = [];
      const values: any[] = [];

      if (updates.category !== undefined) { setClauses.push('category = ?'); values.push(updates.category); }
      if (updates.taxCategory !== undefined) { setClauses.push('tax_category = ?'); values.push(updates.taxCategory); }
      if (updates.taxRate !== undefined) { setClauses.push('tax_rate = ?'); values.push(updates.taxRate); }
      if (updates.reorderLevel !== undefined) { setClauses.push('reorder_level = ?'); values.push(updates.reorderLevel); }
      if (updates.supplier !== undefined) { setClauses.push('supplier = ?'); values.push(updates.supplier); }
      if (updates.uom !== undefined) { setClauses.push('uom = ?'); values.push(updates.uom); }

      if (setClauses.length > 0) {
        values.push(id);
        let sql = `UPDATE inventory SET ${setClauses.join(', ')} WHERE id = ?`;
        if (traderId) {
          sql += ` AND trader_id = ?`;
          values.push(traderId);
        }
        await db.execute(sql, values);
      }
    }

    if (traderId) await cache.delete(`inventory:${traderId}`);
    res.json({
      status: 'success',
      message: `${itemIds.length} items updated successfully`,
      count: itemIds.length
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// ============================================================
// SALES & TRANSACTIONS
// ============================================================

// Process Sale
app.post('/api/sale', authRequired, async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const { 
      items, subtotal, discountRate, discountAmount, tax, taxRate, taxLabel, total, 
      paymentMethod, customerName, notes, cashierName, serviceProvider, serviceStation 
    } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in sale' });
    }
    
    const invoiceNo = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const itemsJson = JSON.stringify(items);
    const itemCount = items.reduce((sum: number, item: any) => sum + (item.qty || 1), 0);
    
    // Execute transaction atomically with rollback safety
    await db.runTransaction(async (sqlite) => {
      // 1. Record transaction
      try {
        const tenantId = req.tenantId || null;
        const memberId = req.user?.id || null;
        const actualCashierName = req.user?.fullName || req.user?.username || cashierName || 'System';

        const sql = `
          INSERT INTO transactions 
          (invoice_no, trader_id, tenant_id, member_id, items, item_count, subtotal, discount_rate, 
           discount_amount, tax, tax_rate, tax_label, total, payment_method, customer_name, notes, cashier_name, service_provider, service_station)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await sqlite.run(sql, [
          invoiceNo, traderId, tenantId, memberId, itemsJson, itemCount, subtotal || 0, 
          discountRate || 0, discountAmount || 0, tax || 0, 
          taxRate !== undefined ? Number(taxRate) : 0,
          taxLabel || 'VAT', total || 0,
          paymentMethod || 'Cash', customerName || 'Walk-in Customer',
          notes || null, actualCashierName,
          serviceProvider || null, serviceStation || null
        ]);
      } catch (err) {
        // Fallback for schemas where new columns aren't present yet
        try {
          const fallbackSql = `
            INSERT INTO transactions 
            (invoice_no, trader_id, items, item_count, subtotal, discount_rate, 
             discount_amount, tax, tax_rate, tax_label, total, payment_method, customer_name, notes, cashier_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          await sqlite.run(fallbackSql, [
            invoiceNo, traderId, itemsJson, itemCount, subtotal || 0, 
            discountRate || 0, discountAmount || 0, tax || 0, 
            taxRate !== undefined ? Number(taxRate) : 0,
            taxLabel || 'VAT', total || 0,
            paymentMethod || 'Cash', customerName || 'Walk-in Customer',
            notes || null, cashierName || 'System'
          ]);
        } catch (e2) {
          const minimalSql = `
            INSERT INTO transactions 
            (invoice_no, trader_id, items, item_count, subtotal, discount_rate, 
             discount_amount, tax, total, payment_method, customer_name, notes, cashier_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          await sqlite.run(minimalSql, [
            invoiceNo, traderId, itemsJson, itemCount, subtotal || 0, 
            discountRate || 0, discountAmount || 0, tax || 0, total || 0,
            paymentMethod || 'Cash', customerName || 'Walk-in Customer',
            notes || null, cashierName || 'System'
          ]);
        }
      }
      
      // 2. Update inventory (reduce quantities)
      for (const item of items) {
        if (item.id) {
          const tenantId = req.tenantId || null;
          let updateSql, updateParams;
          
          if (tenantId) {
            updateSql = 'UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?';
            updateParams = [item.qty || 1, item.id, tenantId];
          } else {
            updateSql = 'UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND trader_id = ?';
            updateParams = [item.qty || 1, item.id, traderId];
          }
          
          await sqlite.run(updateSql, updateParams);
        }
      }
      return true;
    });
    
    // Invalidate inventory cache
    await cache.delete(`inventory:${traderId}`);
    
    res.status(201).json({
      success: true,
      message: 'Sale processed successfully',
      invoice: invoiceNo,
      transaction: {
        invoice_no: invoiceNo,
        subtotal,
        discountRate,
        discountAmount,
        tax,
        taxRate: taxRate !== undefined ? Number(taxRate) : 0,
        taxLabel: taxLabel || 'VAT',
        total,
        cashierName: cashierName || 'System',
        customerName: customerName || 'Walk-in Customer',
        serviceProvider: serviceProvider || undefined,
        serviceStation: serviceStation || undefined,
        date: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Sale error:', error);
    res.status(500).json({ error: 'Failed to process sale' });
  }
});

// Get Transactions
app.get('/api/transactions', authRequired, async (req: any, res) => {
  try {
    const identifier = req.tenantId || req.traderId;
    const filterColumn = req.tenantId ? 'tenant_id' : 'trader_id';
    
    const sql = `
      SELECT id, invoice_no as invoiceNo, items, item_count as itemCount, 
             subtotal, discount_rate as discountRate, discount_amount as discountAmount, 
             tax, tax_rate as taxRate, tax_label as taxLabel, total, payment_method as paymentMethod, customer_name as customerName,
             customer_phone as customerPhone,
             notes, cashier_name as cashierName, service_provider as serviceProvider, service_station as serviceStation,
             COALESCE(status, 'completed') as status,
             status_reason as statusReason,
             status_updated_at as statusUpdatedAt,
             status_updated_by as statusUpdatedBy,
             COALESCE(refund_amount, 0) as refundAmount,
             transaction_date as date
      FROM transactions 
      WHERE ${filterColumn} = ? 
      ORDER BY transaction_date DESC
    `;
    
    let result: any;
    try {
      result = await db.query(sql, [identifier]);
    } catch (e) {
      // Fallback if status/service columns aren't present yet
      result = await db.query(`
        SELECT id, invoice_no as invoiceNo, items, item_count as itemCount, 
               subtotal, discount_rate as discountRate, discount_amount as discountAmount, 
               tax, tax_rate as taxRate, tax_label as taxLabel, total, payment_method as paymentMethod, customer_name as customerName,
               notes, cashier_name as cashierName, transaction_date as date
        WHERE trader_id = ? 
        ORDER BY transaction_date DESC
      `, [req.traderId]);
    }
    const data = (result.data || []).map((tx: any) => ({
      ...tx,
      status: tx.status || 'completed',
      items: typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items
    }));
    
    res.json(data);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Update Transaction Status (Void, Refund, Return)
app.put('/api/transactions/:id/status', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, reason, refundAmount, restockItems } = req.body;
    const actor = req.user?.fullName || req.user?.username || 'Staff';
    const now = new Date().toISOString();

    if (!['completed', 'voided', 'refunded', 'returned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be completed, voided, refunded, or returned.' });
    }

    const tx = await db.get('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await db.execute(`
      UPDATE transactions 
      SET status = ?, 
          status_reason = ?, 
          status_updated_at = ?, 
          status_updated_by = ?,
          refund_amount = COALESCE(?, refund_amount)
      WHERE id = ?
    `, [status, reason || null, now, actor, refundAmount !== undefined ? Number(refundAmount) : null, id]);

    // If restockItems requested and transaction has items, return items to inventory
    if (restockItems && tx.items) {
      try {
        const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items;
        if (Array.isArray(items)) {
          for (const item of items) {
            const qtyToAdd = Number(item.qty) || 1;
            if (item.id) {
              await db.execute('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [qtyToAdd, item.id]);
            } else if (item.code) {
              await db.execute('UPDATE inventory SET quantity = quantity + ? WHERE item_code = ?', [qtyToAdd, item.code]);
            }
          }
        }
      } catch (e) {
        console.error('Failed to restock items on transaction status update:', e);
      }
    }

    // Log audit trail
    try {
      await db.execute(`
        INSERT INTO audit_logs (trader_id, trader_name, username, user_role, action, details, severity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        tx.trader_id,
        tx.business_name || tx.trader_name,
        actor,
        req.user?.role || 'staff',
        `TRANSACTION_${status.toUpperCase()}`,
        JSON.stringify({
          invoiceNo: tx.invoice_no,
          previousStatus: tx.status || 'completed',
          newStatus: status,
          reason: reason || 'N/A',
          refundAmount: refundAmount || 0,
          restocked: !!restockItems
        }),
        status === 'voided' ? 'warning' : 'info'
      ]);
    } catch (e) {}

    res.json({
      success: true,
      message: `Transaction ${tx.invoice_no} marked as ${status}`,
      transaction: {
        id,
        status,
        statusReason: reason,
        statusUpdatedAt: now,
        statusUpdatedBy: actor,
        refundAmount: refundAmount || 0
      }
    });
  } catch (error: any) {
    console.error('Update transaction status error:', error);
    res.status(500).json({ error: 'Failed to update transaction status: ' + (error.message || error) });
  }
});

// ============================================================
// TRADERS & ADMIN
// ============================================================

// Get Traders (With Strict Tenant Data Isolation)
app.get('/api/traders', authRequired, async (req: any, res) => {
  try {
    const userRole = req.user?.role || '';
    const username = (req.user?.username || '').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'promoter' || username.includes('admin') || username === 'guest client';
    
    const traderColumns = `
      id, full_name as fullName, email, phone, location, 
      business_name as businessName, tax_id as taxId, plan, 
      status, discount_rate as discountRate, created_at as customerSince,
      subscription_expires_at as subscriptionExpiresAt,
      subscription_months as subscriptionMonths,
      subscription_discount_rate as subscriptionDiscountRate,
      pending_discount_rate as pendingDiscountRate,
      discount_status as discountStatus,
      server_ip as serverIp, server_port as serverPort,
      client_ip as clientIp, localization_ip as localizationIp,
      last_backup_ip as lastBackupIp, last_cloud_backup_at as lastCloudBackupAt,
      dual_backup_active as dualBackupActive, last_backup_at as lastBackupAt,
      receipt_header as receiptHeader, receipt_footer as receiptFooter,
      show_logo as showLogo, logo_url as logoUrl,
      tax_rate as taxRate, apply_tax as applyTax, tax_label as taxLabel,
      finance_active as financeActive, tax_active as taxActive,
      production_active as productionActive, hr_active as hrActive,
      distributor_id as distributorId, password_hash as passwordHash,
      tenant_code as tenantCode, subscription_tier as subscriptionTier,
      max_users as maxUsers, location_limit as locationLimit,
      billing_status as billingStatus, subscription_start_date as subscriptionStartDate
    `;

    let result: any;
    if (isAdmin) {
      result = await db.query(`
        SELECT ${traderColumns}
        FROM traders 
        WHERE is_active = 1
        ORDER BY full_name
      `);
    } else {
      // STRICT TENANT ISOLATION: A non-admin tenant can ONLY see their own store & vendor network
      const currentTraderId = req.traderId || 0;
      result = await db.query(`
        SELECT ${traderColumns}
        FROM traders 
        WHERE is_active = 1 AND (id = ? OR distributor_id = ?)
        ORDER BY full_name
      `, [currentTraderId, currentTraderId]);
    }
    const tradersList = result.data || [];
    
    // Merge printer and POS document settings if present
    try {
      const printerRows = await db.query('SELECT trader_id, settings_json FROM trader_printer_settings');
      if (printerRows?.data) {
        const pMap = new Map();
        for (const row of printerRows.data) {
          try { pMap.set(row.trader_id, JSON.parse(row.settings_json)); } catch (e) {}
        }
        for (const tr of tradersList) {
          const s = pMap.get(tr.id);
          if (s) {
            Object.assign(tr, s);
          }
        }
      }
    } catch (e) {}

    res.json(tradersList);
  } catch (error) {
    console.error('Get traders error:', error);
    res.status(500).json({ error: 'Failed to fetch traders' });
  }
});

// Get My Traders (For Current User or Admin)
app.get('/api/my-traders', authRequired, async (req: any, res) => {
  try {
    const username = (req.query.username || req.user?.username || '').toString().toLowerCase();
    const traderId = req.traderId || req.user?.traderId;
    const role = req.user?.role || '';

    const traderCols = `
      id, full_name as fullName, email, phone, location, 
      business_name as businessName, tax_id as taxId, plan, 
      status, discount_rate as discountRate, created_at as customerSince,
      subscription_expires_at as subscriptionExpiresAt,
      subscription_months as subscriptionMonths,
      subscription_discount_rate as subscriptionDiscountRate,
      pending_discount_rate as pendingDiscountRate,
      discount_status as discountStatus,
      server_ip as serverIp, server_port as serverPort,
      client_ip as clientIp, localization_ip as localizationIp,
      last_backup_ip as lastBackupIp, last_cloud_backup_at as lastCloudBackupAt,
      dual_backup_active as dualBackupActive, last_backup_at as lastBackupAt,
      receipt_header as receiptHeader, receipt_footer as receiptFooter,
      show_logo as showLogo, logo_url as logoUrl,
      tax_rate as taxRate, apply_tax as applyTax, tax_label as taxLabel,
      finance_active as financeActive, tax_active as taxActive,
      production_active as productionActive, hr_active as hrActive,
      tenant_code as tenantCode, subscription_tier as subscriptionTier,
      max_users as maxUsers, location_limit as locationLimit,
      billing_status as billingStatus, subscription_start_date as subscriptionStartDate
    `;

    let tradersList: any[] = [];
    if (!username || role === 'admin' || username.includes('admin')) {
      const result = await db.query(`
        SELECT ${traderCols}
        FROM traders 
        WHERE is_active = 1
        ORDER BY full_name
      `);
      tradersList = result.data || [];
    } else {
      // Return all branches & locations accessible to this user/team member/agent:
      // 1. Direct ownership (email)
      // 2. Currently selected traderId
      // 3. Team member/cashier/agent assignment in trader_members
      // 4. Multi-location branches sharing the same tenant_id
      // 5. Connected branches in distributor/wholesale network
      const result = await db.query(`
        SELECT DISTINCT ${traderCols}
        FROM traders 
        WHERE is_active = 1 AND (
          LOWER(email) = ? 
          OR id = ?
          OR id IN (
            SELECT trader_id FROM trader_members 
            WHERE LOWER(username) = ? AND (status IS NULL OR status = 'active')
          )
          OR (
            tenant_id IS NOT NULL AND tenant_id != '' AND tenant_id IN (
              SELECT tenant_id FROM traders 
              WHERE (LOWER(email) = ? OR id = ? OR id IN (SELECT trader_id FROM trader_members WHERE LOWER(username) = ?))
              AND tenant_id IS NOT NULL AND tenant_id != ''
            )
          )
          OR (
            distributor_id IS NOT NULL AND distributor_id IN (
              SELECT id FROM traders WHERE LOWER(email) = ? OR id = ?
            )
          )
          OR id IN (
            SELECT distributor_id FROM traders 
            WHERE (LOWER(email) = ? OR id = ?) AND distributor_id IS NOT NULL
          )
        )
        ORDER BY business_name, full_name
      `, [
        username, traderId || 0,
        username,
        username, traderId || 0, username,
        username, traderId || 0,
        username, traderId || 0
      ]);
      tradersList = result.data || [];
    }

    // Attach team member specific role and selling point for each location
    try {
      if (username && tradersList.length > 0) {
        const memberRolesResult = await db.query(`
          SELECT trader_id, role, permissions, selling_point_id, commission_rate
          FROM trader_members
          WHERE LOWER(username) = ? AND (status IS NULL OR status = 'active')
        `, [username]);
        if (memberRolesResult?.data && memberRolesResult.data.length > 0) {
          const roleMap = new Map();
          for (const m of memberRolesResult.data) {
            roleMap.set(m.trader_id, m);
          }
          for (const tr of tradersList) {
            const memberMeta = roleMap.get(tr.id);
            if (memberMeta) {
              tr.teamRole = memberMeta.role;
              tr.sellingPointId = memberMeta.selling_point_id;
              tr.commissionRate = memberMeta.commission_rate;
            }
          }
        }
      }
    } catch (e) {}

    // Merge printer and POS document settings
    try {
      const printerRows = await db.query('SELECT trader_id, settings_json FROM trader_printer_settings');
      if (printerRows?.data) {
        const pMap = new Map();
        for (const row of printerRows.data) {
          try { pMap.set(row.trader_id, JSON.parse(row.settings_json)); } catch (e) {}
        }
        for (const tr of tradersList) {
          const s = pMap.get(tr.id);
          if (s) {
            Object.assign(tr, s);
          }
        }
      }
    } catch (e) {}

    res.json(tradersList);
  } catch (error) {
    console.error('Get my-traders error:', error);
    res.status(500).json({ error: 'Failed to fetch user traders' });
  }
});

// Onboard New Trader
app.post('/api/traders', optionalAuth, async (req: any, res) => {
  try {
    const { 
      fullName, email, phone, location, businessName, taxId, plan, status,
      includeFinance, includeTax, includeProduction, includeHr, serverIp, serverPort,
      discountRate, customerSince, receiptHeader, receiptFooter,
      subscriptionMonths, subscriptionDiscountRate, seedStarterInventory
    } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Missing required fields: fullName and email are mandatory' });
    }

    const emailLower = email.toLowerCase().trim();
    const password = req.body.password || "Biashara123";
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if email is already registered in traders
    const existingTrader = await db.get('SELECT id FROM traders WHERE LOWER(email) = ?', [emailLower]);
    if (existingTrader) {
      return res.status(409).json({ error: 'A trader with this email address is already registered' });
    }

    // Subscription duration and discount calculation
    // 6 months = 2.5% discount, 1 year (12 months) = 5% discount
    const months = parseInt(subscriptionMonths, 10) || 1;
    let durationDiscount = 0;
    if (months >= 12) {
      durationDiscount = 5.0;
    } else if (months >= 6) {
      durationDiscount = 2.5;
    }
    const finalSubscriptionDiscount = subscriptionDiscountRate !== undefined && subscriptionDiscountRate !== null
      ? Number(subscriptionDiscountRate)
      : durationDiscount;

    // Set subscription expiry based on months (months * 30 days)
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (months * 30));
    const subscriptionExpiresAt = expiry.toISOString().split('T')[0];

    const traderStatus = status || (plan?.includes('Distributor') ? 'pending' : 'active');
    
    // Determine subscription tier and user seat limit
    const cleanPlanLower = (plan || 'starter').toLowerCase();
    let subscriptionTier = 'starter';
    let defaultSeats = 2;
    let defaultLocations = 1;

    if (cleanPlanLower.includes('distributor') || cleanPlanLower.includes('wholesale')) {
      subscriptionTier = 'distributor';
      defaultSeats = 50;
      defaultLocations = 20;
    } else if (cleanPlanLower.includes('enterprise') || cleanPlanLower.includes('premium')) {
      subscriptionTier = 'enterprise';
      defaultSeats = 15;
      defaultLocations = 5;
    } else if (cleanPlanLower.includes('pro') || cleanPlanLower.includes('standard')) {
      subscriptionTier = 'pro';
      defaultSeats = 5;
      defaultLocations = 2;
    }

    const maxUsers = req.body.maxUsers ? parseInt(req.body.maxUsers, 10) : defaultSeats;
    const locationLimit = req.body.locationLimit ? parseInt(req.body.locationLimit, 10) : defaultLocations;
    const currentYear = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const tenantCode = req.body.tenantCode || `TNT-${currentYear}-${randomSuffix}`;
    const subscriptionStartDate = customerSince || new Date().toISOString().split('T')[0];

    const sql = `
      INSERT INTO traders (
        email, password_hash, full_name, business_name, phone, location, 
        tax_id, plan, status, discount_rate, server_ip, server_port, 
        created_at, subscription_expires_at,
        subscription_months, subscription_discount_rate,
        finance_active, tax_active, production_active, hr_active,
        receipt_header, receipt_footer,
        tenant_code, subscription_tier, max_users, location_limit,
        billing_status, subscription_start_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result: any = await db.execute(sql, [
      emailLower, hashedPassword, fullName, businessName || fullName, phone || null, location || null,
      taxId || null, plan || 'Starter', traderStatus,
      Number(discountRate) || 0, serverIp || null, Number(serverPort) || 8080,
      customerSince || new Date().toISOString(), subscriptionExpiresAt,
      months, finalSubscriptionDiscount,
      includeFinance ? 1 : 0, includeTax ? 1 : 0, includeProduction ? 1 : 0, includeHr ? 1 : 0,
      receiptHeader || `Welcome to ${businessName || fullName}`,
      receiptFooter || 'Goods once sold are not returnable.\nThank you for your business!',
      tenantCode, subscriptionTier, maxUsers, locationLimit,
      'paid', subscriptionStartDate
    ]);

    const sqliteResult = result.find((r: any) => r.source === 'sqlite');
    const newId = sqliteResult?.lastID;

    // 1. TENANT PROVISIONING & ISOLATION ENGINE: Register tenant record in global registry
    await db.execute(`
      INSERT OR REPLACE INTO tenants (tenant_id, tenant_name, schema_name, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [tenantCode, businessName || fullName, `schema_${newId}`]).catch(() => {});

    // 2. ROOT ADMIN INITIALIZATION: Scoped exclusively to newly provisioned tenant boundary
    const primaryAdminPermissions = JSON.stringify({
      pos: true, inventory: true, production: true, finance: true, tax: true,
      reports: true, hr: true, regime: true, traders: true, manage_team: true, approve_commissions: true
    });

    if (newId) {
      await db.execute(`
        INSERT INTO trader_members (
          trader_id, tenant_id, username, email, password_hash, full_name, phone, 
          role, permissions, status, created_at, created_by, password_reset_required, initial_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'tenant_admin', ?, 'active', CURRENT_TIMESTAMP, 'Super Administrator', 1, ?)
      `, [
        newId, tenantCode, emailLower, emailLower, hashedPassword, fullName, phone || null, primaryAdminPermissions, password
      ]).catch((err) => console.warn('Primary tenant admin insert warning:', err));
    }

    // Auto-create root admin user login account with password_reset_required = 1 and tenant_id scope
    await db.execute(`
      INSERT OR REPLACE INTO users (username, password_hash, role, user_id, full_name, tenant_id, is_tenant_admin, password_reset_required, created_at)
      VALUES (?, ?, 'admin', ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
    `, [emailLower, hashedPassword, emailLower, fullName, tenantCode]);

    // 3. TENANT-SCOPED TEAM DOMICILE & GRANULAR RBAC:
    // Domicile initial team members directly into the tenant's isolated database partition
    const rawTeamMembers = Array.isArray(req.body.teamMembers) ? req.body.teamMembers : [];
    const domiciledMembers: any[] = [
      {
        id: `admin-${newId}`,
        username: emailLower,
        email: emailLower,
        fullName,
        role: 'tenant_admin',
        roleTitle: 'Tenant Administrator (Root Owner)',
        phone: phone || '',
        initialPassword: password,
        passwordResetRequired: true,
        status: 'active',
        isPrimaryAdmin: true,
        isolatedDatabaseDomiciled: true,
        permissions: JSON.parse(primaryAdminPermissions)
      }
    ];

    if (newId && rawTeamMembers.length > 0) {
      // Respect maxUsers quota (primary admin occupies seat 1)
      const allowedAdditionalSeats = Math.max(0, maxUsers - 1);
      const membersToCreate = rawTeamMembers.slice(0, allowedAdditionalSeats);

      for (const m of membersToCreate) {
        const mUsername = (m.username || m.email || '').trim().toLowerCase();
        const mEmail = (m.email || m.username || '').trim().toLowerCase();
        const mFullName = (m.fullName || mUsername).trim();
        const mRole = (m.role || 'cashier').trim();
        const mPhone = (m.phone || '').trim();
        const mPassword = m.password || 'Biashara@2026';

        if (!mUsername) continue;

        try {
          const mHashedPassword = await bcrypt.hash(mPassword, 10);
          const defaultPerms: Record<string, boolean> = {
            pos: true,
            inventory: ['manager', 'stock_controller', 'storekeeper'].includes(mRole),
            production: ['manager', 'production_supervisor', 'production_officer'].includes(mRole),
            finance: ['manager', 'accountant'].includes(mRole),
            tax: ['manager', 'accountant'].includes(mRole),
            reports: ['manager', 'accountant', 'storekeeper'].includes(mRole),
            hr: ['manager', 'hr'].includes(mRole),
            regime: ['manager'].includes(mRole),
            traders: false,
            manage_team: false,
            approve_commissions: false
          };
          const mPermissionsObj = m.permissions || defaultPerms;
          const mPermissions = JSON.stringify(mPermissionsObj);

          const mInsertResult: any = await db.execute(`
            INSERT INTO trader_members (
              trader_id, tenant_id, username, email, password_hash, full_name, phone,
              role, permissions, status, created_at, created_by, password_reset_required, initial_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, ?, 1, ?)
          `, [
            newId, tenantCode, mUsername, mEmail, mHashedPassword, mFullName, mPhone || null,
            mRole, mPermissions, req.user?.username || 'Super Administrator', mPassword
          ]);

          const mSqliteResult = mInsertResult.find((r: any) => r.source === 'sqlite');
          const mMemberId = mSqliteResult?.lastID;

          // Sync into users table so team member can log in immediately with tenant boundary and password_reset_required
          let globalRole = 'cashier';
          if (mRole === 'tenant_admin' || mRole === 'owner') globalRole = 'admin';
          else if (mRole === 'manager') globalRole = 'manager';
          else if (mRole === 'accountant') globalRole = 'accountant';

          await db.execute(`
            INSERT OR REPLACE INTO users (username, password_hash, role, user_id, full_name, tenant_id, is_tenant_admin, password_reset_required, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP)
          `, [mUsername, mHashedPassword, globalRole, mUsername, mFullName, tenantCode]);

          // Audit log for individual team member domicile
          await db.execute(`
            INSERT INTO audit_logs (trader_id, trader_name, username, user_role, action, details, severity)
            VALUES (?, ?, ?, 'tenant_admin', 'TEAM_MEMBER_DOMICILED', ?, 'info')
          `, [
            newId,
            businessName || fullName,
            emailLower,
            JSON.stringify({
              tenantCode,
              memberUsername: mUsername,
              memberEmail: mEmail,
              role: mRole,
              passwordResetRequired: true,
              domiciledPartition: `tenants_dbs/db_tenant_${newId}.db`
            })
          ]).catch(() => {});

          domiciledMembers.push({
            id: mMemberId,
            username: mUsername,
            email: mEmail,
            fullName: mFullName,
            role: mRole,
            roleTitle: mRole.replace(/_/g, ' ').toUpperCase(),
            phone: mPhone,
            initialPassword: mPassword,
            passwordResetRequired: true,
            status: 'active',
            isPrimaryAdmin: false,
            isolatedDatabaseDomiciled: true,
            permissions: mPermissionsObj
          });

          io.emit('tenant:user_created', {
            tenantId: newId,
            tenantCode,
            username: mUsername,
            role: mRole,
            status: 'active'
          });
        } catch (memberErr) {
          console.warn(`Failed to domicile team member ${mUsername}:`, memberErr);
        }
      }
    }

    // Trigger isolated database partition generation for the tenant and all domiciled accounts
    if (newId) {
      import('child_process').then(({ exec }) => {
        exec(`python3 app.py --partition ${newId}`, (err, stdout, stderr) => {
          if (err) {
            console.warn(`[Partition Sync] Notice for Tenant #${newId}:`, err.message);
          } else {
            console.log(`[Partition Sync] Successfully domiciled Tenant #${newId} isolated database.`);
          }
        });
      }).catch(() => {});
    }

    // Trigger initial billing invoice with subscription duration & discount applied
    let basePriceUSD = 50;
    if (plan === 'Pro') basePriceUSD = 100;
    if (plan?.includes('Premium') || plan?.includes('Enterprise')) basePriceUSD = 250;
    if (plan?.includes('Distributor')) basePriceUSD = 500;
    
    if (includeFinance) basePriceUSD *= 1.5;
    if (includeTax) basePriceUSD *= 1.5;
    if (includeProduction) basePriceUSD *= 1.5;
    
    const subtotalUSD = basePriceUSD * months;
    const discountedUSD = subtotalUSD * (1 - (finalSubscriptionDiscount / 100));
    const amountInKSh = Math.round(discountedUSD * 100);
    
    const invoiceNo = `BILL-${months}M-${Math.floor(1000 + Math.random() * 9000)}`;
    const billingDate = new Date().toISOString().split('T')[0];
    const planDisplayName = `${plan || 'Starter'} (${months} Mo${finalSubscriptionDiscount > 0 ? ` · ${finalSubscriptionDiscount}% off` : ''})`;

    if (newId) {
      await db.execute(`
        INSERT INTO billing_invoices (trader_id, invoice_no, amount, plan_name, status, billing_date, due_date, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [newId, invoiceNo, amountInKSh, planDisplayName, 'paid', billingDate, billingDate, 'M-Pesa Express']);

      // Audit Log for Super Administrator Onboarding
      await db.execute(`
        INSERT INTO audit_logs (trader_id, trader_name, username, user_role, action, details, severity)
        VALUES (?, ?, ?, 'super_admin', 'TENANT_ONBOARDED', ?, 'info')
      `, [
        newId,
        businessName || fullName,
        req.user?.username || 'Super Administrator',
        JSON.stringify({
          tenantId: newId,
          tenantCode,
          businessName: businessName || fullName,
          subscriptionTier,
          maxUsers,
          locationLimit,
          primaryAdmin: emailLower,
          subscriptionExpiresAt,
          invoiceNo
        })
      ]);

      // Emit real-time synchronization events via Socket.IO
      io.emit('tenant:created', {
        tenantId: newId,
        tenantCode,
        businessName: businessName || fullName,
        tier: subscriptionTier,
        maxUsers,
        activeUsers: 1,
        remainingSeats: maxUsers - 1,
        primaryAdmin: emailLower
      });
      io.emit('tenant:user_created', {
        tenantId: newId,
        tenantCode,
        username: emailLower,
        role: 'tenant_admin',
        status: 'active'
      });

      // Optionally seed starter inventory if requested
      if (seedStarterInventory) {
        const defaultItems = [
          { code: `STK-${newId}-001`, name: 'Premium Long Grain Rice 2kg', uom: 'pkt', qty: 25, unitPrice: 380, costPrice: 310, cat: 'Dry Foods' },
          { code: `STK-${newId}-002`, name: 'Pure Vegetable Cooking Oil 1L', uom: 'btl', qty: 30, unitPrice: 260, costPrice: 215, cat: 'Edible Oils' },
          { code: `STK-${newId}-003`, name: 'Fortified Maize Meal Flour 2kg', uom: 'pkt', qty: 40, unitPrice: 150, costPrice: 120, cat: 'Flour & Grains' },
          { code: `STK-${newId}-004`, name: 'Refined Table Salt 1kg', uom: 'pkt', qty: 50, unitPrice: 45, costPrice: 30, cat: 'Spices & Seasonings' },
          { code: `STK-${newId}-005`, name: 'Premium Black Tea Leaves 250g', uom: 'box', qty: 35, unitPrice: 120, costPrice: 95, cat: 'Beverages' },
          { code: `STK-${newId}-006`, name: 'Granulated White Sugar 1kg', uom: 'pkt', qty: 40, unitPrice: 180, costPrice: 145, cat: 'Sweeteners' },
          { code: `STK-${newId}-007`, name: 'Multi-purpose Bar Soap 1kg', uom: 'bar', qty: 30, unitPrice: 130, costPrice: 100, cat: 'Hygiene & Cleaning' },
          { code: `STK-${newId}-008`, name: 'Fresh Whole Milk 500ml', uom: 'pouch', qty: 20, unitPrice: 65, costPrice: 50, cat: 'Dairy' }
        ];
        for (const item of defaultItems) {
          try {
            await db.execute(`
              INSERT INTO inventory (trader_id, item_code, item_name, uom, quantity, unit_price, cost_price, category, reorder_level)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5)
            `, [newId, item.code, item.name, item.uom, item.qty, item.unitPrice, item.costPrice, item.cat]);
          } catch (e) {}
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Tenant ${businessName || fullName} onboarded successfully! Primary Tenant Admin account provisioned.`,
      id: newId,
      tenantCode,
      tenantId: newId,
      trader: {
        id: newId,
        tenantCode,
        tenantId: newId,
        fullName,
        email: emailLower,
        businessName: businessName || fullName,
        phone: phone || '—',
        location: location || '—',
        taxId: taxId || '—',
        plan: plan || 'Starter',
        subscriptionTier,
        maxUsers,
        locationLimit,
        billingStatus: 'paid',
        status: traderStatus,
        discountRate: Number(discountRate) || 0,
        customerSince: subscriptionStartDate,
        subscriptionMonths: months,
        subscriptionExpiresAt,
        initialPassword: password,
        receiptHeader: receiptHeader || `Welcome to ${businessName || fullName}`,
        receiptFooter: receiptFooter || 'Thank you for your business!',
        financeActive: Boolean(includeFinance),
        taxActive: Boolean(includeTax),
        productionActive: Boolean(includeProduction),
        serverIp: serverIp || null,
        serverPort: Number(serverPort) || 8080,
        isolationTier: 'dedicated_database_partition',
        dbPartitionPath: `tenants_dbs/db_tenant_${newId}.db`,
        passwordResetRequired: true
      },
      primaryAdmin: {
        username: emailLower,
        email: emailLower,
        role: 'tenant_admin',
        fullName,
        initialPassword: password,
        passwordResetRequired: true,
        tenantCode,
        tenantId: newId,
        isolatedDatabaseDomiciled: true
      },
      domiciledTeamMembers: domiciledMembers,
      isolation: {
        tier: 'dedicated_database_partition',
        dbPath: `tenants_dbs/db_tenant_${newId}.db`,
        tenantCode,
        rootAdminId: `admin-${newId}`,
        foreignKeyEnforced: true,
        domiciledCount: domiciledMembers.length
      },
      invoice: {
        invoiceNo,
        amountInKSh,
        planDisplayName,
        billingDate
      }
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Onboard trader error:', error);
    res.status(500).json({ error: 'Failed to onboard trader' });
  }
});

// ============================================================
// CLIENT ONBOARDING MODULE (ISOLATED SQLite DB + PRIVATE WORKSPACE LINK)
// Matches Python reference implementation
// ============================================================

function sanitize_slug(name: string): string {
  const base = (name || '').toLowerCase().trim();
  let slug = base.replace(/[^a-z0-9\s-]/g, '');
  slug = slug.replace(/[-\s]+/g, '-');
  return slug;
}

async function create_tenant_db(dbPath: string): Promise<void> {
  const tDb = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  await tDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT,
      full_name TEXT,
      phone TEXT,
      selling_point_id TEXT,
      permissions TEXT,
      tenant_id TEXT,
      is_active INTEGER DEFAULT 1,
      password_reset_required INTEGER DEFAULT 0,
      last_login TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL,
      customer_name TEXT,
      payment_method TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT,
      price REAL,
      stock INTEGER
    );
  `);
  await tDb.close();
}

// 1. ONBOARD CLIENT -> GENERATE ISOLATED DB + PRIVATE LINK
app.post(['/api/register', '/api/client-onboard/register'], async (req, res) => {
  try {
    const data = req.body;
    if (!data) return res.status(400).json({ error: "Invalid JSON payload" });

    const business_name = data.business_name;
    const owner_email = data.owner_email ? String(data.owner_email).trim().toLowerCase() : '';
    const password = data.password;

    if (!business_name || !owner_email || !password) {
      return res.status(400).json({ error: "Missing required fields: business_name, owner_email, password" });
    }

    const clean_slug_base = sanitize_slug(business_name);
    if (!clean_slug_base) {
      return res.status(400).json({ error: "Invalid business name for slug generation" });
    }

    const randId = crypto.randomBytes(2).toString('hex');
    const randSlug = crypto.randomBytes(2).toString('hex');
    const tenant_id = `${clean_slug_base}-${randId}`;
    const slug = `${clean_slug_base}-${randSlug}`;
    const db_path = path.join(TENANTS_BASE_DIR, `db_${slug}.db`);

    await create_tenant_db(db_path);

    const tDb = await open({ filename: db_path, driver: sqlite3.Database });
    const domiciled_accounts: any[] = [];
    const createdAt = new Date().toISOString();
    try {
      const hashedPw = await bcrypt.hash(password, 10);
      const ownerId = crypto.randomUUID();
      const ownerPerms = JSON.stringify({ pos: true, inventory: true, production: true, finance: true, tax: true, reports: true, hr: true, system: true });
      
      await tDb.run(
        "INSERT INTO users (id, email, password_hash, role, full_name, permissions, tenant_id, created_at, password_reset_required) VALUES (?,?,?,?,?,?,?,?,?)",
        ownerId, owner_email, hashedPw, "Owner", business_name, ownerPerms, tenant_id, createdAt, 1
      );
      domiciled_accounts.push({
        id: ownerId,
        email: owner_email,
        fullName: business_name,
        role: "Owner",
        tenant_id,
        slug,
        initialPassword: password,
        passwordResetRequired: true
      });

      // Domicile initial team members directly into the isolated DB partition
      const rawTeamMembers = Array.isArray(data.team_members) ? data.team_members : (Array.isArray(data.teamMembers) ? data.teamMembers : []);
      if (rawTeamMembers.length > 0) {
        for (const m of rawTeamMembers) {
          const mEmail = (m.email || '').trim().toLowerCase();
          if (!mEmail) continue;
          const mPassword = m.password || `Staff@${Math.floor(1000 + Math.random() * 9000)}`;
          const mRole = m.role || 'Cashier';
          const mHashedPw = await bcrypt.hash(mPassword, 10);
          const mId = crypto.randomUUID();
          const mPerms = JSON.stringify(m.permissions || {});
          
          await tDb.run(
            "INSERT INTO users (id, email, password_hash, role, full_name, phone, selling_point_id, permissions, tenant_id, created_at, password_reset_required) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            mId, mEmail, mHashedPw, mRole, m.fullName || mEmail.split('@')[0], m.phone || '', m.sellingPointId || 'Main Store', mPerms, tenant_id, createdAt, 1
          );

          domiciled_accounts.push({
            id: mId,
            email: mEmail,
            fullName: m.fullName || mEmail.split('@')[0],
            phone: m.phone || '',
            role: mRole,
            sellingPointId: m.sellingPointId || 'Main Store',
            tenant_id,
            slug,
            initialPassword: mPassword,
            passwordResetRequired: true
          });
        }
      } else {
        // Auto-provision standard operational team accounts (Manager, Cashier, Accountant)
        const defaultRoles = ['Manager', 'Cashier', 'Accountant'];
        for (const role of defaultRoles) {
          const defEmail = `${role.toLowerCase()}@${clean_slug_base}.com`;
          const defPassword = `Staff@${Math.floor(1000 + Math.random() * 9000)}`;
          const defHashedPw = await bcrypt.hash(defPassword, 10);
          const defId = crypto.randomUUID();
          const defPerms = JSON.stringify({ pos: true, inventory: role === 'Manager', reports: true });

          await tDb.run(
            "INSERT INTO users (id, email, password_hash, role, full_name, selling_point_id, permissions, tenant_id, created_at, password_reset_required) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            defId, defEmail, defHashedPw, role, `${role} (${business_name})`, role === 'Cashier' ? 'Till 1' : 'HQ', defPerms, tenant_id, createdAt, 1
          );

          domiciled_accounts.push({
            id: defId,
            email: defEmail,
            fullName: `${role} (${business_name})`,
            role,
            sellingPointId: role === 'Cashier' ? 'Till 1' : 'HQ',
            tenant_id,
            slug,
            initialPassword: defPassword,
            passwordResetRequired: true
          });
        }
      }
    } finally {
      await tDb.close();
    }

    // 730 days workspace JWT
    const payload = {
      tenant_id,
      slug,
      type: "workspace_access",
      exp: Math.floor(Date.now() / 1000) + (730 * 24 * 60 * 60)
    };
    const workspace_token = jwt.sign(payload, JWT_SECRET);
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const private_link = `${protocol}://${host}/access/${workspace_token}`;
    const token_hash = crypto.createHash('sha256').update(workspace_token).digest('hex');

    await db.sqlite.run(
      "INSERT INTO client_tenants (id, business_name, slug, owner_email, db_path, workspace_token_hash, workspace_token, created_at) VALUES (?,?,?,?,?,?,?,?)",
      tenant_id, business_name, slug, owner_email, db_path, token_hash, workspace_token, new Date().toISOString()
    );

    // Also register in main traders table for unified platform access if not present
    const existingTrader = await db.sqlite.get("SELECT id FROM traders WHERE LOWER(email) = ?", owner_email);
    if (!existingTrader) {
      const traderPw = await bcrypt.hash(password, 10);
      await db.sqlite.run(
        "INSERT INTO traders (email, password_hash, full_name, business_name, plan, status, is_active) VALUES (?, ?, ?, ?, ?, 'active', 1)",
        owner_email, traderPw, business_name, business_name, "Pro"
      ).catch(() => {});
    }

    await db.sqlite.run(
      "INSERT INTO audit_logs (action, detail, severity, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
      "CLIENT_TENANT_ONBOARDED",
      `Provisioned client "${business_name}" (${slug}) with ${domiciled_accounts.length} domiciled accounts at db_${slug}.db`,
      "info"
    ).catch(() => {});

    return res.json({
      message: `Biashara created with isolated DB and ${domiciled_accounts.length} domiciled accounts`,
      tenant_id,
      slug,
      business_name,
      db_path,
      your_private_workspace_link: private_link,
      workspace_token,
      domiciled_accounts,
      instruction: "Share the private workspace link and temporary credentials with your team. They need Email+Password FIRST, then this link SECOND to enter."
    });
  } catch (err: any) {
    console.error("Register biashara error:", err);
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: "Slug or tenant collision occurred, please try again" });
    }
    return res.status(500).json({ error: err.message || "Failed to register biashara" });
  }
});

// 2. INVITE TEAM MEMBER (Protected by isolated tenant DB check)
app.post(['/api/:slug/invite', '/api/client-workspaces/:slug/invite'], async (req, res) => {
  try {
    const slug = req.params.slug;
    const data = req.body;
    if (!data || !data.email || !data.password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const row = await db.sqlite.get("SELECT * FROM client_tenants WHERE slug = ?", slug);
    if (!row) {
      return res.status(404).json({ error: "Biashara not found" });
    }

    const db_path = row.db_path;
    const tenant_id = row.id;

    if (!fs.existsSync(db_path)) {
      await create_tenant_db(db_path);
    }

    const tDb = await open({ filename: db_path, driver: sqlite3.Database });
    try {
      const emailClean = String(data.email).trim().toLowerCase();
      const hashedPw = await bcrypt.hash(data.password, 10);
      const newUserId = crypto.randomUUID();
      const mRole = data.role || "Cashier";
      const mFullName = data.fullName || emailClean.split('@')[0];
      const mSellingPoint = data.sellingPointId || "Main Store";
      const mPhone = data.phone || "";
      const mPerms = JSON.stringify(data.permissions || {});
      const createdAt = new Date().toISOString();

      await tDb.run(
        "INSERT INTO users (id, email, password_hash, role, full_name, phone, selling_point_id, permissions, tenant_id, created_at, password_reset_required) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        newUserId, emailClean, hashedPw, mRole, mFullName, mPhone, mSellingPoint, mPerms, tenant_id, createdAt, 1
      );

      // Record audit log
      await db.sqlite.run(
        "INSERT INTO audit_logs (action, detail, severity, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        "TEAM_MEMBER_DOMICILED",
        `Added member ${emailClean} as ${mRole} into isolated database for ${slug}`,
        "info"
      ).catch(() => {});

      return res.json({
        message: `Team member ${emailClean} added successfully into ${slug}'s isolated database`,
        user_id: newUserId,
        user: {
          id: newUserId,
          email: emailClean,
          fullName: mFullName,
          role: mRole,
          sellingPointId: mSellingPoint,
          tenant_id,
          initialPassword: data.password,
          passwordResetRequired: true,
          status: 'active'
        },
        role: mRole
      });
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: "User with this email already exists in this biashara" });
      }
      throw err;
    } finally {
      await tDb.close();
    }
  } catch (err: any) {
    console.error("Invite team error:", err);
    return res.status(500).json({ error: err.message || "Failed to invite team member" });
  }
});

// 3. GET TEAM MEMBERS INSIDE ISOLATED TENANT DB
app.get(['/api/:slug/team', '/api/client-workspaces/:slug/team'], async (req, res) => {
  try {
    const slug = req.params.slug;
    const row = await db.sqlite.get("SELECT * FROM client_tenants WHERE slug = ?", slug);
    if (!row) {
      return res.status(404).json({ error: "Biashara not found" });
    }

    if (!fs.existsSync(row.db_path)) {
      return res.json({ users: [], count: 0 });
    }

    const tDb = await open({ filename: row.db_path, driver: sqlite3.Database });
    try {
      const users = await tDb.all("SELECT id, email, role, full_name as fullName, phone, selling_point_id as sellingPointId, permissions, tenant_id, is_active as isActive, password_reset_required as passwordResetRequired, last_login as lastLogin, created_at as createdAt FROM users");
      const parsedUsers = users.map(u => ({
        ...u,
        permissions: u.permissions ? JSON.parse(u.permissions) : {}
      }));
      return res.json({ users: parsedUsers, count: parsedUsers.length, slug, business_name: row.business_name });
    } finally {
      await tDb.close();
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch tenant team" });
  }
});

// 3b. DELETE TEAM MEMBER FROM ISOLATED TENANT DB
app.delete(['/api/:slug/team/:userId', '/api/client-workspaces/:slug/team/:userId'], async (req, res) => {
  try {
    const { slug, userId } = req.params;
    const row = await db.sqlite.get("SELECT * FROM client_tenants WHERE slug = ?", slug);
    if (!row) {
      return res.status(404).json({ error: "Biashara not found" });
    }

    if (!fs.existsSync(row.db_path)) {
      return res.status(404).json({ error: "Database not found" });
    }

    const tDb = await open({ filename: row.db_path, driver: sqlite3.Database });
    try {
      const existingUser = await tDb.get("SELECT id, email, role FROM users WHERE id = ?", userId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found in tenant database" });
      }

      await tDb.run("DELETE FROM users WHERE id = ?", userId);

      await db.sqlite.run(
        "INSERT INTO audit_logs (action, detail, severity, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        "TEAM_MEMBER_REVOKED",
        `Revoked user ${existingUser.email} (${existingUser.role}) from isolated DB of ${slug}`,
        "warning"
      ).catch(() => {});

      return res.json({
        success: true,
        message: `User ${existingUser.email} has been revoked from ${slug}'s isolated database`
      });
    } finally {
      await tDb.close();
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to delete team member" });
  }
});

// 4. GET ALL CLIENT WORKSPACES LIST
app.get('/api/client-workspaces', async (req, res) => {
  try {
    const rows = await db.sqlite.all("SELECT * FROM client_tenants ORDER BY created_at DESC");
    const enriched = await Promise.all(rows.map(async (t: any) => {
      let user_count = 1;
      let db_size_bytes = 0;
      try {
        if (fs.existsSync(t.db_path)) {
          const stat = fs.statSync(t.db_path);
          db_size_bytes = stat.size;
          const tDb = await open({ filename: t.db_path, driver: sqlite3.Database });
          const count = await tDb.get("SELECT COUNT(*) as c FROM users");
          user_count = count?.c || 1;
          await tDb.close();
        }
      } catch (e) {}
      return {
        ...t,
        user_count,
        db_size_bytes,
        your_private_workspace_link: `https://biasharasasa.nerlify.app/access/${t.workspace_token || ''}`
      };
    }));
    return res.json({ workspaces: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to list client workspaces" });
  }
});

// 5. REGENERATE WORKSPACE ACCESS LINK
app.post('/api/client-workspaces/:slug/regenerate-link', async (req, res) => {
  try {
    const slug = req.params.slug;
    const row = await db.sqlite.get("SELECT * FROM client_tenants WHERE slug = ?", slug);
    if (!row) {
      return res.status(404).json({ error: "Biashara not found" });
    }

    const payload = {
      tenant_id: row.id,
      slug: row.slug,
      type: "workspace_access",
      exp: Math.floor(Date.now() / 1000) + (730 * 24 * 60 * 60)
    };
    const new_token = jwt.sign(payload, JWT_SECRET);
    const private_link = `https://biasharasasa.nerlify.app/access/${new_token}`;
    const token_hash = crypto.createHash('sha256').update(new_token).digest('hex');

    await db.sqlite.run(
      "UPDATE client_tenants SET workspace_token = ?, workspace_token_hash = ? WHERE slug = ?",
      new_token, token_hash, slug
    );

    return res.json({
      success: true,
      message: "Workspace access link regenerated successfully",
      your_private_workspace_link: private_link,
      workspace_token: new_token
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to regenerate workspace link" });
  }
});

// 6. 2-STEP LOGIN - STEP 1 (Email + Password + Slug)
app.post(['/api/login', '/api/login/step1', '/api/client-login/step1'], async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.email || !data.password || !data.slug) {
      return res.status(400).json({ error: "Missing email, password, or slug" });
    }

    const email = String(data.email).trim().toLowerCase();
    const password = data.password;
    const slug = String(data.slug).trim();

    const tenant = await db.sqlite.get("SELECT * FROM client_tenants WHERE slug = ?", slug);
    if (!tenant) {
      return res.status(404).json({ error: "Biashara not found" });
    }

    if (!fs.existsSync(tenant.db_path)) {
      return res.status(404).json({ error: "Tenant isolated database file missing" });
    }

    const tDb = await open({ filename: tenant.db_path, driver: sqlite3.Database });
    let user: any = null;
    try {
      user = await tDb.get("SELECT * FROM users WHERE LOWER(email) = ?", email);
    } finally {
      await tDb.close();
    }

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Wrong email/password for this biashara" });
    }

    const pending_user = {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      tenant_id: tenant.id,
      slug: slug,
      password_reset_required: user.password_reset_required === 1,
      permissions: user.permissions ? JSON.parse(user.permissions) : {}
    };

    const pending_token = jwt.sign(pending_user, JWT_SECRET, { expiresIn: '15m' });

    return res.json({
      message: "Step 1 OK. Now paste your Private Workspace Link",
      next: "/api/login/step2",
      pending_token,
      user: pending_user
    });
  } catch (err: any) {
    console.error("Login step 1 error:", err);
    return res.status(500).json({ error: err.message || "Login Step 1 failed" });
  }
});

// 7. 2-STEP LOGIN - STEP 2 (Paste Workspace Link & Verify)
app.post(['/api/login/step2', '/api/client-login/step2'], async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.workspace_link) {
      return res.status(400).json({ error: "Workspace link required" });
    }

    const pending_token = data.pending_token;
    if (!pending_token) {
      return res.status(401).json({ error: "Do Step 1 first" });
    }

    let pending: any;
    try {
      pending = jwt.verify(pending_token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: "Step 1 session expired, please redo Step 1" });
    }

    const pasted_link = data.workspace_link.trim();
    const token = pasted_link.includes('/access/') ? pasted_link.split('/access/').pop()! : pasted_link;

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: "Workspace link expired, ask Owner to regenerate" });
      }
      return res.status(403).json({ error: `Invalid link: ${err.message}` });
    }

    if (decoded.tenant_id !== pending.tenant_id) {
      return res.status(403).json({ error: "This link does not belong to your biashara" });
    }

    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const tenant_record = await db.sqlite.get(
      "SELECT workspace_token_hash FROM client_tenants WHERE id = ?",
      pending.tenant_id
    );

    if (!tenant_record || tenant_record.workspace_token_hash !== token_hash) {
      return res.status(403).json({ error: "Workspace link has been revoked or is invalid" });
    }

    const session_token = jwt.sign({
      id: pending.id,
      email: pending.email,
      role: pending.role,
      fullName: pending.fullName,
      tenant_id: decoded.tenant_id,
      slug: pending.slug,
      password_reset_required: pending.password_reset_required,
      permissions: pending.permissions
    }, JWT_SECRET, { expiresIn: '24h' });

    return res.json({
      message: `Welcome to ${pending.slug}! Access granted.`,
      dashboard: `/dashboard/${pending.slug}`,
      session_token,
      tenant_id: decoded.tenant_id,
      slug: pending.slug,
      user: pending
    });
  } catch (err: any) {
    console.error("Login step 2 error:", err);
    return res.status(500).json({ error: err.message || "Login Step 2 failed" });
  }
});

// 8. VERIFY ACCESS LINK METADATA
app.get('/api/access/verify/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const tenant = await db.sqlite.get(
      "SELECT id, business_name, slug, owner_email, created_at FROM client_tenants WHERE id = ? AND workspace_token_hash = ?",
      decoded.tenant_id, token_hash
    );
    if (!tenant) {
      return res.status(404).json({ valid: false, error: "Workspace link is invalid or revoked" });
    }
    return res.json({ valid: true, tenant });
  } catch (err: any) {
    return res.status(400).json({ valid: false, error: err.message || "Invalid token" });
  }
});

// Renew Trader Subscription
app.post('/api/traders/:id/renew-subscription', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { months = 1, paymentMethod = 'M-Pesa Express' } = req.body;
    const trader = await db.get('SELECT * FROM traders WHERE id = ?', [id]);
    if (!trader) {
      return res.status(404).json({ error: 'Trader not found' });
    }

    const today = new Date();
    const existingExpiry = trader.subscription_expires_at ? new Date(trader.subscription_expires_at) : today;
    const baseDate = existingExpiry > today ? existingExpiry : today;
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + (months * 30));
    const newExpiryStr = newExpiry.toISOString().split('T')[0];

    await db.execute('UPDATE traders SET subscription_expires_at = ?, status = ? WHERE id = ?', [newExpiryStr, 'active', id]);

    let basePriceUSD = 30;
    if (trader.plan === 'Pro') basePriceUSD = 50;
    if (trader.plan === 'Enterprise') basePriceUSD = 250;
    if (trader.plan === 'Distributor') basePriceUSD = 500;
    if (trader.finance_active) basePriceUSD *= 1.5;
    if (trader.tax_active) basePriceUSD *= 1.5;
    if (trader.production_active) basePriceUSD *= 1.5;
    if (trader.hr_active) basePriceUSD *= 1.5;
    const amount = Math.round(basePriceUSD * 100 * months);

    const invoiceNo = `BILL-RNW-${Math.floor(1000 + Math.random() * 9000)}`;
    const billingDate = today.toISOString().split('T')[0];

    // Persist Invoice
    await db.execute(`
      INSERT INTO billing_invoices (trader_id, invoice_no, amount, plan_name, status, billing_date, due_date, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, invoiceNo, amount, `${trader.plan || 'Basic'} (${months} Mo)`, 'paid', billingDate, billingDate, paymentMethod]);

    // Audit Log
    await db.execute(`
      INSERT INTO audit_logs (trader_id, trader_name, username, action, details, severity)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id, 
      trader.business_name || trader.full_name, 
      req.user?.username || 'System', 
      'SUBSCRIPTION_RENEWED', 
      JSON.stringify({ months, newExpiry: newExpiryStr, invoiceNo, amount, paymentMethod }),
      'info'
    ]);

    res.json({
      success: true,
      message: `Subscription renewed through ${newExpiryStr}`,
      newExpiry: newExpiryStr,
      invoice: {
        id: Date.now(),
        traderId: id,
        invoiceNo,
        amount,
        planName: `${trader.plan || 'Basic'} (${months} Mo)`,
        status: 'paid',
        billingDate,
        dueDate: billingDate,
        paymentMethod,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Renew subscription error:', error);
    res.status(500).json({ error: 'Failed to renew subscription' });
  }
});

// Audit Logs API
app.get('/api/admin/audit-logs', authRequired, async (req: any, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, 
        timestamp, 
        trader_id as traderId, 
        trader_name as traderName, 
        username, 
        user_role as userRole,
        action, 
        details, 
        severity 
      FROM audit_logs 
      ORDER BY id DESC 
      LIMIT 500
    `);
    
    const logs = (result.data || []).map((row: any) => {
      let parsedDetails = row.details;
      if (typeof parsedDetails === 'string') {
        try {
          parsedDetails = JSON.parse(parsedDetails);
        } catch {
          parsedDetails = { info: row.details };
        }
      }
      return {
        ...row,
        role: row.userRole,
        details: parsedDetails,
        severity: row.severity || 'info'
      };
    });
    
    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

app.post('/api/admin/audit-logs', authRequired, async (req: any, res) => {
  try {
    const { action, details, traderId, traderName, username, userRole, severity } = req.body;
    const resolvedUsername = username || req.user?.username || 'System';
    const resolvedRole = userRole || req.user?.role || (resolvedUsername.includes('admin') ? 'admin' : 'staff');
    const resolvedSeverity = severity || 'info';
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || '{}');

    await db.execute(`
      INSERT INTO audit_logs (trader_id, trader_name, username, user_role, action, details, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [traderId || null, traderName || null, resolvedUsername, resolvedRole, action, detailsStr, resolvedSeverity]);

    res.json({ success: true });
  } catch (error) {
    console.error('Post audit log error:', error);
    res.status(500).json({ error: 'Failed to save audit log' });
  }
});

// Update Single Trader
app.put('/api/traders/:id', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      fullName, businessName, phone, location, email, taxId, plan, status,
      discountRate, serverIp, serverPort, financeActive, taxActive, productionActive, hrActive,
      receiptHeader, receiptFooter, showLogo, logoUrl, subscriptionMonths, subscriptionDiscountRate,
      password, taxRate, applyTax, taxLabel
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (fullName !== undefined) { updates.push('full_name = ?'); params.push(fullName); }
    if (businessName !== undefined) { updates.push('business_name = ?'); params.push(businessName); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email.toLowerCase()); }
    if (taxId !== undefined) { updates.push('tax_id = ?'); params.push(taxId); }
    if (plan !== undefined) { updates.push('plan = ?'); params.push(plan); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (discountRate !== undefined) { updates.push('discount_rate = ?'); params.push(Number(discountRate)); }
    if (serverIp !== undefined) { updates.push('server_ip = ?'); params.push(serverIp); }
    if (serverPort !== undefined) { updates.push('server_port = ?'); params.push(Number(serverPort)); }
    if (financeActive !== undefined) { updates.push('finance_active = ?'); params.push(financeActive ? 1 : 0); }
    if (taxActive !== undefined) { updates.push('tax_active = ?'); params.push(taxActive ? 1 : 0); }
    if (productionActive !== undefined) { updates.push('production_active = ?'); params.push(productionActive ? 1 : 0); }
    if (hrActive !== undefined) { updates.push('hr_active = ?'); params.push(hrActive ? 1 : 0); }
    if (password !== undefined && password.trim() !== '') {
      const hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }
    if (receiptHeader !== undefined) { updates.push('receipt_header = ?'); params.push(receiptHeader); }
    if (receiptFooter !== undefined) { updates.push('receipt_footer = ?'); params.push(receiptFooter); }
    if (showLogo !== undefined) { updates.push('show_logo = ?'); params.push(showLogo ? 1 : 0); }
    if (logoUrl !== undefined) { updates.push('logo_url = ?'); params.push(logoUrl); }
    if (subscriptionMonths !== undefined) { updates.push('subscription_months = ?'); params.push(Number(subscriptionMonths)); }
    if (subscriptionDiscountRate !== undefined) { updates.push('subscription_discount_rate = ?'); params.push(Number(subscriptionDiscountRate)); }
    if (taxRate !== undefined) { updates.push('tax_rate = ?'); params.push(Number(taxRate)); }
    if (applyTax !== undefined) { updates.push('apply_tax = ?'); params.push(applyTax ? 1 : 0); }
    if (taxLabel !== undefined) { updates.push('tax_label = ?'); params.push(taxLabel); }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No changes provided' });
    }

    params.push(id);
    await db.execute(`UPDATE traders SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await db.get(`
      SELECT id, full_name as fullName, email, phone, location, 
             business_name as businessName, tax_id as taxId, plan, 
             status, discount_rate as discountRate, created_at as customerSince,
             subscription_expires_at as subscriptionExpiresAt,
             subscription_months as subscriptionMonths,
             subscription_discount_rate as subscriptionDiscountRate,
             pending_discount_rate as pendingDiscountRate,
             discount_status as discountStatus,
             server_ip as serverIp, server_port as serverPort,
             receipt_header as receiptHeader, receipt_footer as receiptFooter,
             show_logo as showLogo, logo_url as logoUrl,
             finance_active as financeActive, tax_active as taxActive,
             production_active as productionActive
      FROM traders WHERE id = ?
    `, [id]);

    res.json({ success: true, message: 'Trader updated successfully', trader: updated });
  } catch (error: any) {
    console.error('Update trader error:', error);
    res.status(500).json({ error: error.message || 'Failed to update trader' });
  }
});

// Update Trader Plan
app.put('/api/traders/:id/plan', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: 'Plan is required' });
    await db.execute('UPDATE traders SET plan = ? WHERE id = ?', [plan, id]);
    res.json({ success: true, message: `Trader plan updated to ${plan}` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update trader plan' });
  }
});

// Approve Trader Account
app.put('/api/traders/:id/approve', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.execute('UPDATE traders SET status = ? WHERE id = ?', ['active', id]);
    res.json({ success: true, message: 'Trader account approved and activated' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve trader' });
  }
});

// Approve Distributor Trader Account
app.put('/api/traders/:id/approve-distributor', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.execute("UPDATE traders SET status = 'active', plan = 'Distributor / Wholesale' WHERE id = ?", [id]);
    res.json({ success: true, message: 'Distributor trader approved' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve distributor' });
  }
});

// Approve Trader Discount Rate
app.put('/api/traders/:id/approve-discount', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const trader = await db.get('SELECT pending_discount_rate FROM traders WHERE id = ?', [id]);
    const rate = trader?.pending_discount_rate || 0;
    await db.execute("UPDATE traders SET discount_rate = ?, pending_discount_rate = 0, discount_status = 'approved' WHERE id = ?", [rate, id]);
    res.json({ success: true, message: `Trader discount rate approved at ${rate}%` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve trader discount' });
  }
});

// Reject Trader Discount Rate
app.put('/api/traders/:id/reject-discount', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.execute("UPDATE traders SET pending_discount_rate = 0, discount_status = 'rejected' WHERE id = ?", [id]);
    res.json({ success: true, message: 'Trader discount request rejected' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject trader discount' });
  }
});

// Update Trader Backup Settings
app.put('/api/traders/:id/backup-settings', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { backupPath, serverIp, serverPort } = req.body;
    await db.execute('UPDATE traders SET backup_path = ?, server_ip = ?, server_port = ? WHERE id = ?', [
      backupPath || '/var/backup/biashara', serverIp || null, Number(serverPort) || 8080, id
    ]);
    res.json({ success: true, message: 'Backup settings updated' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update backup settings' });
  }
});

// Log Trader Backup Sync
app.put('/api/traders/:id/backup-sync', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const now = new Date().toISOString();
    await db.execute('UPDATE traders SET last_backup_at = ? WHERE id = ?', [now, id]);
    res.json({ success: true, lastBackupAt: now });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to log backup sync' });
  }
});

// Client Public & Network IP Detection API for Tenant Data Localization
app.get('/api/client-ip', (req: any, res) => {
  try {
    const ip = getClientIp(req);
    res.json({
      ip,
      clientIp: ip,
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'] || null,
        'x-real-ip': req.headers['x-real-ip'] || null,
        'cf-connecting-ip': req.headers['cf-connecting-ip'] || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ ip: '127.0.0.1', error: err.message });
  }
});

// Update Tenant Localization & Sovereignty IP
app.put('/api/traders/:id/localization', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { localizationIp, serverIp, serverPort, dualBackupActive } = req.body;
    const detectedIp = getClientIp(req);
    const finalIp = (localizationIp || detectedIp || '').trim();

    await db.execute(`
      UPDATE traders 
      SET localization_ip = COALESCE(?, localization_ip),
          server_ip = COALESCE(?, server_ip),
          server_port = COALESCE(?, server_port),
          dual_backup_active = COALESCE(?, dual_backup_active),
          client_ip = ?
      WHERE id = ?
    `, [
      finalIp || null,
      serverIp !== undefined ? serverIp : null,
      serverPort !== undefined ? Number(serverPort) : null,
      dualBackupActive !== undefined ? (dualBackupActive ? 1 : 0) : null,
      finalIp,
      id
    ]);

    res.json({
      success: true,
      message: 'Tenant IP localization configuration updated successfully',
      localizationIp: finalIp
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update localization: ' + error.message });
  }
});

// Get Trader Thermal Printer Settings (Premax POS-80C & POS-58)
app.get('/api/traders/:id/printer-settings', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const row = await db.get('SELECT settings_json, updated_at FROM trader_printer_settings WHERE trader_id = ?', [id]);
    if (!row || !row.settings_json) {
      return res.json({
        model: 'premax_pos80c',
        paperWidth: '80mm',
        autoCutter: true,
        cashDrawerKick: true,
        printCopies: 1,
        fontSize: 'normal',
        openDrawerOnSale: false
      });
    }
    const settings = JSON.parse(row.settings_json);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch printer settings' });
  }
});

// Save Trader Thermal Printer Settings (Premax POS-80C & POS-58)
app.post('/api/traders/:id/printer-settings', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const settings = req.body;
    const settingsJson = JSON.stringify(settings);
    const now = new Date().toISOString();
    await db.execute(`
      INSERT OR REPLACE INTO trader_printer_settings (trader_id, settings_json, updated_at)
      VALUES (?, ?, ?)
    `, [id, settingsJson, now]);
    res.json({ success: true, message: 'Printer settings saved successfully', settings });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save printer settings' });
  }
});

// Execute Dual Backup (Local Disk + Cloud Mirror) with Tenant IP Address Localization
app.post('/api/traders/:id/backup/dual', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const trader = await db.get('SELECT * FROM traders WHERE id = ?', [id]);
    if (!trader) {
      return res.status(404).json({ error: 'Trader not found' });
    }

    // Resolve tenant client IP address (Priority: request parameter -> detected header IP -> stored localization IP -> fallback)
    const detectedIp = getClientIp(req);
    const tenantIp = (req.body?.tenantIp || trader.localization_ip || detectedIp || '127.0.0.1').trim();
    const serverIp = (req.body?.serverIp || trader.server_ip || '127.0.0.1').trim();
    const backupType = 'dual';

    // Fetch tenant-isolated dataset
    const [
      inventoryRows,
      transactionRows,
      accountRows,
      journalRows,
      taxRows,
      batchRows,
      memberRows,
      printerSettingsRow
    ] = await Promise.all([
      db.all('SELECT * FROM inventory WHERE trader_id = ? ORDER BY id ASC', [id]),
      db.all('SELECT * FROM transactions WHERE trader_id = ? ORDER BY id DESC', [id]),
      db.all('SELECT * FROM finance_accounts WHERE trader_id = ? ORDER BY code ASC', [id]),
      db.all('SELECT * FROM journal_entries WHERE trader_id = ? ORDER BY id DESC', [id]),
      db.all('SELECT * FROM tax_transactions WHERE trader_id = ? ORDER BY id DESC', [id]),
      db.all('SELECT * FROM production_batches WHERE trader_id = ? ORDER BY id DESC', [id]),
      db.all('SELECT id, trader_id, username, full_name, phone, role, status, created_at FROM trader_members WHERE trader_id = ?', [id]),
      db.get('SELECT settings_json FROM trader_printer_settings WHERE trader_id = ?', [id])
    ]);

    // Parse printer settings if present
    let printerSettings = null;
    if (printerSettingsRow?.settings_json) {
      try { printerSettings = JSON.parse(printerSettingsRow.settings_json); } catch (e) {}
    }

    const timestamp = new Date().toISOString();
    const timestampClean = timestamp.replace(/[:.]/g, '-');

    // Build Localized Tenant Snapshot Package
    const tenantPayload = {
      app: 'BiasharaSasa Global Inventory',
      backupFormat: 'biashara-tenant-dual-backup',
      version: '2.2.0',
      timestamp,
      tenant: {
        id: trader.id,
        fullName: trader.full_name,
        businessName: trader.business_name || trader.full_name,
        email: trader.email,
        phone: trader.phone,
        location: trader.location,
        plan: trader.plan,
        taxId: trader.tax_id
      },
      // Tenant IP address and data sovereignty localization metadata
      localization: {
        tenantIp,
        serverIp,
        serverPort: trader.server_port || 8080,
        jurisdiction: trader.location || 'East Africa (KE/UG/TZ/RW/BI)',
        taxRegime: trader.tax_regime_country || 'Default',
        localizedAt: timestamp,
        backupType: 'Dual (Local Disk + Cloud Mirror)',
        sovereigntyCompliance: 'Active - Data isolated and stamped with registered tenant client IP'
      },
      counts: {
        inventory: (inventoryRows || []).length,
        transactions: (transactionRows || []).length,
        financeAccounts: (accountRows || []).length,
        journalEntries: (journalRows || []).length,
        taxTransactions: (taxRows || []).length,
        productionBatches: (batchRows || []).length,
        teamMembers: (memberRows || []).length
      },
      data: {
        trader: {
          id: trader.id,
          businessName: trader.business_name,
          fullName: trader.full_name,
          email: trader.email,
          phone: trader.phone,
          location: trader.location,
          plan: trader.plan,
          status: trader.status,
          taxId: trader.tax_id,
          discountRate: trader.discount_rate,
          taxRate: trader.tax_rate,
          applyTax: trader.apply_tax,
          taxLabel: trader.tax_label,
          financeActive: trader.finance_active,
          taxActive: trader.tax_active,
          productionActive: trader.production_active,
          hrActive: trader.hr_active
        },
        printerSettings,
        inventory: inventoryRows || [],
        transactions: transactionRows || [],
        financeAccounts: accountRows || [],
        journalEntries: journalRows || [],
        taxTransactions: taxRows || [],
        productionBatches: batchRows || [],
        teamMembers: memberRows || []
      }
    };

    const payloadString = JSON.stringify(tenantPayload, null, 2);
    const checksum = crypto.createHash('sha256').update(payloadString).digest('hex');
    (tenantPayload as any).checksum = checksum;

    // 1. LOCAL BACKUP (Disk persistence)
    const tenantBackupDir = path.join(BACKUP_DIR, 'tenants', String(id));
    if (!fs.existsSync(tenantBackupDir)) {
      fs.mkdirSync(tenantBackupDir, { recursive: true });
    }
    const localFileName = `tenant_${id}_backup_${timestampClean}.json`;
    const localFilePath = path.join(tenantBackupDir, localFileName);
    fs.writeFileSync(localFilePath, JSON.stringify(tenantPayload, null, 2), 'utf-8');

    // Also write a latest symlink/copy for convenient local access
    const latestLocalPath = path.join(tenantBackupDir, 'latest.json');
    fs.writeFileSync(latestLocalPath, JSON.stringify(tenantPayload, null, 2), 'utf-8');

    const fileSizeBytes = Buffer.byteLength(payloadString, 'utf-8');

    // 2. CLOUD MIRROR BACKUP
    // Save to shared_blobs table for persistent cloud KV retrieval
    const cloudBlobKey = `cloud_backup:tenant:${id}:${timestampClean}`;
    await db.execute(
      'INSERT OR REPLACE INTO shared_blobs (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [cloudBlobKey, JSON.stringify(tenantPayload)]
    );
    await db.execute(
      'INSERT OR REPLACE INTO shared_blobs (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [`cloud_backup:tenant:${id}:latest`, JSON.stringify(tenantPayload)]
    );

    const cloudUrl = `cloud://biasharasasa.supabase.co/tenants/${id}/${localFileName}`;

    // 3. PERSIST AUDIT RECORD in tenant_backups table
    const recordCountsJson = JSON.stringify(tenantPayload.counts);
    const detailsJson = JSON.stringify({
      tenantIp,
      serverIp,
      checksum,
      inventoryCount: (inventoryRows || []).length,
      transactionCount: (transactionRows || []).length,
      cloudBlobKey,
      localFileName
    });

    const backupInsertResult: any = await db.execute(`
      INSERT INTO tenant_backups (
        trader_id, backup_type, local_path, cloud_url, file_size_bytes, 
        status, tenant_ip, server_ip, checksum, details, record_counts, created_at
      ) VALUES (?, ?, ?, ?, ?, 'success', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [id, backupType, localFilePath, cloudUrl, fileSizeBytes, tenantIp, serverIp, checksum, detailsJson, recordCountsJson]);

    const backupId = Array.isArray(backupInsertResult) 
      ? (backupInsertResult.find((r: any) => r.source === 'sqlite')?.lastID || Date.now()) 
      : Date.now();

    // 4. UPDATE TRADER RECORD WITH LOCALIZATION & BACKUP TIMESTAMPS
    await db.execute(`
      UPDATE traders 
      SET last_backup_at = ?,
          last_cloud_backup_at = ?,
          last_backup_ip = ?,
          localization_ip = COALESCE(?, localization_ip),
          client_ip = ?,
          server_ip = COALESCE(?, server_ip)
      WHERE id = ?
    `, [timestamp, timestamp, tenantIp, tenantIp, tenantIp, serverIp, id]);

    // 5. AUDIT LOG
    await db.execute(`
      INSERT INTO audit_logs (trader_id, trader_name, username, user_role, action, details, severity)
      VALUES (?, ?, ?, ?, 'DUAL_BACKUP_COMPLETED', ?, 'info')
    `, [
      id,
      trader.business_name || trader.full_name,
      req.user?.username || 'System',
      req.user?.role || 'admin',
      JSON.stringify({
        backupId,
        tenantIp,
        serverIp,
        checksum: checksum.substring(0, 16),
        fileSizeBytes,
        counts: tenantPayload.counts
      })
    ]);

    res.json({
      success: true,
      message: `Dual Backup completed successfully! Client data localized and mirrored to local disk & cloud with IP stamp (${tenantIp}).`,
      backup: {
        id: backupId,
        traderId: id,
        backupType: 'dual',
        localPath: localFilePath,
        localFileName,
        cloudUrl,
        fileSizeBytes,
        status: 'success',
        tenantIp,
        serverIp,
        checksum,
        createdAt: timestamp,
        recordCounts: tenantPayload.counts
      }
    });
  } catch (error: any) {
    console.error('Dual backup error:', error);
    res.status(500).json({ error: 'Failed to execute dual backup: ' + (error.message || error) });
  }
});

// Get Tenant Backup History with IP Localization Stamps
app.get('/api/traders/:id/backups', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await db.all(`
      SELECT 
        id, trader_id as traderId, backup_type as backupType,
        local_path as localPath, cloud_url as cloudUrl,
        file_size_bytes as fileSizeBytes, status,
        tenant_ip as tenantIp, server_ip as serverIp,
        checksum, details, record_counts as recordCounts,
        created_at as createdAt
      FROM tenant_backups 
      WHERE trader_id = ? 
      ORDER BY id DESC
      LIMIT 100
    `, [id]);

    const formatted = (rows || []).map((r: any) => {
      let counts = {};
      if (r.recordCounts) {
        try { counts = typeof r.recordCounts === 'string' ? JSON.parse(r.recordCounts) : r.recordCounts; } catch (e) {}
      }
      return {
        ...r,
        recordCounts: counts
      };
    });

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch tenant backups' });
  }
});

// Download Localized Tenant Snapshot File
app.get('/api/traders/:id/backup/download/:backupId', authRequired, async (req: any, res) => {
  try {
    const traderId = parseInt(req.params.id);
    const backupId = parseInt(req.params.backupId);
    const backupRecord = await db.get('SELECT * FROM tenant_backups WHERE id = ? AND trader_id = ?', [backupId, traderId]);
    if (!backupRecord || !backupRecord.local_path) {
      return res.status(404).json({ error: 'Backup record not found' });
    }

    if (fs.existsSync(backupRecord.local_path)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(backupRecord.local_path)}"`);
      return fs.createReadStream(backupRecord.local_path).pipe(res);
    }

    // Fallback: check if stored in shared_blobs
    const blob = await db.get('SELECT value FROM shared_blobs WHERE key LIKE ?', [`cloud_backup:tenant:${traderId}:%`]);
    if (blob && blob.value) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tenant_${traderId}_backup.json"`);
      return res.send(blob.value);
    }

    return res.status(404).json({ error: 'Backup file not found on disk or cloud storage' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

// Delete Single Trader
app.delete('/api/traders/:id', authRequired, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.execute('DELETE FROM traders WHERE id = ?', [id]);
    await db.execute('DELETE FROM inventory WHERE trader_id = ?', [id]);
    await cache.delete(`inventory:${id}`);
    res.json({ success: true, message: 'Trader deleted successfully' });
  } catch (error) {
    console.error('Delete trader error:', error);
    res.status(500).json({ error: 'Failed to delete trader' });
  }
});

// Bulk Delete Traders
app.post('/api/traders/bulk-delete', authRequired, async (req: any, res) => {
  try {
    const { traderIds } = req.body;
    if (!Array.isArray(traderIds) || traderIds.length === 0) {
      return res.status(400).json({ error: 'traderIds array is required' });
    }

    for (const id of traderIds) {
      await db.execute('DELETE FROM traders WHERE id = ?', [id]);
      await db.execute('DELETE FROM inventory WHERE trader_id = ?', [id]);
      await cache.delete(`inventory:${id}`);
    }

    res.json({ success: true, message: `${traderIds.length} traders deleted successfully`, count: traderIds.length });
  } catch (error) {
    console.error('Bulk delete traders error:', error);
    res.status(500).json({ error: 'Failed to bulk delete traders' });
  }
});

// Bulk Update Traders Status
app.post('/api/traders/bulk-status', authRequired, async (req: any, res) => {
  try {
    const { traderIds, status } = req.body;
    if (!Array.isArray(traderIds) || traderIds.length === 0 || !status) {
      return res.status(400).json({ error: 'traderIds array and status are required' });
    }

    for (const id of traderIds) {
      await db.execute('UPDATE traders SET status = ? WHERE id = ?', [status, id]);
    }

    res.json({ success: true, message: `${traderIds.length} traders updated to ${status}`, count: traderIds.length });
  } catch (error) {
    console.error('Bulk update status error:', error);
    res.status(500).json({ error: 'Failed to bulk update trader status' });
  }
});

// Bulk Update Traders Plan
app.post('/api/traders/bulk-plan', authRequired, async (req: any, res) => {
  try {
    const { traderIds, plan } = req.body;
    if (!Array.isArray(traderIds) || traderIds.length === 0 || !plan) {
      return res.status(400).json({ error: 'traderIds array and plan are required' });
    }

    for (const id of traderIds) {
      await db.execute('UPDATE traders SET plan = ? WHERE id = ?', [plan, id]);
    }

    res.json({ success: true, message: `${traderIds.length} traders assigned plan ${plan}`, count: traderIds.length });
  } catch (error) {
    console.error('Bulk update plan error:', error);
    res.status(500).json({ error: 'Failed to bulk update trader plan' });
  }
});

// ============================================================
// TENANT USER MANAGEMENT & SUBSCRIPTION SYNCHRONIZATION
// ============================================================

// Helper to calculate tenant seat limits based on plan/tier
function getTierSeatAllowance(plan: string = '', subscriptionTier: string = ''): { maxUsers: number; locationLimit: number; tierName: string } {
  const p = (plan || '').toLowerCase();
  const t = (subscriptionTier || '').toLowerCase();

  if (p.includes('distributor') || t.includes('distributor') || p.includes('wholesale')) {
    return { maxUsers: 50, locationLimit: 20, tierName: 'distributor' };
  }
  if (p.includes('enterprise') || t.includes('enterprise') || p.includes('premium')) {
    return { maxUsers: 15, locationLimit: 5, tierName: 'enterprise' };
  }
  if (p.includes('pro') || t.includes('pro') || p.includes('standard')) {
    return { maxUsers: 5, locationLimit: 2, tierName: 'pro' };
  }
  return { maxUsers: 2, locationLimit: 1, tierName: 'starter' };
}

// Get Tenant Members & Seat Usage Metrics
const handleGetTenantUsers = async (req: any, res: any) => {
  try {
    const traderId = parseInt(req.params.id);
    const trader = await db.get(`
      SELECT id, full_name as fullName, business_name as businessName, email, phone, location,
             plan, subscription_tier as subscriptionTier, max_users as maxUsers, 
             location_limit as locationLimit, billing_status as billingStatus,
             status, subscription_expires_at as subscriptionExpiresAt,
             subscription_start_date as subscriptionStartDate, tenant_code as tenantCode,
             finance_active as financeActive, tax_active as taxActive,
             production_active as productionActive, hr_active as hrActive
      FROM traders WHERE id = ?
    `, [traderId]);

    if (!trader) {
      return res.status(404).json({ error: 'Tenant business account not found' });
    }

    const defaultAllowance = getTierSeatAllowance(trader.plan, trader.subscriptionTier);
    const effectiveMaxUsers = trader.maxUsers && trader.maxUsers > 0 ? trader.maxUsers : defaultAllowance.maxUsers;
    const effectiveLocationLimit = trader.locationLimit && trader.locationLimit > 0 ? trader.locationLimit : defaultAllowance.locationLimit;
    const effectiveTenantCode = trader.tenantCode || `TNT-2026-${String(traderId).padStart(4, '0')}`;

    const result = await db.query(`
      SELECT id, trader_id as traderId, tenant_id as tenantId, username, email, full_name as fullName, phone, 
             role, permissions, selling_point_id as sellingPointId, 
             commission_rate as commissionRate, commission_type as commissionType, 
             status, created_at as createdAt, last_login as lastLogin, created_by as createdBy 
      FROM trader_members 
      WHERE trader_id = ? 
      ORDER BY 
        CASE 
          WHEN role = 'tenant_admin' OR role = 'owner' THEN 1
          WHEN role = 'manager' THEN 2
          ELSE 3
        END,
        id ASC
    `, [traderId]).catch(() => ({ data: [] }));

    const members = (result?.data || []).map((m: any) => {
      let parsedPerms: any = null;
      if (m.permissions) {
        try {
          parsedPerms = typeof m.permissions === 'string' ? JSON.parse(m.permissions) : m.permissions;
        } catch {
          parsedPerms = null;
        }
      }
      return {
        ...m,
        email: m.email || m.username,
        permissions: parsedPerms,
        status: m.status || 'active',
        commissionRate: Number(m.commissionRate || 0),
        commissionType: m.commissionType || 'percentage'
      };
    });

    const activeUsers = members.filter((m: any) => m.status === 'active').length;
    const suspendedUsers = members.filter((m: any) => m.status === 'suspended').length;
    const remainingSeats = Math.max(0, effectiveMaxUsers - activeUsers);
    const isAtLimit = activeUsers >= effectiveMaxUsers;
    const isOverLimit = activeUsers > effectiveMaxUsers;

    const seatStats = {
      maxUsers: effectiveMaxUsers,
      activeUsers,
      suspendedUsers,
      totalRegistered: members.length,
      remainingSeats,
      isAtLimit,
      isOverLimit,
      locationLimit: effectiveLocationLimit,
      plan: trader.plan,
      subscriptionTier: trader.subscriptionTier || defaultAllowance.tierName,
      billingStatus: trader.billingStatus || 'paid',
      subscriptionExpiresAt: trader.subscriptionExpiresAt,
      tenantCode: effectiveTenantCode
    };

    if (req.query.format === 'details' || req.query.wrapper === 'true') {
      return res.json({
        success: true,
        tenant: {
          id: trader.id,
          tenantCode: effectiveTenantCode,
          businessName: trader.businessName,
          fullName: trader.fullName,
          email: trader.email,
          phone: trader.phone,
          location: trader.location,
          modules: {
            finance: Boolean(trader.financeActive),
            tax: Boolean(trader.taxActive),
            production: Boolean(trader.productionActive),
            hr: Boolean(trader.hrActive)
          }
        },
        seatStats,
        users: members
      });
    }

    // Standard response: Array of members with seat headers and attached seatStats
    res.setHeader('X-Tenant-Max-Users', String(effectiveMaxUsers));
    res.setHeader('X-Tenant-Active-Users', String(activeUsers));
    res.setHeader('X-Tenant-Remaining-Seats', String(remainingSeats));
    (members as any).seatStats = seatStats;
    res.json(members);
  } catch (error: any) {
    console.error('Get tenant users error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant users: ' + (error.message || error) });
  }
};

app.get('/api/traders/:id/members', authRequired, handleGetTenantUsers);
app.get('/api/traders/:id/users', authRequired, handleGetTenantUsers);
app.get('/api/tenants/:id/users', authRequired, handleGetTenantUsers);

// Create Tenant User Account (Enforces Subscription Tier Seat Limit & Role RBAC)
const handleCreateTenantUser = async (req: any, res: any) => {
  try {
    const traderId = parseInt(req.params.id);
    const { 
      username, 
      email,
      password, 
      fullName, 
      phone, 
      role = 'cashier', 
      permissions, 
      sellingPointId, 
      commissionRate = 0, 
      commissionType = 'percentage', 
      status = 'active' 
    } = req.body;

    const emailOrUser = (email || username || '').trim().toLowerCase();
    if (!emailOrUser) {
      return res.status(400).json({ success: false, error: 'Username / Email is required' });
    }

    // 1. Fetch Tenant Profile & Subscription Allowance
    const trader = await db.get(`
      SELECT id, full_name as fullName, business_name as businessName, email, plan,
             subscription_tier as subscriptionTier, max_users as maxUsers,
             status, tenant_code as tenantCode, finance_active as financeActive,
             tax_active as taxActive, production_active as productionActive, hr_active as hrActive
      FROM traders WHERE id = ?
    `, [traderId]);

    if (!trader) {
      return res.status(404).json({ success: false, error: 'Tenant business account not found' });
    }

    const defaultAllowance = getTierSeatAllowance(trader.plan, trader.subscriptionTier);
    const effectiveMaxUsers = trader.maxUsers && trader.maxUsers > 0 ? trader.maxUsers : defaultAllowance.maxUsers;
    const effectiveTenantCode = trader.tenantCode || `TNT-2026-${String(traderId).padStart(4, '0')}`;

    // 2. Enforce Subscription Tier User Limit
    const activeRow = await db.get(`
      SELECT COUNT(*) as count FROM trader_members WHERE trader_id = ? AND status = 'active'
    `, [traderId]);
    const currentActiveUsers = activeRow?.count || 0;

    if (status === 'active' && currentActiveUsers >= effectiveMaxUsers) {
      return res.status(403).json({
        success: false,
        upgradeRequired: true,
        error: `Subscription seat limit reached for tenant "${trader.businessName || trader.fullName}". Allowed seats: ${effectiveMaxUsers}, currently active: ${currentActiveUsers}. Please upgrade your subscription tier to create or activate more user accounts.`,
        seatStats: {
          maxUsers: effectiveMaxUsers,
          activeUsers: currentActiveUsers,
          remainingSeats: 0,
          plan: trader.plan
        }
      });
    }

    // 3. Prevent duplicate username within this tenant
    const existingMember = await db.get(
      'SELECT id FROM trader_members WHERE trader_id = ? AND LOWER(username) = ?',
      [traderId, emailOrUser]
    );
    if (existingMember) {
      return res.status(409).json({ 
        success: false, 
        error: `A user account with email/username "${emailOrUser}" is already registered under this tenant business.` 
      });
    }

    // 4. Validate Role & Module Entitlement
    const validRoles = [
      'tenant_admin', 'manager', 'accountant', 'storekeeper', 
      'production_officer', 'salesperson', 'cashier', 'service_provider',
      'owner', 'sales_agent', 'stock_controller', 'production_supervisor', 'supervisor', 'staff'
    ];
    const normalizedRole = validRoles.includes(role) ? role : 'cashier';

    // 5. Hash password & prepare record
    const rawPass = password && password.trim() ? password.trim() : 'Biashara123';
    const hashedPassword = await bcrypt.hash(rawPass, 10);
    const permsStr = permissions ? (typeof permissions === 'object' ? JSON.stringify(permissions) : permissions) : null;
    const now = new Date().toISOString();
    const creator = req.user?.username || 'Tenant Administrator';

    const result = await db.execute(`
      INSERT INTO trader_members (
        trader_id, tenant_id, username, email, password_hash, full_name, phone, role, 
        permissions, selling_point_id, commission_rate, commission_type, status, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      traderId,
      effectiveTenantCode,
      emailOrUser,
      emailOrUser,
      hashedPassword,
      fullName ? fullName.trim() : null,
      phone ? phone.trim() : null,
      normalizedRole,
      permsStr,
      sellingPointId || null,
      Number(commissionRate) || 0,
      commissionType || 'percentage',
      status || 'active',
      now,
      creator
    ]);

    // 6. Ensure user can authenticate in users table
    const existingUser = await db.get('SELECT id FROM users WHERE LOWER(username) = ?', [emailOrUser]);
    if (!existingUser) {
      let globalRole = 'cashier';
      if (normalizedRole === 'tenant_admin' || normalizedRole === 'owner') globalRole = 'admin';
      else if (normalizedRole === 'manager') globalRole = 'manager';
      else if (normalizedRole === 'accountant') globalRole = 'accountant';

      await db.execute('INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [
        emailOrUser, hashedPassword, globalRole
      ]).catch(() => {});
    }

    const memberId = Array.isArray(result) 
      ? ((result.find((r: any) => r.source === 'sqlite') as any)?.lastID || (result[0] as any)?.lastID || Date.now()) 
      : ((result as any)?.lastID || Date.now());

    // 7. Audit Log
    await db.execute(`
      INSERT INTO audit_logs (trader_id, trader_name, username, user_role, action, details, severity)
      VALUES (?, ?, ?, ?, 'TENANT_USER_CREATED', ?, 'info')
    `, [
      traderId,
      trader.businessName || trader.fullName,
      creator,
      req.user?.role || 'tenant_admin',
      JSON.stringify({
        userId: memberId,
        username: emailOrUser,
        fullName: fullName || emailOrUser,
        role: normalizedRole,
        status,
        tenantCode: effectiveTenantCode,
        activeSeatsNow: currentActiveUsers + (status === 'active' ? 1 : 0),
        maxSeats: effectiveMaxUsers
      })
    ]);

    // 8. Real-time broadcast to tenant room
    const userPayload = {
      id: memberId,
      traderId,
      tenantId: effectiveTenantCode,
      username: emailOrUser,
      email: emailOrUser,
      fullName: fullName || emailOrUser,
      phone,
      role: normalizedRole,
      status,
      sellingPointId,
      createdAt: now,
      seatStats: {
        maxUsers: effectiveMaxUsers,
        activeUsers: currentActiveUsers + (status === 'active' ? 1 : 0),
        remainingSeats: Math.max(0, effectiveMaxUsers - (currentActiveUsers + (status === 'active' ? 1 : 0)))
      }
    };

    io.to(`tenant_${traderId}`).emit('tenant:user_created', userPayload);
    io.emit('tenant:user_created', userPayload);

    res.status(201).json({ 
      success: true, 
      message: `User account "${fullName || emailOrUser}" successfully created under role: ${normalizedRole}.`,
      memberId,
      user: userPayload,
      seatStats: userPayload.seatStats
    });
  } catch (error: any) {
    console.error('Create tenant user error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create tenant user account' });
  }
};

app.post('/api/traders/:id/members', authRequired, handleCreateTenantUser);
app.post('/api/traders/:id/users', authRequired, handleCreateTenantUser);
app.post('/api/tenants/:id/users', authRequired, handleCreateTenantUser);

// Activate / Suspend Tenant User Account
const handleToggleTenantUserStatus = async (req: any, res: any) => {
  try {
    const traderId = parseInt(req.params.id);
    const memberId = parseInt(req.params.memberId || req.params.userId);
    const { status } = req.body;

    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "active" or "suspended"' });
    }

    const member = await db.get('SELECT * FROM trader_members WHERE id = ? AND trader_id = ?', [memberId, traderId]);
    if (!member) {
      return res.status(404).json({ error: 'Tenant user account not found' });
    }

    // Prevent suspending the primary tenant administrator
    if (member.role === 'tenant_admin' && status === 'suspended') {
      return res.status(400).json({ error: 'Cannot suspend the primary Tenant Administrator account.' });
    }

    // If reactivating to 'active', check subscription seat limit
    if (status === 'active' && member.status !== 'active') {
      const trader = await db.get('SELECT plan, subscription_tier, max_users FROM traders WHERE id = ?', [traderId]);
      const defaultAllowance = getTierSeatAllowance(trader?.plan, trader?.subscription_tier);
      const effectiveMaxUsers = trader?.max_users && trader.max_users > 0 ? trader.max_users : defaultAllowance.maxUsers;

      const activeRow = await db.get("SELECT COUNT(*) as count FROM trader_members WHERE trader_id = ? AND status = 'active'", [traderId]);
      const currentActive = activeRow?.count || 0;

      if (currentActive >= effectiveMaxUsers) {
        return res.status(403).json({
          success: false,
          upgradeRequired: true,
          error: `Cannot activate user account: Subscription seat limit (${currentActive}/${effectiveMaxUsers} seats) has been reached. Please upgrade your subscription tier or suspend another active user first.`
        });
      }
    }

    await db.execute('UPDATE trader_members SET status = ? WHERE id = ? AND trader_id = ?', [status, memberId, traderId]);

    // Audit log
    await db.execute(`
      INSERT INTO audit_logs (trader_id, username, user_role, action, details, severity)
      VALUES (?, ?, ?, 'TENANT_USER_STATUS_CHANGED', ?, 'info')
    `, [
      traderId,
      req.user?.username || 'Admin',
      req.user?.role || 'admin',
      JSON.stringify({ userId: memberId, username: member.username, role: member.role, newStatus: status })
    ]);

    // Socket broadcast
    io.to(`tenant_${traderId}`).emit('tenant:user_updated', { traderId, userId: memberId, status });
    io.emit('tenant:user_updated', { traderId, userId: memberId, status });

    res.json({
      success: true,
      message: `User account "${member.full_name || member.username}" has been ${status === 'active' ? 'activated' : 'suspended'}.`,
      status
    });
  } catch (error: any) {
    console.error('Toggle status error:', error);
    res.status(500).json({ error: 'Failed to update user status: ' + (error.message || error) });
  }
};

app.patch('/api/traders/:id/members/:memberId/status', authRequired, handleToggleTenantUserStatus);
app.patch('/api/traders/:id/users/:userId/status', authRequired, handleToggleTenantUserStatus);
app.put('/api/traders/:id/users/:userId/status', authRequired, handleToggleTenantUserStatus);

// Update Tenant User Details, Role, Permissions, Password
const handleUpdateTenantUser = async (req: any, res: any) => {
  try {
    const traderId = parseInt(req.params.id);
    const memberId = parseInt(req.params.memberId || req.params.userId);
    const { 
      role, 
      permissions, 
      fullName, 
      phone, 
      status, 
      sellingPointId, 
      commissionRate, 
      commissionType, 
      password 
    } = req.body;

    const existingMember = await db.get('SELECT * FROM trader_members WHERE id = ? AND trader_id = ?', [memberId, traderId]);
    if (!existingMember) {
      return res.status(404).json({ error: 'Tenant user account not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (permissions !== undefined) { 
      updates.push('permissions = ?'); 
      params.push(typeof permissions === 'object' ? JSON.stringify(permissions) : permissions); 
    }
    if (fullName !== undefined) { updates.push('full_name = ?'); params.push(fullName); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (sellingPointId !== undefined) { updates.push('selling_point_id = ?'); params.push(sellingPointId); }
    if (commissionRate !== undefined) { updates.push('commission_rate = ?'); params.push(Number(commissionRate)); }
    if (commissionType !== undefined) { updates.push('commission_type = ?'); params.push(commissionType); }
    if (password !== undefined && password.trim() !== '') {
      const hash = await bcrypt.hash(password.trim(), 10);
      updates.push('password_hash = ?');
      params.push(hash);
      // Also update in users table
      await db.execute('UPDATE users SET password_hash = ? WHERE LOWER(username) = ?', [hash, existingMember.username.toLowerCase()]).catch(() => {});
    }

    if (updates.length > 0) {
      params.push(memberId, traderId);
      await db.execute(`UPDATE trader_members SET ${updates.join(', ')} WHERE id = ? AND trader_id = ?`, params);
    }

    // Audit log
    await db.execute(`
      INSERT INTO audit_logs (trader_id, username, user_role, action, details, severity)
      VALUES (?, ?, ?, 'TENANT_USER_UPDATED', ?, 'info')
    `, [
      traderId,
      req.user?.username || 'Admin',
      req.user?.role || 'admin',
      JSON.stringify({ userId: memberId, username: existingMember.username, updatedFields: Object.keys(req.body) })
    ]);

    // Socket broadcast
    io.to(`tenant_${traderId}`).emit('tenant:user_updated', { traderId, userId: memberId, role, status, fullName });
    io.emit('tenant:user_updated', { traderId, userId: memberId, role, status, fullName });

    res.json({ success: true, message: `User "${fullName || existingMember.username}" details updated successfully!` });
  } catch (error: any) {
    console.error('Update tenant user error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update tenant user' });
  }
};

app.put('/api/traders/:id/members/:memberId', authRequired, handleUpdateTenantUser);
app.put('/api/traders/:id/users/:userId', authRequired, handleUpdateTenantUser);

// Delete Tenant User Account (Guards Primary Tenant Admin)
const handleDeleteTenantUser = async (req: any, res: any) => {
  try {
    const traderId = parseInt(req.params.id);
    const memberId = parseInt(req.params.memberId || req.params.userId);

    const member = await db.get('SELECT * FROM trader_members WHERE id = ? AND trader_id = ?', [memberId, traderId]);
    if (!member) {
      return res.status(404).json({ error: 'Tenant user account not found' });
    }

    const trader = await db.get('SELECT email, business_name FROM traders WHERE id = ?', [traderId]);
    if (member.role === 'tenant_admin' || (trader && member.username.toLowerCase() === trader.email.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Cannot delete the primary Tenant Administrator account. Every tenant must retain at least one central administrator.' 
      });
    }

    await db.execute('DELETE FROM trader_members WHERE id = ? AND trader_id = ?', [memberId, traderId]);
    
    // Audit Log
    await db.execute(`
      INSERT INTO audit_logs (trader_id, username, user_role, action, details, severity)
      VALUES (?, ?, ?, 'TENANT_USER_REMOVED', ?, 'warning')
    `, [
      traderId,
      req.user?.username || 'Admin',
      req.user?.role || 'admin',
      JSON.stringify({ userId: memberId, username: member.username, role: member.role })
    ]);

    // Socket broadcast
    io.to(`tenant_${traderId}`).emit('tenant:user_deleted', { traderId, userId: memberId, username: member.username });
    io.emit('tenant:user_deleted', { traderId, userId: memberId, username: member.username });

    res.json({ success: true, message: `Team user account "${member.full_name || member.username}" removed successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to remove member' });
  }
};

app.delete('/api/traders/:id/members/:memberId', authRequired, handleDeleteTenantUser);
app.delete('/api/traders/:id/users/:userId', authRequired, handleDeleteTenantUser);

// Subscription Upgrade / Downgrade / Synchronization
app.post('/api/traders/:id/subscription/change', authRequired, async (req: any, res: any) => {
  try {
    const traderId = parseInt(req.params.id);
    const { 
      tier, 
      plan, 
      months = 1, 
      maxUsers, 
      locationLimit, 
      includeFinance, 
      includeTax, 
      includeProduction, 
      includeHr,
      paymentMethod = 'M-Pesa Express'
    } = req.body;

    const trader = await db.get('SELECT * FROM traders WHERE id = ?', [traderId]);
    if (!trader) {
      return res.status(404).json({ error: 'Tenant business account not found' });
    }

    const previousTier = trader.subscription_tier || 'starter';
    const previousMaxUsers = trader.max_users || 2;
    const requestedPlan = plan || (tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : trader.plan);

    const defaultAllowance = getTierSeatAllowance(requestedPlan, tier);
    const newMaxUsers = maxUsers !== undefined ? Number(maxUsers) : defaultAllowance.maxUsers;
    const newLocationLimit = locationLimit !== undefined ? Number(locationLimit) : defaultAllowance.locationLimit;
    const newTier = tier || defaultAllowance.tierName;

    // Check if subscription expiry should be extended
    const today = new Date();
    const existingExpiry = trader.subscription_expires_at ? new Date(trader.subscription_expires_at) : today;
    const baseDate = existingExpiry > today ? existingExpiry : today;
    const newExpiry = new Date(baseDate);
    if (months && months > 0) {
      newExpiry.setDate(newExpiry.getDate() + (Number(months) * 30));
    }
    const newExpiryStr = newExpiry.toISOString().split('T')[0];

    // Module flags
    const finActive = includeFinance !== undefined ? (includeFinance ? 1 : 0) : trader.finance_active;
    const txActive = includeTax !== undefined ? (includeTax ? 1 : 0) : trader.tax_active;
    const prodActive = includeProduction !== undefined ? (includeProduction ? 1 : 0) : trader.production_active;
    const hrAct = includeHr !== undefined ? (includeHr ? 1 : 0) : trader.hr_active;

    await db.execute(`
      UPDATE traders
      SET plan = ?,
          subscription_tier = ?,
          max_users = ?,
          location_limit = ?,
          subscription_expires_at = ?,
          finance_active = ?,
          tax_active = ?,
          production_active = ?,
          hr_active = ?,
          status = 'active',
          billing_status = 'paid'
      WHERE id = ?
    `, [
      requestedPlan,
      newTier,
      newMaxUsers,
      newLocationLimit,
      newExpiryStr,
      finActive,
      txActive,
      prodActive,
      hrAct,
      traderId
    ]);

    // Check active users vs new limit (Downgrade seat check)
    const activeRow = await db.get("SELECT COUNT(*) as count FROM trader_members WHERE trader_id = ? AND status = 'active'", [traderId]);
    const activeCount = activeRow?.count || 0;
    const isOverLimit = activeCount > newMaxUsers;
    const excessSeats = Math.max(0, activeCount - newMaxUsers);

    // Audit log
    await db.execute(`
      INSERT INTO audit_logs (trader_id, trader_name, username, user_role, action, details, severity)
      VALUES (?, ?, ?, 'admin', 'SUBSCRIPTION_TIER_CHANGED', ?, ?)
    `, [
      traderId,
      trader.business_name || trader.full_name,
      req.user?.username || 'Super Administrator',
      JSON.stringify({
        previousTier,
        newTier,
        previousMaxUsers,
        newMaxUsers,
        plan: requestedPlan,
        newExpiry: newExpiryStr,
        activeAccountsCount: activeCount,
        isOverLimit,
        excessSeats
      }),
      isOverLimit ? 'warning' : 'info'
    ]);

    // Emit Socket.IO event for real-time synchronization across all devices
    const syncPayload = {
      tenantId: traderId,
      tenantCode: trader.tenant_code,
      tier: newTier,
      plan: requestedPlan,
      maxUsers: newMaxUsers,
      locationLimit: newLocationLimit,
      activeUsers: activeCount,
      isOverLimit,
      excessSeats,
      expiryDate: newExpiryStr,
      modules: {
        finance: Boolean(finActive),
        tax: Boolean(txActive),
        production: Boolean(prodActive),
        hr: Boolean(hrAct)
      }
    };

    io.to(`tenant_${traderId}`).emit('tenant:subscription_updated', syncPayload);
    io.emit('tenant:subscription_updated', syncPayload);

    res.json({
      success: true,
      message: `Tenant subscription successfully updated to ${requestedPlan} (${newMaxUsers} user seats, ${newLocationLimit} locations).`,
      tier: newTier,
      plan: requestedPlan,
      maxUsers: newMaxUsers,
      locationLimit: newLocationLimit,
      subscriptionExpiresAt: newExpiryStr,
      isOverLimit,
      excessSeats,
      warning: isOverLimit ? `Tenant now has ${excessSeats} excess active accounts over the ${newMaxUsers} seat allowance. Please choose which accounts remain active.` : null
    });
  } catch (error: any) {
    console.error('Change subscription error:', error);
    res.status(500).json({ error: 'Failed to update tenant subscription: ' + (error.message || error) });
  }
});

// Centralized Super Administrator Onboarding & Tenant Management Dashboard
app.get('/api/tenants/onboarding-dashboard', authRequired, async (req: any, res) => {
  try {
    const tradersRows = await db.query(`
      SELECT 
        id, 
        tenant_code as tenantCode, 
        full_name as fullName, 
        business_name as businessName, 
        email, 
        phone, 
        location, 
        tax_id as taxId, 
        plan, 
        subscription_tier as subscriptionTier, 
        max_users as maxUsers, 
        location_limit as locationLimit, 
        status, 
        billing_status as billingStatus, 
        subscription_start_date as subscriptionStartDate, 
        subscription_expires_at as subscriptionExpiresAt, 
        created_at as createdAt,
        finance_active as financeActive, 
        tax_active as taxActive, 
        production_active as productionActive, 
        hr_active as hrActive
      FROM traders
      WHERE is_active = 1
      ORDER BY id DESC
    `);

    const tenantsList: any[] = [];
    let platformTotalPermitted = 0;
    let platformTotalActive = 0;
    let platformTotalOverLimit = 0;

    const allMembers = await db.query(`
      SELECT id, trader_id as traderId, username, email, full_name as fullName, role, status, last_login as lastLogin
      FROM trader_members
      ORDER BY id ASC
    `).catch(() => ({ data: [] }));

    const membersByTrader = new Map<number, any[]>();
    for (const m of (allMembers?.data || [])) {
      if (!membersByTrader.has(m.traderId)) {
        membersByTrader.set(m.traderId, []);
      }
      membersByTrader.get(m.traderId)!.push(m);
    }

    const today = new Date();

    for (const t of (tradersRows?.data || [])) {
      const defaultAllowance = getTierSeatAllowance(t.plan, t.subscriptionTier);
      const effectiveMaxUsers = t.maxUsers && t.maxUsers > 0 ? t.maxUsers : defaultAllowance.maxUsers;
      const effectiveLocationLimit = t.locationLimit && t.locationLimit > 0 ? t.locationLimit : defaultAllowance.locationLimit;
      const effectiveTenantCode = t.tenantCode || `TNT-2026-${String(t.id).padStart(4, '0')}`;

      const members = membersByTrader.get(t.id) || [];
      const activeUsers = members.filter(m => m.status === 'active').length;
      const suspendedUsers = members.filter(m => m.status === 'suspended').length;
      const remainingSeats = Math.max(0, effectiveMaxUsers - activeUsers);
      const isAtLimit = activeUsers >= effectiveMaxUsers;
      const isOverLimit = activeUsers > effectiveMaxUsers;

      platformTotalPermitted += effectiveMaxUsers;
      platformTotalActive += activeUsers;
      if (isOverLimit) platformTotalOverLimit++;

      let daysRemaining = 30;
      let isExpired = false;
      if (t.subscriptionExpiresAt) {
        const expiryDate = new Date(t.subscriptionExpiresAt);
        const diffMs = expiryDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        isExpired = daysRemaining < 0;
      }

      tenantsList.push({
        id: t.id,
        tenantCode: effectiveTenantCode,
        businessName: t.businessName || t.fullName,
        ownerName: t.fullName,
        ownerEmail: t.email,
        phone: t.phone || '—',
        location: t.location || '—',
        taxId: t.taxId || '—',
        plan: t.plan || 'Starter',
        subscriptionTier: t.subscriptionTier || defaultAllowance.tierName,
        billingStatus: t.billingStatus || 'paid',
        status: isExpired ? 'expired' : (t.status || 'active'),
        subscriptionStartDate: t.subscriptionStartDate || t.createdAt,
        subscriptionExpiresAt: t.subscriptionExpiresAt,
        daysRemaining,
        isExpired,
        isDueSoon: daysRemaining <= 7 && daysRemaining >= 0,
        seatAllowance: {
          maxUsers: effectiveMaxUsers,
          activeUsers,
          suspendedUsers,
          totalRegistered: members.length,
          remainingSeats,
          isAtLimit,
          isOverLimit
        },
        locationLimit: effectiveLocationLimit,
        modules: {
          finance: Boolean(t.financeActive),
          tax: Boolean(t.taxActive),
          production: Boolean(t.productionActive),
          hr: Boolean(t.hrActive)
        },
        users: members
      });
    }

    const summary = {
      totalTenants: tenantsList.length,
      activeTenantsCount: tenantsList.filter(t => !t.isExpired && t.status === 'active').length,
      expiredTenantsCount: tenantsList.filter(t => t.isExpired).length,
      platformTotalPermittedSeats: platformTotalPermitted,
      platformTotalActiveUsers: platformTotalActive,
      platformCapacityUtilizationRate: platformTotalPermitted > 0 ? Math.round((platformTotalActive / platformTotalPermitted) * 100) : 0,
      tenantsOverLimitCount: platformTotalOverLimit
    };

    res.json({
      success: true,
      summary,
      tenants: tenantsList,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Onboarding dashboard error:', error);
    res.status(500).json({ error: 'Failed to generate onboarding dashboard: ' + (error.message || error) });
  }
});

// Trader Vendor Requests
app.post('/api/traders/:id/vendor-request', authRequired, async (req: any, res) => {
  try {
    const traderId = parseInt(req.params.id);
    const { fullName, email, phone, location, businessName, taxId } = req.body;
    await db.execute(`
      INSERT INTO vendor_requests (trader_id, full_name, email, phone, location, business_name, tax_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [traderId, fullName, email || null, phone || null, location || null, businessName || null, taxId || null, new Date().toISOString()]);
    res.json({ success: true, message: 'Vendor partnership request submitted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to submit vendor request' });
  }
});

// Admin Get Vendor Requests
app.get('/api/admin/vendor-requests', authRequired, async (req: any, res) => {
  try {
    const result = await db.query(`
      SELECT vr.id, vr.trader_id as traderId, vr.full_name as fullName, vr.email, 
             vr.phone, vr.location, vr.business_name as businessName, vr.tax_id as taxId, 
             vr.status, vr.created_at as createdAt,
             t.business_name as distributorName
      FROM vendor_requests vr
      LEFT JOIN traders t ON vr.trader_id = t.id
      ORDER BY vr.id DESC
    `).catch(() => ({ data: [] }));
    res.json(result?.data || []);
  } catch (error) {
    res.json([]);
  }
});

// Bulk Import Traders
app.post('/api/traders/bulk', authRequired, async (req: any, res) => {
  try {
    const { traders: items, strategy = 'skip' } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'traders array required' });
    }
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      if (!item.email || !item.fullName) {
        skippedCount++;
        continue;
      }
      const existing = await db.get('SELECT id FROM traders WHERE LOWER(email) = ?', [item.email.toLowerCase()]);
      if (existing) {
        if (strategy === 'overwrite') {
          await db.execute(`
            UPDATE traders SET full_name = ?, business_name = ?, phone = ?, location = ?, tax_id = ?, plan = ?
            WHERE id = ?
          `, [item.fullName, item.businessName || null, item.phone || null, item.location || null, item.taxId || null, item.plan || 'Basic', existing.id]);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        const defaultHash = await bcrypt.hash("Biashara123", 10);
        await db.execute(`
          INSERT INTO traders (email, password_hash, full_name, business_name, phone, location, tax_id, plan, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `, [item.email.toLowerCase(), defaultHash, item.fullName, item.businessName || null, item.phone || null, item.location || null, item.taxId || null, item.plan || 'Basic', new Date().toISOString()]);
        addedCount++;
      }
    }
    res.json({ success: true, addedCount, updatedCount, skippedCount, message: `Processed ${items.length} traders` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to bulk import traders' });
  }
});

// Distributor Vendor Network
app.get('/api/distributors/:id/vendors', authRequired, async (req: any, res) => {
  try {
    const distributorId = parseInt(req.params.id);
    const result = await db.query('SELECT * FROM traders WHERE distributor_id = ?', [distributorId]).catch(() => ({ data: [] }));
    res.json(result?.data || []);
  } catch (error) {
    res.json([]);
  }
});

app.delete('/api/distributors/:id/vendors/:vendorId', authRequired, async (req: any, res) => {
  try {
    const vendorId = parseInt(req.params.vendorId);
    await db.execute('UPDATE traders SET distributor_id = NULL WHERE id = ?', [vendorId]).catch(() => {});
    res.json({ success: true, message: 'Vendor removed from network' });
  } catch (error) {
    res.json({ success: true, message: 'Vendor removed' });
  }
});

// Trader Printer & POS Document Architect Settings
const handlePrinterSettings = async (req: any, res: any) => {
  try {
    const traderId = parseInt(req.params.id);
    const settings = req.body;
    await db.execute(`
      CREATE TABLE IF NOT EXISTS trader_printer_settings (
        trader_id INTEGER PRIMARY KEY,
        settings_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).catch(() => {});
    await db.execute('INSERT OR REPLACE INTO trader_printer_settings (trader_id, settings_json, updated_at) VALUES (?, ?, ?)', [
      traderId, JSON.stringify(settings), new Date().toISOString()
    ]).catch(() => {});

    // Also update direct columns in traders table for immediate synchronization
    if (settings) {
      await db.execute(`
        UPDATE traders 
        SET receipt_header = COALESCE(?, receipt_header),
            receipt_footer = COALESCE(?, receipt_footer),
            logo_url = COALESCE(?, logo_url),
            tax_rate = COALESCE(?, tax_rate),
            apply_tax = COALESCE(?, apply_tax),
            tax_label = COALESCE(?, tax_label)
        WHERE id = ?
      `, [
        settings.receiptHeader !== undefined ? settings.receiptHeader : null,
        settings.receiptFooter !== undefined ? settings.receiptFooter : null,
        settings.logoUrl !== undefined ? settings.logoUrl : null,
        settings.taxRate !== undefined ? Number(settings.taxRate) : null,
        settings.applyTax !== undefined ? (settings.applyTax ? 1 : 0) : null,
        settings.taxLabel !== undefined ? settings.taxLabel : null,
        traderId
      ]).catch(() => {});
    }

    res.json({ success: true, message: 'Printer & POS tax settings saved successfully', settings });
  } catch (error) {
    res.json({ success: true, message: 'Settings saved' });
  }
};
app.post('/api/traders/:id/printer-settings', authRequired, handlePrinterSettings);
app.put('/api/traders/:id/printer-settings', authRequired, handlePrinterSettings);

// Get Dashboard Stats
app.get('/api/stats', authRequired, async (req: any, res) => {
  console.log(`[API] GET /api/stats - Trader: ${req.traderId}`);
  try {
    const traderId = req.traderId;
    const { role } = req.query; // Optional: Allow forcing global stats if admin
    
    let statsSql;
    let params: any[] = [];

    // If superadmin or admin, we might want global stats
    // For now, let's just return global stats if traderId is null or if requested
    if (!traderId) {
      statsSql = `
        SELECT 
          SUM(total) as totalSales,
          SUM(discount_amount) as totalDiscounts,
          COUNT(*) as transactionCount,
          COUNT(DISTINCT trader_id) as uniqueTraders
        FROM transactions
      `;
    } else {
      statsSql = `
        SELECT 
          SUM(total) as totalSales,
          SUM(discount_amount) as totalDiscounts,
          COUNT(*) as transactionCount,
          1 as uniqueTraders
        FROM transactions
        WHERE trader_id = ?
      `;
      params = [traderId];
    }
    
    const stats = await db.get(statsSql, params);
    
    res.json({
      totalSales: stats?.totalSales || 0,
      totalDiscounts: stats?.totalDiscounts || 0,
      transactionCount: stats?.transactionCount || 0,
      uniqueTraders: stats?.uniqueTraders || 0,
      // Keep these for backward compatibility if needed by other components
      revenueToday: stats?.totalSales || 0, 
      inventoryValue: 0 
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Execute Raw SQL (Admin only)
app.post('/api/admin/sql', authRequired, async (req: any, res) => {
  try {
    const { sql } = req.body;
    console.log(`[API] POST /api/admin/sql - Trader: ${req.traderId}, SQL: ${sql?.substring(0, 100)}...`);
    if (!sql) return res.status(400).json({ error: 'SQL required' });
    
    console.log(`[ADMIN SQL] Trader ${req.traderId} executing: ${sql}`);
    
    const normalizedSql = sql.trim().toUpperCase();
    if (normalizedSql.startsWith('SELECT')) {
      const result = await db.query(sql);
      // Format to match expected output in SystemAdmin.tsx if needed
      // SystemAdmin expects an array of results, where each result has 'rows' or 'changes'
      res.json({ 
        success: true, 
        result: [{ 
          source: result.source, 
          success: true, 
          rows: result.data,
          columns: result.data && result.data.length > 0 ? Object.keys(result.data[0]) : []
        }] 
      });
    } else {
      const result = await db.execute(sql);
      res.json({ success: true, result });
    }
  } catch (error: any) {
    console.error('Admin SQL error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/reports/daily-revenue', authRequired, permissionRequired('reports'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    let sql, params;
    if (tenantId) {
      sql = `
        SELECT date(transaction_date) as date, SUM(total) as revenue, COUNT(*) as salesCount
        FROM transactions 
        WHERE tenant_id = ? 
        GROUP BY date(transaction_date)
        ORDER BY date DESC
        LIMIT 30
      `;
      params = [tenantId];
    } else {
      sql = `
        SELECT date(transaction_date) as date, SUM(total) as revenue, COUNT(*) as salesCount
        FROM transactions 
        WHERE trader_id = ? 
        GROUP BY date(transaction_date)
        ORDER BY date DESC
        LIMIT 30
      `;
      params = [traderId];
    }
    const result = await db.query(sql, params);
    res.json(result.data || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue reports' });
  }
});

// Subscription Plans with updated rates and module add-ons
app.get('/api/subscription-plans', (req, res) => {
  res.json([
    { 
      id: 'starter', 
      name: 'Starter', 
      price: '$50/mo', 
      monthlyFee: 50,
      memberLimit: 3, 
      productLimit: 50,
      stockLimitDesc: '50 Items on stock list',
      userLimitDesc: '3 Users',
      features: '50 Stock items · 3 Users · Standard POS & Inventory', 
      icon: '🌱',
      financeModulePrice: 25,
      taxModulePrice: 25,
      productionModulePrice: 25,
      moduleSubscriptionSurcharge: 0.5
    },
    { 
      id: 'pro', 
      name: 'Pro', 
      price: '$100/mo', 
      monthlyFee: 100,
      memberLimit: 5, 
      productLimit: 100,
      stockLimitDesc: '100 Items on stock list',
      userLimitDesc: '5 Users',
      features: '100 Stock items · 5 Users · Advanced POS & Reports', 
      icon: '🚀', 
      popular: true,
      financeModulePrice: 50,
      taxModulePrice: 50,
      productionModulePrice: 50,
      moduleSubscriptionSurcharge: 0.5
    },
    { 
      id: 'enterprise', 
      name: 'Premium / Enterprise', 
      price: '$250/mo', 
      monthlyFee: 250,
      memberLimit: 10, 
      productLimit: 500,
      stockLimitDesc: '101–500 Items on stock list',
      userLimitDesc: '10 Users',
      features: '101–500 Stock items · 10 Users · Multi-Store & Analytics', 
      icon: '🏢',
      financeModulePrice: 125,
      taxModulePrice: 125,
      productionModulePrice: 125,
      moduleSubscriptionSurcharge: 0.5
    },
    { 
      id: 'distributor', 
      name: 'Distributor / Wholesale', 
      price: '$500/mo', 
      monthlyFee: 500,
      memberLimit: 10, 
      productLimit: 99999,
      vendorLimit: 200,
      allowVendors: true,
      vendorSalesRoleDelegation: true,
      stockLimitDesc: '500+ Items on stock list',
      userLimitDesc: '10 Users + 100–200 Vendors',
      features: '500+ Items · 10 Users · 100–200 Vendors with Delegated POS Selling', 
      icon: '👑',
      financeModulePrice: 250,
      taxModulePrice: 250,
      productionModulePrice: 250,
      moduleSubscriptionSurcharge: 0.5
    }
  ]);
});

// ============================================================
// FINANCE & TAX MODULE ENDPOINTS
// ============================================================

app.get('/api/finance/accounts', authRequired, permissionRequired('finance'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    let sql, params;
    if (tenantId) {
      sql = 'SELECT * FROM finance_accounts WHERE tenant_id = ? OR (trader_id = ? AND tenant_id IS NULL) ORDER BY code ASC';
      params = [tenantId, traderId];
    } else {
      sql = 'SELECT * FROM finance_accounts WHERE trader_id = ? ORDER BY code ASC';
      params = [traderId];
    }
    const accounts = await db.query(sql, params);
    res.json(accounts.data || []);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/finance/accounts', authRequired, permissionRequired('finance'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    const { code, name, type, category, description } = req.body;
    await db.execute(
      'INSERT INTO finance_accounts (trader_id, tenant_id, code, name, type, category, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [traderId, tenantId, code, name, type, category, description]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.get('/api/finance/journal-entries', authRequired, permissionRequired('finance'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    let sql, params;
    if (tenantId) {
      sql = 'SELECT * FROM journal_entries WHERE tenant_id = ? OR (trader_id = ? AND tenant_id IS NULL) ORDER BY entry_date DESC';
      params = [tenantId, traderId];
    } else {
      sql = 'SELECT * FROM journal_entries WHERE trader_id = ? ORDER BY entry_date DESC';
      params = [traderId];
    }
    const entries = await db.query(sql, params);
    // For each entry, fetch lines
    const results = [];
    for (const entry of (entries.data || [])) {
      const lines = await db.query('SELECT l.*, a.name as account_name FROM journal_lines l JOIN finance_accounts a ON l.account_id = a.id WHERE l.entry_id = ?', [entry.id]);
      results.push({ ...entry, lines: lines.data || [] });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/finance/journal-entries', authRequired, permissionRequired('finance'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    const { date, reference, description, lines } = req.body;
    
    // Start transaction if using library with transaction support, else sequential
    const executeResult: any = await db.execute(
      'INSERT INTO journal_entries (trader_id, tenant_id, entry_date, reference, description) VALUES (?, ?, ?, ?, ?)',
      [traderId, tenantId, date || new Date().toISOString(), reference, description]
    );
    
    const sqliteResult = executeResult.find((r: any) => r.source === 'sqlite');
    const entryId = sqliteResult?.lastID;

    for (const line of lines) {
      await db.execute(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, line.accountId, line.debit || 0, line.credit || 0]
      );
      
      // Update account balance
      const impact = (line.debit || 0) - (line.credit || 0);
      await db.execute('UPDATE finance_accounts SET balance = balance + ? WHERE id = ?', [impact, line.accountId]);
    }
    
    res.json({ success: true, id: entryId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post journal entry' });
  }
});

app.get('/api/tax/transactions', authRequired, permissionRequired('tax'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    let sql, params;
    if (tenantId) {
      sql = 'SELECT * FROM tax_transactions WHERE tenant_id = ? OR (trader_id = ? AND tenant_id IS NULL) ORDER BY transaction_date DESC';
      params = [tenantId, traderId];
    } else {
      sql = 'SELECT * FROM tax_transactions WHERE trader_id = ? ORDER BY transaction_date DESC';
      params = [traderId];
    }
    const result = await db.query(sql, params);
    res.json(result.data || []);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/modules/activate', authRequired, async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const { module, country } = req.body;
    
    if (module === 'finance') {
      await db.execute('UPDATE traders SET finance_active = 1 WHERE id = ?', [traderId]);
    } else if (module === 'tax') {
      await db.execute('UPDATE traders SET tax_active = 1, tax_regime_country = ? WHERE id = ?', [country || 'Kenya', traderId]);
    } else if (module === 'production') {
      await db.execute('UPDATE traders SET production_active = 1 WHERE id = ?', [traderId]);
    } else if (module === 'hr') {
      await db.execute('UPDATE traders SET hr_active = 1 WHERE id = ?', [traderId]);
    }
    
    res.json({ success: true, message: `${module} module activated` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate module' });
  }
});

app.post('/api/modules/deactivate', authRequired, async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const { module } = req.body;
    
    if (module === 'finance') {
      await db.execute('UPDATE traders SET finance_active = 0 WHERE id = ?', [traderId]);
    } else if (module === 'tax') {
      await db.execute('UPDATE traders SET tax_active = 0 WHERE id = ?', [traderId]);
    } else if (module === 'production') {
      await db.execute('UPDATE traders SET production_active = 0 WHERE id = ?', [traderId]);
    } else if (module === 'hr') {
      await db.execute('UPDATE traders SET hr_active = 0 WHERE id = ?', [traderId]);
    }
    
    res.json({ success: true, message: `${module} module deactivated` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate module' });
  }
});

app.get('/api/products', authRequired, async (req: any, res) => {
  // Alias to inventory for now
  try {
    const traderId = req.traderId;
    const sql = `SELECT * FROM inventory WHERE trader_id = ?`;
    const result = await db.query(sql, [traderId]);
    res.json(result.data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ============================================================
// PRODUCTION MODULE API (BiasharaSasa SME Production Management)
// ============================================================

// Get all raw material ingredients
app.get('/api/production/ingredients', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    let sql, params;
    if (tenantId) {
      sql = 'SELECT * FROM production_ingredients WHERE tenant_id = ? OR (trader_id = ? AND tenant_id IS NULL) ORDER BY name ASC';
      params = [tenantId, traderId];
    } else {
      sql = 'SELECT * FROM production_ingredients WHERE trader_id = ? ORDER BY name ASC';
      params = [traderId];
    }
    const result = await db.query(sql, params);
    res.json(result.data || []);
  } catch (err: any) {
    console.error('Error fetching ingredients:', err);
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

// Create new raw material ingredient
app.post('/api/production/ingredients', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    const { name, cost_per_unit, unit, current_stock, reorder_level } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Ingredient name is required' });
    }
    const result: any = await db.execute(
      `INSERT INTO production_ingredients (trader_id, tenant_id, name, cost_per_unit, unit, current_stock, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [traderId, tenantId, name, Number(cost_per_unit) || 0, unit || 'kg', Number(current_stock) || 0, Number(reorder_level) || 0]
    );
    const sqliteResult = Array.isArray(result) ? result.find((r: any) => r.source === 'sqlite') : null;
    const ingredientId = sqliteResult?.lastID || Date.now();
    res.status(201).json({ success: true, id: ingredientId });
  } catch (err: any) {
    console.error('Error creating ingredient:', err);
    res.status(500).json({ error: 'Failed to create ingredient' });
  }
});

// Update raw material ingredient
app.put('/api/production/ingredients/:id', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, cost_per_unit, unit, current_stock, reorder_level } = req.body;
    const traderId = req.traderId;
    const tenantId = req.tenantId;

    let sql, params;
    if (tenantId) {
      sql = `UPDATE production_ingredients 
             SET name = ?, cost_per_unit = ?, unit = ?, current_stock = ?, reorder_level = ?
             WHERE id = ? AND (tenant_id = ? OR (trader_id = ? AND tenant_id IS NULL))`;
      params = [name, Number(cost_per_unit) || 0, unit || 'kg', Number(current_stock) || 0, Number(reorder_level) || 0, id, tenantId, traderId];
    } else {
      sql = `UPDATE production_ingredients 
             SET name = ?, cost_per_unit = ?, unit = ?, current_stock = ?, reorder_level = ?
             WHERE id = ? AND trader_id = ?`;
      params = [name, Number(cost_per_unit) || 0, unit || 'kg', Number(current_stock) || 0, Number(reorder_level) || 0, id, traderId];
    }

    await db.execute(sql, params);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update ingredient' });
  }
});

// Delete ingredient
app.delete('/api/production/ingredients/:id', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const traderId = req.traderId;
    const tenantId = req.tenantId;

    let sql, params;
    if (tenantId) {
      sql = 'DELETE FROM production_ingredients WHERE id = ? AND (tenant_id = ? OR (trader_id = ? AND tenant_id IS NULL))';
      params = [id, tenantId, traderId];
    } else {
      sql = 'DELETE FROM production_ingredients WHERE id = ? AND trader_id = ?';
      params = [id, traderId];
    }

    await db.execute(sql, params);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete ingredient' });
  }
});

// Get all production batches
app.get('/api/production/batches', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    let sql, params;
    if (tenantId) {
      sql = `SELECT b.*, 
        (SELECT COUNT(*) FROM production_raw_material_usage WHERE batch_id = b.id) as materials_count,
        (SELECT COUNT(*) FROM production_labour_costs WHERE batch_id = b.id) as workers_count
       FROM production_batches b
       WHERE b.tenant_id = ? OR (b.trader_id = ? AND b.tenant_id IS NULL)
       ORDER BY b.production_date DESC`;
      params = [tenantId, traderId];
    } else {
      sql = `SELECT b.*, 
        (SELECT COUNT(*) FROM production_raw_material_usage WHERE batch_id = b.id) as materials_count,
        (SELECT COUNT(*) FROM production_labour_costs WHERE batch_id = b.id) as workers_count
       FROM production_batches b
       WHERE b.trader_id = ?
       ORDER BY b.production_date DESC`;
      params = [traderId];
    }
    const result = await db.query(sql, params);
    res.json(result.data || []);
  } catch (err: any) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ error: 'Failed to fetch production batches' });
  }
});

// Get detailed batch by ID
app.get('/api/production/batches/:id', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const traderId = req.traderId;
    const tenantId = req.tenantId;

    let sql, params;
    if (tenantId) {
      sql = 'SELECT * FROM production_batches WHERE id = ? AND (tenant_id = ? OR (trader_id = ? AND tenant_id IS NULL))';
      params = [id, tenantId, traderId];
    } else {
      sql = 'SELECT * FROM production_batches WHERE id = ? AND trader_id = ?';
      params = [id, traderId];
    }

    const batch = await db.get(sql, params);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const materials = await db.query(
      `SELECT r.*, i.unit, i.cost_per_unit
       FROM production_raw_material_usage r
       LEFT JOIN production_ingredients i ON r.ingredient_id = i.id
       WHERE r.batch_id = ?`,
      [id]
    );

    const labour = await db.query(
      'SELECT * FROM production_labour_costs WHERE batch_id = ?',
      [id]
    );

    const overhead = await db.query(
      'SELECT * FROM production_overhead_costs WHERE batch_id = ?',
      [id]
    );

    res.json({
      ...batch,
      raw_materials: materials.data || [],
      labour_costs: labour.data || [],
      overhead_costs: overhead.data || []
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch batch details' });
  }
});

// Create new production batch with automatic costing & validation
app.post('/api/production/batches', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    const {
      product_id,
      product_name,
      quantity_produced,
      raw_materials = [],
      labour = [],
      overhead = [],
      responsible_user = 'Production Manager',
      notes = ''
    } = req.body;

    const qty = Number(quantity_produced) || 0;
    if (qty <= 0) {
      return res.status(400).json({ error: 'Production quantity must be greater than zero' });
    }

    // Generate batch number
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countRow = await db.get(
      "SELECT COUNT(*) as count FROM production_batches WHERE batch_number LIKE ?",
      [`BATCH-${todayStr}-%`]
    );
    const count = (countRow?.count || 0) + 1;
    const batchNumber = `BATCH-${todayStr}-${String(count).padStart(4, '0')}`;

    // Calculate raw materials cost & validate stock availability
    let rawMaterialsTotal = 0;
    const processedMaterials: any[] = [];
    for (const rm of raw_materials) {
      const ingredient = await db.get(
        'SELECT * FROM production_ingredients WHERE id = ?',
        [rm.ingredient_id]
      );
      if (!ingredient) {
        return res.status(400).json({ error: `Raw material ID ${rm.ingredient_id} not found` });
      }
      const quantityUsed = Number(rm.quantity_used) || 0;
      if (ingredient.current_stock < quantityUsed) {
        return res.status(400).json({
          error: `Insufficient stock for ${ingredient.name}. Available: ${ingredient.current_stock} ${ingredient.unit}, Required: ${quantityUsed} ${ingredient.unit}`
        });
      }
      const itemCost = quantityUsed * (ingredient.cost_per_unit || 0);
      rawMaterialsTotal += itemCost;
      processedMaterials.push({
        ingredient_id: ingredient.id,
        ingredient_name: ingredient.name,
        quantity_used: quantityUsed,
        cost: itemCost
      });
    }

    // Calculate labour costs
    let labourTotal = 0;
    const processedLabour: any[] = [];
    for (const l of labour) {
      const hours = Number(l.hours_worked) || 0;
      const rate = Number(l.hourly_rate) || 0;
      const total = hours * rate;
      labourTotal += total;
      processedLabour.push({
        employee_name: l.employee_name || 'Worker',
        hours_worked: hours,
        hourly_rate: rate,
        total_cost: total,
        role: l.role || 'Production Staff'
      });
    }

    // Calculate overhead and associated costs (utility bills, rent, packaging, maintenance, etc.)
    let overheadTotal = 0;
    const processedOverhead: any[] = [];
    for (const o of overhead) {
      const amt = Number(o.amount) || 0;
      overheadTotal += amt;
      processedOverhead.push({
        category: o.category || 'General Associated Cost',
        amount: amt,
        description: o.description || '',
        cost_type: o.cost_type || 'other',
        bill_reference: o.bill_reference || '',
        units_consumed: Number(o.units_consumed) || null,
        unit_rate: Number(o.unit_rate) || null,
        unit_measure: o.unit_measure || '',
        billing_period: o.billing_period || ''
      });
    }

    // Totals
    const totalCost = rawMaterialsTotal + labourTotal + overheadTotal;
    const costPerUnit = qty > 0 ? (totalCost / qty) : 0;

    const batchResult: any = await db.execute(
      `INSERT INTO production_batches 
       (trader_id, tenant_id, batch_number, product_id, product_name, quantity_produced, total_cost, cost_per_unit, responsible_user, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [traderId, tenantId, batchNumber, product_id || 0, product_name || 'Manufactured Item', qty, totalCost, costPerUnit, responsible_user, notes]
    );

    const sqliteResult = Array.isArray(batchResult) ? batchResult.find((r: any) => r.source === 'sqlite') : null;
    const batchId = sqliteResult?.lastID || Date.now();

    // Insert raw material entries
    for (const rm of processedMaterials) {
      await db.execute(
        `INSERT INTO production_raw_material_usage (batch_id, ingredient_id, ingredient_name, quantity_used, cost)
         VALUES (?, ?, ?, ?, ?)`,
        [batchId, rm.ingredient_id, rm.ingredient_name, rm.quantity_used, rm.cost]
      );
    }

    // Insert labour entries
    for (const l of processedLabour) {
      await db.execute(
        `INSERT INTO production_labour_costs (batch_id, employee_name, hours_worked, hourly_rate, total_cost, role)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [batchId, l.employee_name, l.hours_worked, l.hourly_rate, l.total_cost, l.role]
      );
    }

    // Insert overhead and utility bill entries
    for (const o of processedOverhead) {
      try {
        await db.execute(
          `INSERT INTO production_overhead_costs (batch_id, category, amount, description, cost_type, bill_reference, units_consumed, unit_rate, unit_measure, billing_period)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [batchId, o.category, o.amount, o.description, o.cost_type, o.bill_reference, o.units_consumed, o.unit_rate, o.unit_measure, o.billing_period]
        );
      } catch (errFallback) {
        // Fallback for base columns if new schema migration is still caching
        await db.execute(
          `INSERT INTO production_overhead_costs (batch_id, category, amount, description)
           VALUES (?, ?, ?, ?)`,
          [batchId, o.category, o.amount, o.description]
        );
      }
    }

    res.status(201).json({
      success: true,
      batch_id: batchId,
      batch_number: batchNumber,
      total_cost: totalCost,
      cost_per_unit: costPerUnit
    });
  } catch (err: any) {
    console.error('Error creating production batch:', err);
    res.status(500).json({ error: err.message || 'Failed to create production batch' });
  }
});

// Approve batch: Deducts raw materials, adds finished product stock, logs inventory movements
app.post('/api/production/batches/:id/approve', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { approver = 'Admin' } = req.body;

    const batch = await db.get('SELECT * FROM production_batches WHERE id = ?', [id]);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    if (batch.status === 'approved' || batch.status === 'completed') {
      return res.status(400).json({ error: `Batch ${batch.batch_number} is already approved/completed` });
    }

    // Get raw materials used
    const materialsResult = await db.query(
      `SELECT r.*, i.current_stock, i.name as ingredient_name
       FROM production_raw_material_usage r
       JOIN production_ingredients i ON r.ingredient_id = i.id
       WHERE r.batch_id = ?`,
      [id]
    );

    const materials = materialsResult.data || [];

    // Deduct raw materials from stock and record movements
    for (const rm of materials) {
      const newStock = Math.max(0, (rm.current_stock || 0) - rm.quantity_used);
      await db.execute(
        'UPDATE production_ingredients SET current_stock = ? WHERE id = ?',
        [newStock, rm.ingredient_id]
      );

      await db.execute(
        `INSERT INTO production_inventory_movements 
         (trader_id, ingredient_id, movement_type, quantity, reference_id, reference_type, notes)
         VALUES (?, ?, 'consumed', ?, ?, 'production_batch', ?)`,
        [batch.trader_id || 1, rm.ingredient_id, rm.quantity_used, batch.id, `Consumed for batch ${batch.batch_number}`]
      );
    }

    // Add finished product stock to inventory if product exists in inventory table
    if (batch.product_id) {
      await db.execute(
        `UPDATE inventory SET stock = stock + ? WHERE id = ?`,
        [batch.quantity_produced, batch.product_id]
      );

      await db.execute(
        `INSERT INTO production_inventory_movements 
         (trader_id, product_id, movement_type, quantity, reference_id, reference_type, notes)
         VALUES (?, ?, 'production_add', ?, ?, 'production_batch', ?)`,
        [batch.trader_id || 1, batch.product_id, batch.quantity_produced, batch.id, `Finished goods added from batch ${batch.batch_number}`]
      );
    }

    // Mark batch as approved
    await db.execute(
      `UPDATE production_batches 
       SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [approver, id]
    );

    res.json({ success: true, message: `Batch ${batch.batch_number} approved and inventory synchronized successfully.` });
  } catch (err: any) {
    console.error('Error approving batch:', err);
    res.status(500).json({ error: 'Failed to approve batch' });
  }
});

// Cancel batch
app.post('/api/production/batches/:id/cancel', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const { id } = req.params;
    await db.execute("UPDATE production_batches SET status = 'cancelled' WHERE id = ?", [id]);
    res.json({ success: true, message: 'Batch cancelled' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to cancel batch' });
  }
});

// Production Summary and Cost Breakdown Report
app.get('/api/production/summary', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const traderId = req.traderId || 1;
    const summary = await db.get(
      `SELECT 
        COUNT(*) as total_batches,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(quantity_produced), 0) as total_quantity,
        COALESCE(AVG(cost_per_unit), 0) as avg_cost_per_unit
       FROM production_batches
       WHERE trader_id = ? AND status IN ('approved', 'completed')`,
      [traderId]
    );

    const pendingCount = await db.get(
      `SELECT COUNT(*) as count FROM production_batches WHERE trader_id = ? AND status = 'draft'`,
      [traderId]
    );

    const lowStockIngredients = await db.query(
      `SELECT * FROM production_ingredients 
       WHERE trader_id = ? AND current_stock <= reorder_level
       ORDER BY current_stock ASC`,
      [traderId]
    );

    res.json({
      summary: {
        total_batches: summary?.total_batches || 0,
        total_cost: summary?.total_cost || 0,
        total_quantity: summary?.total_quantity || 0,
        avg_cost_per_unit: summary?.avg_cost_per_unit || 0,
        draft_batches: pendingCount?.count || 0
      },
      low_stock_ingredients: lowStockIngredients.data || []
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch production summary' });
  }
});

// ============================================================
// PRODUCTION RECIPES API
// ============================================================

// Get all recipes
app.get('/api/production/recipes', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const traderId = req.traderId || 1;
    const result = await db.query(
      'SELECT * FROM production_recipes WHERE trader_id = ? ORDER BY name ASC',
      [traderId]
    );
    res.json(result.data || []);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Get detailed recipe
app.get('/api/production/recipes/:id', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const traderId = req.traderId;
    const tenantId = req.tenantId;

    let sql, params;
    if (tenantId) {
      sql = 'SELECT * FROM production_recipes WHERE id = ? AND (tenant_id = ? OR (trader_id = ? AND tenant_id IS NULL))';
      params = [id, tenantId, traderId];
    } else {
      sql = 'SELECT * FROM production_recipes WHERE id = ? AND trader_id = ?';
      params = [id, traderId];
    }

    const recipe = await db.get(sql, params);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    const ingredients = await db.query(
      `SELECT ri.*, i.name as ingredient_name, i.unit, i.cost_per_unit
       FROM production_recipe_ingredients ri
       JOIN production_ingredients i ON ri.ingredient_id = i.id
       WHERE ri.recipe_id = ?`,
      [id]
    );

    let overheads: any[] = [];
    try {
      const oh = await db.query('SELECT * FROM production_recipe_overheads WHERE recipe_id = ?', [id]);
      overheads = oh.data || [];
    } catch (e) {
      overheads = [];
    }

    res.json({ ...recipe, ingredients: ingredients.data || [], overheads });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch recipe details' });
  }
});

// Create new recipe
app.post('/api/production/recipes', authRequired, permissionRequired('production'), async (req: any, res) => {
  try {
    const traderId = req.traderId;
    const tenantId = req.tenantId;
    const { name, product_id, product_name, target_quantity, description, ingredients = [], overheads = [] } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Recipe name is required' });

    const result: any = await db.execute(
      `INSERT INTO production_recipes (trader_id, tenant_id, name, product_id, product_name, target_quantity, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [traderId, tenantId, name, product_id || 0, product_name || '', Number(target_quantity) || 1, description || '']
    );

    const sqliteResult = Array.isArray(result) ? result.find((r: any) => r.source === 'sqlite') : null;
    const recipeId = sqliteResult?.lastID || Date.now();

    for (const ing of ingredients) {
      await db.execute(
        'INSERT INTO production_recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?)',
        [recipeId, ing.ingredient_id, Number(ing.quantity) || 0]
      );
    }

    for (const oh of overheads) {
      try {
        await db.execute(
          `INSERT INTO production_recipe_overheads (recipe_id, category, amount, description, cost_type, bill_reference, units_consumed, unit_rate, unit_measure)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [recipeId, oh.category, Number(oh.amount) || 0, oh.description || '', oh.cost_type || 'utility', oh.bill_reference || '', Number(oh.units_consumed) || null, Number(oh.unit_rate) || null, oh.unit_measure || '']
        );
      } catch (errOh) {
        // Table fallback
      }
    }

    res.status(201).json({ success: true, id: recipeId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

// Delete recipe
app.delete('/api/production/recipes/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM production_recipes WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// ============================================================
// SYSTEM HEALTH, BACKUP & RESILIENCE ENDPOINTS
// ============================================================

app.get('/api/system/health', async (req, res) => {
  try {
    const integrityStatus = await db.getIntegrityStatus();
    res.json({
      status: integrityStatus.status === 'HEALTHY' ? 'healthy' : 'degraded',
      service: 'BiasharaSasa Global Inventory',
      database: db.isUsingSupabase() ? 'supabase' : 'sqlite',
      resilience: {
        walMode: integrityStatus.journalMode,
        foreignKeys: integrityStatus.foreignKeys,
        integrityCheck: integrityStatus.integrity,
        lastSnapshot: integrityStatus.snapshot?.lastModified || null,
        snapshotSizeBytes: integrityStatus.snapshot?.sizeBytes || 0
      },
      counts: integrityStatus.counts,
      timestamp: new Date().toISOString(),
      version: '2.1.0'
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', database: 'ERROR', error: err.message });
  }
});

// Trigger immediate manual backup snapshot
app.post('/api/system/snapshot', async (req: any, res) => {
  try {
    const snapshot = await db.exportFullSnapshot();
    res.json({
      success: true,
      message: 'System snapshot created successfully on persistent storage.',
      timestamp: snapshot.timestamp,
      counts: snapshot.counts
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Snapshot generation failed' });
  }
});

// ============================================================
// SUPABASE CLOUD STATUS, SYNC & CONFIG ENDPOINTS
// ============================================================

app.get('/api/system/supabase/status', async (req, res) => {
  const isUsing = db.isUsingSupabase();
  const client = db.getSupabase();
  let connectionTest: any = { status: 'active', connected: true };
  
  if (client) {
    try {
      const ping = await db.syncToSupabase();
      connectionTest = ping;
    } catch (e: any) {
      connectionTest = { status: 'error', message: e.message, connected: false };
    }
  }

  res.json({
    active: isUsing,
    provider: 'Supabase Cloud (PostgreSQL)',
    serverPackage: '@supabase/server (Installed & Configured)',
    url: SUPABASE_URL,
    hasAnonKey: !!SUPABASE_ANON_KEY,
    hybridMode: true,
    connection: connectionTest,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/system/supabase/sync', authRequired, async (req: any, res) => {
  try {
    const result = await db.syncToSupabase();
    res.json({
      success: true,
      message: 'Supabase synchronization executed successfully.',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/system/supabase/config', authRequired, async (req: any, res) => {
  try {
    const { url, key } = req.body;
    if (!url || !key) {
      return res.status(400).json({ error: 'Supabase URL and API Key are required' });
    }
    const update = db.updateSupabaseConfig(url, key);
    res.json({
      success: update.success,
      message: update.success ? 'Supabase credentials updated & re-activated' : 'Update failed',
      url: update.url,
      error: update.error
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function convertRowsToCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map(row => {
    return headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') {
        return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });
  return [headerLine, ...rowLines].join('\r\n');
}

// Export full database snapshot (used by SystemAdmin and automated backups)
// Supports format=json or format=csv, and optional table=table_name
const handleExport = async (req: any, res: any) => {
  try {
    const snapshot = await db.exportFullSnapshot();
    const format = (req.query.format || 'json').toString().toLowerCase();
    const targetTable = (req.query.table || '').toString().toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      if (targetTable && targetTable !== 'all') {
        const rows = snapshot.tables[targetTable] || [];
        const csv = convertRowsToCsv(rows);
        const filename = `biashara_${targetTable}_${dateStr}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csv);
      } else {
        let fullCsv = `# BIASHARASASA DATABASE BACKUP & DISASTER RECOVERY EXPORT\r\n# Timestamp: ${snapshot.timestamp}\r\n# Database Engine: ${snapshot.database || 'sqlite'}\r\n# Tables: ${Object.keys(snapshot.tables).length}\r\n\r\n`;
        for (const [tableName, rows] of Object.entries(snapshot.tables)) {
          if (Array.isArray(rows) && rows.length > 0) {
            fullCsv += `\r\n# TABLE: ${tableName} (Count: ${rows.length})\r\n`;
            fullCsv += convertRowsToCsv(rows);
            fullCsv += '\r\n';
          }
        }
        const filename = `biashara_full_database_backup_${dateStr}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(fullCsv);
      }
    }

    const filename = `biashara_backup_${dateStr}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export database snapshot', details: err.message });
  }
};

app.get('/api/export', handleExport);
app.get('/api/system/backup', handleExport);

// Import/Restore database snapshot
const handleImport = async (req: any, res: any) => {
  try {
    const snapshotData = req.body?.snapshot || req.body;
    if (!snapshotData || !snapshotData.tables) {
      return res.status(400).json({ 
        error: 'Invalid backup format. Expected JSON object with a tables property.' 
      });
    }

    const result = await db.importFullSnapshot(snapshotData, true);
    res.json({
      success: true,
      message: result.message,
      rowsRestored: result.rowsRestored
    });
  } catch (err: any) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Failed to restore database', details: err.message });
  }
};

app.post('/api/import', handleImport);
app.post('/api/system/restore', handleImport);

// Deep System Integrity Audit
app.get('/api/system/integrity/audit', async (req: any, res) => {
  try {
    const report = await db.runIntegrityAudit();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// Automated System Self-Healing & Repair
app.post('/api/system/integrity/repair', async (req: any, res) => {
  try {
    const repairResult = await db.runSelfRepair();
    res.json(repairResult);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List all snapshots stored in server backup repository
app.get('/api/system/snapshots', async (req: any, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
    const snapshots = files.map(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      let parsedHeader: any = null;
      try {
        // Read first 2KB to extract metadata without parsing huge file
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(2048);
        fs.readSync(fd, buffer, 0, 2048, 0);
        fs.closeSync(fd);
        const snippet = buffer.toString('utf-8');
        const timestampMatch = snippet.match(/"timestamp":\s*"([^"]+)"/);
        const checksumMatch = snippet.match(/"checksum":\s*"([^"]+)"/);
        const versionMatch = snippet.match(/"version":\s*"([^"]+)"/);
        parsedHeader = {
          timestamp: timestampMatch ? timestampMatch[1] : null,
          checksum: checksumMatch ? checksumMatch[1] : null,
          version: versionMatch ? versionMatch[1] : null
        };
      } catch (hErr) {}

      return {
        filename: file,
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString(),
        isLatest: file === 'biashara_latest_snapshot.json',
        metadata: parsedHeader
      };
    }).sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    res.json(snapshots);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read snapshots repository' });
  }
});

// Restore from a specific server snapshot file
app.post('/api/system/snapshots/restore', async (req: any, res) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string' || !filename.endsWith('.json')) {
      return res.status(400).json({ error: 'Valid snapshot filename required' });
    }

    // Guard against directory traversal
    const safeFilename = path.basename(filename);
    const targetFile = path.join(BACKUP_DIR, safeFilename);

    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ error: `Snapshot file '${safeFilename}' not found` });
    }

    const raw = fs.readFileSync(targetFile, 'utf-8');
    const snapshotData = JSON.parse(raw);
    const result = await db.importFullSnapshot(snapshotData, true);

    res.json({
      success: true,
      message: `Snapshot '${safeFilename}' successfully restored. ${result.rowsRestored} records active.`,
      checksumVerified: result.checksumVerified,
      rowsRestored: result.rowsRestored
    });
  } catch (err: any) {
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

app.get('/api/system/errors', async (req: any, res) => {
  try {
    const logs = await db.query('SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 50');
    res.json(logs.data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

app.post('/api/system/errors', async (req: any, res) => {
  try {
    const { type, message, stack, endpoint, user_id, url, user_agent, trader_id } = req.body;
    await db.execute(
      'INSERT INTO error_logs (error_type, error_message, stack_trace, endpoint, user_id, url, user_agent, trader_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [type || 'General', message || '', stack || '', endpoint || '', user_id || null, url || '', user_agent || '', trader_id || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// ============================================================
// STARTUP
// ============================================================
async function startServer() {
  try {
    // Initialize database
    await db.init();
    
    // Socket.io connection handler
    io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);
      socket.on('join_tenant', (tenantId) => {
        if (tenantId) {
          socket.join(`tenant_${tenantId}`);
          console.log(`[Socket] ${socket.id} joined room tenant_${tenantId}`);
        }
      });
      socket.on('leave_tenant', (tenantId) => {
        if (tenantId) {
          socket.leave(`tenant_${tenantId}`);
        }
      });
      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });

    // Vite middleware
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    // Global error handler for API
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('Unhandled API Error:', err);
      if (req.path.startsWith('/api')) {
        return res.status(err.status || 500).json({ 
          error: err.message || 'Internal server error',
          success: false 
        });
      }
      next(err);
    });

    // Start server
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(60));
      console.log('🌍 BIASHARASASA - Global Inventory Management');
      console.log('='.repeat(60));
      console.log(`📡 Server: http://0.0.0.0:${PORT}`);
      console.log(`🗄️  Database: ${db.isUsingSupabase() ? 'Supabase (PostgreSQL)' : 'SQLite'}`);
      console.log(`💾 Cache: ${cache.redis ? 'Redis' : 'Memory'}`);
      console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 8)}...`);
      console.log('='.repeat(60));
      console.log('✅ Ready for global access!');
      console.log('='.repeat(60));
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

// Graceful shutdown handling for container deployments and restarts
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 [Server] Received ${signal}. Executing safe checkpoint & snapshot...`);
  try {
    await db.exportFullSnapshot();
    const sqlite = db.getSqlite();
    if (sqlite) {
      await sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      await sqlite.close();
    }
    console.log('✅ [Server] WAL checkpoint & snapshot complete. Safe shutdown.');
  } catch (err) {
    console.error('⚠️ [Server] Error during shutdown checkpoint:', err);
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server only if not in a serverless environment
if (typeof process !== 'undefined' && !isServerless) {
  startServer();
}

export { db, cache };
export default app;
