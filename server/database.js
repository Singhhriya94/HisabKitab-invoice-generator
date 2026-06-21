const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDb() {
    const dbPath = path.join(__dirname, 'database.db');
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.run('PRAGMA foreign_keys = ON');

    // Create users table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);

    // Create invoices table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            invoice_number TEXT NOT NULL,
            company_name TEXT,
            company_email TEXT,
            company_phone TEXT,
            company_address TEXT,
            client_name TEXT,
            client_email TEXT,
            client_phone TEXT,
            invoice_date TEXT,
            due_date TEXT,
            status TEXT DEFAULT 'Pending',
            tax_percentage REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            notes TEXT,
            payment_method TEXT,
            payment_details TEXT,
            subtotal REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            saved_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);

    // Create invoice_items table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            qty INTEGER NOT NULL,
            price REAL NOT NULL,
            total REAL NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
        )
    `);

    // Create payments table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL,
            razorpay_order_id TEXT UNIQUE NOT NULL,
            razorpay_payment_id TEXT,
            razorpay_signature TEXT,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'created',
            created_at TEXT NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
        )
    `);

    console.log('Database initialized successfully.');
    return db;
}

// User helper methods
async function createUser(firstName, lastName, email, hashedPassword) {
    const query = `
        INSERT INTO users (first_name, last_name, email, password)
        VALUES (?, ?, ?, ?)
    `;
    const result = await db.run(query, [firstName, lastName, email, hashedPassword]);
    return { id: result.lastID, firstName, lastName, email };
}

async function getUserByEmail(email) {
    return await db.get('SELECT * FROM users WHERE email = ?', [email]);
}

async function getUserById(id) {
    return await db.get('SELECT id, first_name, last_name, email FROM users WHERE id = ?', [id]);
}

// Invoice helper methods
async function getInvoices(userId) {
    const invoices = await db.all('SELECT * FROM invoices WHERE user_id = ? ORDER BY id DESC', [userId]);
    return invoices;
}

