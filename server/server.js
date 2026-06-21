require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Initialize Razorpay
let razorpayInstance = null;
const isRazorpayConfigured = process.env.RAZORPAY_KEY_ID && 
                             process.env.RAZORPAY_KEY_ID !== 'rzp_test_placeholder_key_id' &&
                             process.env.RAZORPAY_KEY_SECRET &&
                             process.env.RAZORPAY_KEY_SECRET !== 'placeholder_secret_key';

if (isRazorpayConfigured) {
    try {
        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
        console.log('Razorpay configured successfully.');
    } catch (e) {
        console.error('Error initializing Razorpay, falling back to mock mode:', e.message);
    }
} else {
    console.log('Razorpay is running in Mock Fallback Mode. Real keys not configured in .env.');
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// JWT authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Auth API endpoints
app.post('/api/auth/signup', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: 'Please provide all details' });
    }

    try {
        const existingUser = await db.getUserByEmail(email.toLowerCase());
        if (existingUser) {
            return res.status(400).json({ error: 'Account already exists with this email' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await db.createUser(firstName, lastName, email.toLowerCase(), hashedPassword);

        res.status(201).json({ message: 'User registered successfully', user });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const user = await db.getUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await db.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Invoices API endpoints
app.get('/api/invoices', authenticateToken, async (req, res) => {
    try {
        const invoices = await db.getInvoices(req.user.id);
        // Load items for each invoice
        const invoicesWithItems = await Promise.all(
            invoices.map(async (inv) => {
                const detailed = await db.getInvoiceById(inv.id, req.user.id);
                return detailed;
            })
        );
        res.json(invoicesWithItems);
    } catch (error) {
        console.error('Fetch invoices error:', error);
        res.status(500).json({ error: 'Error fetching invoices' });
    }
});

app.get('/api/invoices/next-number', authenticateToken, async (req, res) => {
    try {
        const nextNumber = await db.getNextInvoiceCount(req.user.id);
        res.json({ nextNumber });
    } catch (error) {
        console.error('Generate invoice number error:', error);
        res.status(500).json({ error: 'Error generating next invoice number' });
    }
});

app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
    try {
        const invoice = await db.getInvoiceById(req.params.id, req.user.id);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json(invoice);
    } catch (error) {
        console.error('Fetch invoice by ID error:', error);
        res.status(500).json({ error: 'Error fetching invoice' });
    }
});

app.post('/api/invoices', authenticateToken, async (req, res) => {
    try {
        const newInvoice = await db.saveInvoice(req.user.id, req.body);
        res.status(201).json(newInvoice);
    } catch (error) {
        console.error('Save invoice error:', error);
        res.status(500).json({ error: 'Error saving invoice' });
    }
});

app.put('/api/invoices/:id', authenticateToken, async (req, res) => {
    try {
        const updatedInvoice = await db.updateInvoice(req.user.id, Number(req.params.id), req.body);
        res.json(updatedInvoice);
    } catch (error) {
        console.error('Update invoice error:', error);
        res.status(500).json({ error: 'Error updating invoice' });
    }
});

// Razorpay Payments API
app.post('/api/payments/create-order', authenticateToken, async (req, res) => {
    const { invoiceId } = req.body;
    if (!invoiceId) {
        return res.status(400).json({ error: 'Invoice ID is required' });
    }

    try {
        const invoice = await db.getInvoiceById(invoiceId, req.user.id);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found or unauthorized' });
        }

        if (invoice.status === 'Paid') {
            return res.status(400).json({ error: 'Invoice is already paid' });
        }

        const amountInPaise = Math.round(invoice.total * 100);

        if (amountInPaise <= 0) {
            return res.status(400).json({ error: 'Invoice amount must be greater than zero to pay' });
        }

        if (razorpayInstance) {
            // Live/Real Razorpay Mode
            const options = {
                amount: amountInPaise,
                currency: 'INR',
                receipt: `receipt_inv_${invoice.id}_${Date.now()}`,
                payment_capture: 1
            };

            const order = await razorpayInstance.orders.create(options);
            await db.recordPaymentOrder(invoice.id, order.id, invoice.total);

            res.json({
                mode: 'live',
                key: process.env.RAZORPAY_KEY_ID,
                orderId: order.id,
                amount: amountInPaise,
                currency: 'INR',
                invoiceNumber: invoice.invoice_number,
                clientName: invoice.client_name,
                clientEmail: invoice.client_email,
                clientPhone: invoice.client_phone
            });
        } else {
            // Mock Mode Fallback
            const mockOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
            await db.recordPaymentOrder(invoice.id, mockOrderId, invoice.total);

            res.json({
                mode: 'mock',
                key: 'rzp_test_mock_mode_key_id',
                orderId: mockOrderId,
                amount: amountInPaise,
                currency: 'INR',
                invoiceNumber: invoice.invoice_number,
                clientName: invoice.client_name,
                clientEmail: invoice.client_email,
                clientPhone: invoice.client_phone
            });
        }
    } catch (error) {
        console.error('Payment order creation error:', error);
        res.status(500).json({ error: 'Error generating payment order' });
    }
});

app.post('/api/payments/verify-payment', authenticateToken, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id) {
        return res.status(400).json({ error: 'Payment details are missing' });
    }

    try {
        if (razorpay_order_id.startsWith('order_mock_')) {
            // Fulfill mock transaction instantly
            const invoiceId = await db.fulfillPayment(razorpay_order_id, razorpay_payment_id || 'pay_mock_12345', razorpay_signature || 'sig_mock_12345');
            return res.json({ success: true, message: 'Mock payment verified successfully', invoiceId });
        }

        if (!isRazorpayConfigured || !razorpayInstance) {
            return res.status(500).json({ error: 'Razorpay keys not configured' });
        }

        // Verify Razorpay signature
        const secret = process.env.RAZORPAY_KEY_SECRET;
        const generatedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment signature mismatch. Transaction is invalid.' });
        }

        // Fulfill database transaction
        const invoiceId = await db.fulfillPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        res.json({ success: true, message: 'Payment verified and captured successfully', invoiceId });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ error: 'Error verifying payment signature' });
    }
});

// Single-page App Routing Fallback
// Direct all non-API paths to serve the public frontend index.html
app.get('*', (req, res, next) => {
    // Exclude API paths from redirecting to index.html
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 Handler for APIs
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

// Initialize database and start server
db.initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});