async function getInvoiceById(invoiceId, userId) {
    const invoice = await db.get('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [invoiceId, userId]);
    if (!invoice) return null;

    const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
    invoice.items = items;
    return invoice;
}

async function saveInvoice(userId, invoiceData) {
    await db.run('BEGIN TRANSACTION');
    try {
        const query = `
            INSERT INTO invoices (
                user_id, invoice_number, company_name, company_email, company_phone, company_address,
                client_name, client_email, client_phone, invoice_date, due_date, status,
                tax_percentage, discount, notes, payment_method, payment_details,
                subtotal, tax_amount, total, saved_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            userId,
            invoiceData.invoiceNumber,
            invoiceData.companyName,
            invoiceData.companyEmail,
            invoiceData.companyPhone,
            invoiceData.companyAddress,
            invoiceData.clientName,
            invoiceData.clientEmail,
            invoiceData.clientPhone,
            invoiceData.invoiceDate,
            invoiceData.dueDate,
            invoiceData.status || 'Pending',
            invoiceData.taxPercentage || 0,
            invoiceData.discount || 0,
            invoiceData.notes,
            invoiceData.paymentMethod,
            invoiceData.paymentDetails,
            invoiceData.subtotal,
            invoiceData.taxAmount,
            invoiceData.total,
            invoiceData.savedAt
        ];

        const result = await db.run(query, params);
        const invoiceId = result.lastID;

        // Insert items
        if (invoiceData.items && invoiceData.items.length > 0) {
            const itemQuery = `
                INSERT INTO invoice_items (invoice_id, name, qty, price, total)
                VALUES (?, ?, ?, ?, ?)
            `;
            for (const item of invoiceData.items) {
                await db.run(itemQuery, [invoiceId, item.name, item.qty, item.price, item.total]);
            }
        }

        await db.run('COMMIT');
        return { ...invoiceData, id: invoiceId };
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
}

async function updateInvoice(userId, invoiceId, invoiceData) {
    // Verify invoice ownership
    const existing = await db.get('SELECT id FROM invoices WHERE id = ? AND user_id = ?', [invoiceId, userId]);
    if (!existing) {
        throw new Error('Invoice not found or unauthorized');
    }

    await db.run('BEGIN TRANSACTION');
    try {
        const query = `
            UPDATE invoices SET
                invoice_number = ?, company_name = ?, company_email = ?, company_phone = ?, company_address = ?,
                client_name = ?, client_email = ?, client_phone = ?, invoice_date = ?, due_date = ?, status = ?,
                tax_percentage = ?, discount = ?, notes = ?, payment_method = ?, payment_details = ?,
                subtotal = ?, tax_amount = ?, total = ?, saved_at = ?
            WHERE id = ? AND user_id = ?
        `;
        const params = [
            invoiceData.invoiceNumber,
            invoiceData.companyName,
            invoiceData.companyEmail,
            invoiceData.companyPhone,
            invoiceData.companyAddress,
            invoiceData.clientName,
            invoiceData.clientEmail,
            invoiceData.clientPhone,
            invoiceData.invoiceDate,
            invoiceData.dueDate,
            invoiceData.status || 'Pending',
            invoiceData.taxPercentage || 0,
            invoiceData.discount || 0,
            invoiceData.notes,
            invoiceData.paymentMethod,
            invoiceData.paymentDetails,
            invoiceData.subtotal,
            invoiceData.taxAmount,
            invoiceData.total,
            invoiceData.savedAt,
            invoiceId,
            userId
        ];

        await db.run(query, params);

        // Delete old items and insert updated ones
        await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

        if (invoiceData.items && invoiceData.items.length > 0) {
            const itemQuery = `
                INSERT INTO invoice_items (invoice_id, name, qty, price, total)
                VALUES (?, ?, ?, ?, ?)
            `;
            for (const item of invoiceData.items) {
                await db.run(itemQuery, [invoiceId, item.name, item.qty, item.price, item.total]);
            }
        }

        await db.run('COMMIT');
        return { ...invoiceData, id: invoiceId };
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
}

// Payment helper methods
async function recordPaymentOrder(invoiceId, razorpayOrderId, amount) {
    const query = `
        INSERT INTO payments (invoice_id, razorpay_order_id, amount, created_at)
        VALUES (?, ?, ?, ?)
    `;
    const savedAt = new Date().toISOString();
    await db.run(query, [invoiceId, razorpayOrderId, amount, savedAt]);
}

async function fulfillPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    // 1. Get payment record
    const payment = await db.get('SELECT invoice_id FROM payments WHERE razorpay_order_id = ?', [razorpayOrderId]);
    if (!payment) {
        throw new Error('Payment order not found');
    }

    await db.run('BEGIN TRANSACTION');
    try {
        // 2. Update payment status
        await db.run(
            'UPDATE payments SET razorpay_payment_id = ?, razorpay_signature = ?, status = ? WHERE razorpay_order_id = ?',
            [razorpayPaymentId, razorpaySignature, 'captured', razorpayOrderId]
        );

        // 3. Update invoice status to 'Paid'
        await db.run(
            'UPDATE invoices SET status = ? WHERE id = ?',
            ['Paid', payment.invoice_id]
        );

        await db.run('COMMIT');
        return payment.invoice_id;
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
}

// Counter/invoice number tracker
async function getNextInvoiceCount(userId) {
    const result = await db.get('SELECT COUNT(*) as count FROM invoices WHERE user_id = ?', [userId]);
    const nextCount = 1001 + (result ? result.count : 0);
    return `INV-${nextCount}`;
}

module.exports = {
    initDb,
    createUser,
    getUserByEmail,
    getUserById,
    getInvoices,
    getInvoiceById,
    saveInvoice,
    updateInvoice,
    recordPaymentOrder,
    fulfillPayment,
    getNextInvoiceCount
};
