let currentMode = "login";
let invoiceHistory = [];
let editInvoiceId = null;

// Base API URL and Fetch Wrapper
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("hisabkitab_token");
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }
    return response.json();
}

async function fetchInvoices() {
    try {
        invoiceHistory = await apiFetch('/api/invoices');
    } catch (err) {
        console.error("Failed to fetch invoices:", err);
    }
}

async function fetchNextInvoiceNumber() {
    try {
        const res = await apiFetch('/api/invoices/next-number');
        document.getElementById("invoice-number").value = res.nextNumber;
        updatePreview();
    } catch (err) {
        console.error("Failed to fetch next invoice number:", err);
    }
}

// Routing Management (Solves the browser back button issue)
function navigate(path) {
    window.history.pushState({}, "", path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    const loggedIn = localStorage.getItem("hisabkitab_logged_in") === "true";

    if (path !== '/' && !loggedIn) {
        // Redirect unauthorized user to landing page
        window.history.replaceState({}, "", "/");
        showPublicSite();
        return;
    }

    if (path === '/') {
        if (loggedIn) {
            window.history.replaceState({}, "", "/dashboard");
            showAppShell();
            showStartScreen();
            return;
        }
        closeAuthModal();
        closeGeneratorModal();
        showPublicSite();
    } else if (path === '/dashboard') {
        closeGeneratorModal();
        showAppShell();
        showStartScreen();
    } else if (path === '/history') {
        closeGeneratorModal();
        showAppShell();
        showHistoryScreen();
    } else if (path === '/generator') {
        showAppShell();
        // Open the generator modal
        document.getElementById("generator-screen").classList.remove("hidden-area");
        document.body.classList.add("modal-open");

        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');
        if (editId) {
            const idNum = Number(editId);
            if (editInvoiceId !== idNum) {
                loadInvoiceForEdit(idNum);
            }
        } else {
            if (editInvoiceId !== null) {
                clearInvoiceForm();
            } else if (!document.getElementById("invoice-number").value) {
                fetchNextInvoiceNumber();
            }
        }
        updatePreview();
    } else {
        window.history.replaceState({}, "", "/");
        showPublicSite();
    }
}

window.addEventListener('popstate', handleRoute);

// Theme Toggle
function setupThemeToggle() {
    const toggleButton = document.getElementById("theme-toggle");
    const savedTheme = localStorage.getItem("hisabkitab_theme") || "dark";

    if (savedTheme === "light") {
        document.body.classList.remove("dark-mode");
        document.body.classList.add("light-mode");
        toggleButton.textContent = "Dark Mode";
    } else {
        document.body.classList.remove("light-mode");
        document.body.classList.add("dark-mode");
        toggleButton.textContent = "Light Mode";
    }

    toggleButton.addEventListener("click", () => {
        const isLight = document.body.classList.contains("light-mode");

        if (isLight) {
            document.body.classList.remove("light-mode");
            document.body.classList.add("dark-mode");
            localStorage.setItem("hisabkitab_theme", "dark");
            toggleButton.textContent = "Light Mode";
        } else {
            document.body.classList.remove("dark-mode");
            document.body.classList.add("light-mode");
            localStorage.setItem("hisabkitab_theme", "light");
            toggleButton.textContent = "Dark Mode";
        }
    });
}

// Authentication Modal and Form handling
function openAuthModal(mode) {
    currentMode = mode;
    document.getElementById("auth-modal").classList.remove("hidden-area");
    document.body.classList.add("modal-open");
    switchAuthMode(mode);
}

function closeAuthModal() {
    document.getElementById("auth-modal").classList.add("hidden-area");
    document.body.classList.remove("modal-open");
}

function switchAuthMode(mode) {
    currentMode = mode;
    const signupFields = document.getElementById("signup-fields");
    const loginTab = document.getElementById("login-tab");
    const signupTab = document.getElementById("signup-tab");
    const authSubmit = document.getElementById("auth-submit");
    const authMessage = document.getElementById("auth-message");

    if (mode === "signup") {
        signupFields.classList.remove("hidden-area");
        signupTab.classList.add("active");
        loginTab.classList.remove("active");
        authSubmit.textContent = "Create Account";
    } else {
        signupFields.classList.add("hidden-area");
        loginTab.classList.add("active");
        signupTab.classList.remove("active");
        authSubmit.textContent = "Login";
    }

    authMessage.textContent = "";
}

function setupAuth() {
    const loginBtn = document.getElementById("login-btn");
    const signupBtn = document.getElementById("signup-btn");
    const closeBtn = document.getElementById("close-auth-modal");
    const backdrop = document.getElementById("auth-backdrop");
    const showPassword = document.getElementById("show-password");
    const passwordInput = document.getElementById("user-password");
    const resetAccount = document.getElementById("reset-account");
    const authForm = document.getElementById("auth-form");
    const emailInput = document.getElementById("user-email");
    const loginTab = document.getElementById("login-tab");
    const signupTab = document.getElementById("signup-tab");

    loginBtn.addEventListener("click", () => openAuthModal("login"));
    signupBtn.addEventListener("click", () => openAuthModal("signup"));
    closeBtn.addEventListener("click", closeAuthModal);
    backdrop.addEventListener("click", closeAuthModal);
    loginTab.addEventListener("click", () => switchAuthMode("login"));
    signupTab.addEventListener("click", () => switchAuthMode("signup"));

    showPassword.addEventListener("change", () => {
        passwordInput.type = showPassword.checked ? "text" : "password";
    });

    resetAccount.addEventListener("click", () => {
        localStorage.removeItem("hisabkitab_user");
        localStorage.removeItem("hisabkitab_logged_in");
        localStorage.removeItem("hisabkitab_token");
        authForm.reset();
        showPassword.checked = false;
        passwordInput.type = "password";
        switchAuthMode("signup");
        document.getElementById("auth-message").textContent = "Saved session cleared. Please sign up again.";
        navigate('/');
    });

    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const firstName = document.getElementById("first-name").value.trim();
        const lastName = document.getElementById("last-name").value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;
        const authMessage = document.getElementById("auth-message");

        if (currentMode === "signup") {
            if (!firstName || !lastName || !email || !password) {
                authMessage.textContent = "Please fill all sign up details.";
                return;
            }

            try {
                authMessage.textContent = "Creating account...";
                await apiFetch('/api/auth/signup', {
                    method: 'POST',
                    body: JSON.stringify({ firstName, lastName, email, password })
                });

                authForm.reset();
                emailInput.value = email;
                switchAuthMode("login");
                authMessage.textContent = `Account created successfully for ${email}. Please log in.`;
            } catch (err) {
                authMessage.textContent = err.message;
            }
            return;
        }

        // Login Mode
        try {
            authMessage.textContent = "Verifying...";
            const res = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            localStorage.setItem("hisabkitab_token", res.token);
            localStorage.setItem("hisabkitab_logged_in", "true");
            localStorage.setItem("hisabkitab_user", JSON.stringify(res.user));

            authForm.reset();
            closeAuthModal();
            
            // Pre-fetch invoices
            await fetchInvoices();
            await fetchNextInvoiceNumber();
            navigate('/dashboard');
        } catch (err) {
            authMessage.textContent = err.message;
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAuthModal();
        }
    });
}

function showAppShell() {
    document.getElementById("public-site").classList.add("hidden-area");
    document.getElementById("app-shell").classList.remove("hidden-area");
}

function showPublicSite() {
    document.getElementById("app-shell").classList.add("hidden-area");
    document.getElementById("public-site").classList.remove("hidden-area");
}

function showStartScreen() {
    setActiveSidebar("nav-new-invoice");
    document.getElementById("start-screen").classList.remove("hidden-area");
    document.getElementById("generator-screen").classList.add("hidden-area");
    document.getElementById("history-screen").classList.add("hidden-area");
}

function openGeneratorModal() {
    document.getElementById("generator-screen").classList.remove("hidden-area");
    document.body.classList.add("modal-open");
    updatePreview();
}

function closeGeneratorModal() {
    document.getElementById("generator-screen").classList.add("hidden-area");
    document.body.classList.remove("modal-open");
}

function showGeneratorScreen() {
    setActiveSidebar("nav-new-invoice");
    document.getElementById("start-screen").classList.add("hidden-area");
    document.getElementById("history-screen").classList.add("hidden-area");
}

function showHistoryScreen() {
    setActiveSidebar("nav-history");
    document.getElementById("start-screen").classList.add("hidden-area");
    document.getElementById("generator-screen").classList.add("hidden-area");
    document.getElementById("history-screen").classList.remove("hidden-area");
    renderHistory();
}

function setActiveSidebar(activeId) {
    document.querySelectorAll(".sidebar-link").forEach((button) => {
        button.classList.toggle("active", button.id === activeId);
    });
}

function createItemRow(item = {}) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
        <input type="text" class="item-name" placeholder="Item or Service Name" value="${item.name || ""}">
        <input type="number" class="item-qty" placeholder="Quantity" min="1" step="1" value="${item.qty || ""}">
        <input type="number" class="item-price" placeholder="Price per item" min="0" step="0.01" value="${item.price || ""}">
        <button class="remove-item-btn" type="button">Remove</button>
    `;

    row.querySelector(".remove-item-btn").addEventListener("click", () => {
        const container = document.getElementById("items-container");
        if (container.children.length > 1) {
            row.remove();
            updatePreview();
        }
    });

    row.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", updatePreview);
    });

    return row;
}

function getItemRowsData() {
    return Array.from(document.querySelectorAll(".item-row")).map((row) => {
        const name = row.querySelector(".item-name").value.trim();
        const qty = Number(row.querySelector(".item-qty").value) || 0;
        const price = Number(row.querySelector(".item-price").value) || 0;
        return { name, qty, price, total: qty * price };
    });
}

function calculateTotals() {
    const items = getItemRowsData();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxPercentage = Number(document.getElementById("tax-percentage").value) || 0;
    const discount = Number(document.getElementById("discount").value) || 0;
    const taxAmount = subtotal * (taxPercentage / 100);
    const total = Math.max(subtotal + taxAmount - discount, 0);
    return { items, subtotal, taxPercentage, taxAmount, discount, total };
}

function updatePreview() {
    const defaults = {
        "company-name": "Company Name",
        "company-email": "company@email.com",
        "company-phone": "Company Phone",
        "company-address": "Company Address",
        "client-name": "Client Name",
        "client-email": "client@email.com",
        "client-phone": "Client Phone",
        "invoice-number": "INV-1001",
        "payment-method": "-",
        "payment-details": "-",
        notes: "-"
    };

    Object.keys(defaults).forEach((id) => {
        const input = document.getElementById(id);
        const preview = document.getElementById(`preview-${id}`);
        if (input && preview) {
            preview.textContent = input.value.trim() || defaults[id];
        }
    });

    document.getElementById("preview-invoice-date").textContent = document.getElementById("invoice-date").value || "-";
    document.getElementById("preview-due-date").textContent = document.getElementById("due-date").value || "-";
    document.getElementById("preview-invoice-status").textContent = document.getElementById("invoice-status").value || "Pending";

    const totals = calculateTotals();
    document.getElementById("subtotal").textContent = totals.subtotal.toFixed(2);
    document.getElementById("tax-amount").textContent = totals.taxAmount.toFixed(2);
    document.getElementById("discount-amount").textContent = totals.discount.toFixed(2);
    document.getElementById("grand-total").textContent = totals.total.toFixed(2);
    document.getElementById("preview-grand-total").textContent = totals.total.toFixed(2);

    const previewBody = document.getElementById("preview-items-body");
    const validItems = totals.items.filter((item) => item.name || item.qty || item.price);

    if (!validItems.length) {
        previewBody.innerHTML = `
            <tr>
                <td>Service</td>
                <td>1</td>
                <td>Rs 0.00</td>
                <td>Rs 0.00</td>
            </tr>
        `;
        return;
    }

    previewBody.innerHTML = validItems.map((item) => `
        <tr>
            <td>${item.name || "-"}</td>
            <td>${item.qty}</td>
            <td>Rs ${item.price.toFixed(2)}</td>
            <td>Rs ${item.total.toFixed(2)}</td>
        </tr>
    `).join("");
}

function clearInvoiceForm() {
    document.getElementById("invoice-form").reset();
    document.getElementById("items-container").innerHTML = "";
    document.getElementById("items-container").appendChild(createItemRow());
    if (localStorage.getItem("hisabkitab_logged_in") === "true") {
        fetchNextInvoiceNumber();
    }
    document.getElementById("invoice-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("invoice-status").value = "Pending";
    editInvoiceId = null;
    updatePreview();
}

function validateInvoice() {
    const requiredIds = [
        "company-name",
        "company-email",
        "company-phone",
        "company-address",
        "client-name",
        "client-email",
        "client-phone",
        "invoice-number",
        "invoice-date",
        "due-date",
        "invoice-status",
        "payment-method",
        "payment-details"
    ];

    for (const id of requiredIds) {
        const inputEl = document.getElementById(id);
        if (!inputEl) {
            alert(`Development error: Input field with ID '${id}' not found in HTML.`);
            return false;
        }
        if (!inputEl.value.trim()) {
            const fieldLabel = inputEl.placeholder || inputEl.id;
            alert(`Please fill all required invoice details. Missing: ${fieldLabel}`);
            return false;
        }
    }

    const items = getItemRowsData().filter((item) => item.name && item.qty > 0 && item.price >= 0);
    if (!items.length) {
        alert("Please add at least one valid item row (ensure item name, quantity, and price are filled).");
        return false;
    }

    return true;
}

function collectInvoiceData() {
    const totals = calculateTotals();
    return {
        companyName: document.getElementById("company-name").value.trim(),
        companyEmail: document.getElementById("company-email").value.trim(),
        companyPhone: document.getElementById("company-phone").value.trim(),
        companyAddress: document.getElementById("company-address").value.trim(),
        clientName: document.getElementById("client-name").value.trim(),
        clientEmail: document.getElementById("client-email").value.trim(),
        clientPhone: document.getElementById("client-phone").value.trim(),
        invoiceNumber: document.getElementById("invoice-number").value.trim(),
        invoiceDate: document.getElementById("invoice-date").value,
        dueDate: document.getElementById("due-date").value,
        status: document.getElementById("invoice-status").value,
        items: totals.items.filter((item) => item.name && item.qty > 0),
        taxPercentage: Number(document.getElementById("tax-percentage").value) || 0,
        discount: Number(document.getElementById("discount").value) || 0,
        notes: document.getElementById("notes").value.trim(),
        paymentMethod: document.getElementById("payment-method").value.trim(),
        paymentDetails: document.getElementById("payment-details").value.trim(),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        savedAt: new Date().toLocaleDateString("en-IN")
    };
}

function downloadInvoiceFile() {
    const invoiceNumber = document.getElementById("invoice-number").value.trim() || "invoice";
    const invoiceDate = document.getElementById("invoice-date").value || "-";
    const dueDate = document.getElementById("due-date").value || "-";
    const companyName = document.getElementById("company-name").value.trim() || "Company Name";
    const companyEmail = document.getElementById("company-email").value.trim() || "company@email.com";
    const companyPhone = document.getElementById("company-phone").value.trim() || "Company Phone";
    const companyAddress = document.getElementById("company-address").value.trim() || "Company Address";
    const clientName = document.getElementById("client-name").value.trim() || "Client Name";
    const clientEmail = document.getElementById("client-email").value.trim() || "client@email.com";
    const clientPhone = document.getElementById("client-phone").value.trim() || "Client Phone";
    const paymentMethod = document.getElementById("payment-method").value.trim() || "-";
    const paymentDetails = document.getElementById("payment-details").value.trim() || "-";
    const notes = document.getElementById("notes").value.trim() || "-";
    const totals = calculateTotals();
    const items = totals.items.filter((item) => item.name && item.qty > 0);

    if (!items.length) {
        alert("Please add at least one item before downloading the invoice.");
        return;
    }

    const itemsRows = items.map((item) => `
        <tr>
            <td>${item.name}</td>
            <td>${item.qty}</td>
            <td>Rs ${item.price.toFixed(2)}</td>
            <td>Rs ${item.total.toFixed(2)}</td>
        </tr>
    `).join("");

    const documentHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${invoiceNumber}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 32px;
            background: #f8fafc;
            color: #1f2937;
        }
        .invoice-sheet {
            max-width: 920px;
            margin: 0 auto;
            background: #ffffff;
            color: #1f2937;
            border: 1px solid #dbe4f0;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
        }
        .topbar {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            align-items: flex-start;
            margin-bottom: 24px;
        }
        .brand h1 {
            margin: 0 0 8px;
            font-size: 32px;
            color: #4c1d95;
        }
        .brand p,
        .meta p,
        .party-card p,
        .notes-box p,
        .payment-box p {
            margin: 6px 0;
            color: #475569;
            line-height: 1.6;
        }
        .meta {
            min-width: 230px;
            padding: 18px;
            border-radius: 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
        }
        .rule {
            border: 0;
            border-top: 1px solid #e5e7eb;
            margin: 28px 0;
        }
        .parties {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
            margin-bottom: 28px;
        }
        .party-card,
        .notes-box,
        .payment-box,
        .totals-box-export {
            padding: 20px;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
        }
        .party-card h3,
        .notes-box h3,
        .payment-box h3 {
            margin: 0 0 10px;
            font-size: 16px;
            color: #0f172a;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
        }
        .items-table th,
        .items-table td {
            padding: 14px 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        .items-table th {
            background: #f8fafc;
            color: #334155;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 18px;
            margin-top: 24px;
        }
        .totals-box-export div {
            display: flex;
            justify-content: space-between;
            gap: 14px;
            padding: 10px 0;
            color: #475569;
        }
        .totals-box-export .grand {
            border-top: 1px solid #e2e8f0;
            margin-top: 4px;
            padding-top: 14px;
            font-weight: 700;
            color: #0f172a;
        }
        .footer-note {
            margin-top: 28px;
            text-align: center;
            color: #64748b;
            font-size: 13px;
        }
        @media print {
            body {
                background: #ffffff;
                padding: 0;
            }
            .invoice-sheet {
                border: 0;
                box-shadow: none;
                border-radius: 0;
                padding: 0;
            }
        }
        @media (max-width: 700px) {
            .topbar,
            .parties,
            .summary-grid {
                grid-template-columns: 1fr;
                display: grid;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-sheet">
        <div class="topbar">
            <div class="brand">
                <h1>${companyName}</h1>
                <p>${companyEmail}</p>
                <p>${companyPhone}</p>
                <p>${companyAddress}</p>
            </div>
            <div class="meta">
                <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
                <p><strong>Due Date:</strong> ${dueDate}</p>
            </div>
        </div>

        <hr class="rule">

        <div class="parties">
            <div class="party-card">
                <h3>Bill To</h3>
                <p><strong>${clientName}</strong></p>
                <p>${clientEmail}</p>
                <p>${clientPhone}</p>
            </div>
            <div class="payment-box">
                <h3>Payment Details</h3>
                <p><strong>Method:</strong> ${paymentMethod}</p>
                <p><strong>Bank / UPI:</strong> ${paymentDetails}</p>
            </div>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRows}
            </tbody>
        </table>

        <div class="summary-grid">
            <div class="notes-box">
                <h3>Notes</h3>
                <p>${notes}</p>
            </div>
            <div class="totals-box-export">
                <div><span>Subtotal</span><strong>Rs ${totals.subtotal.toFixed(2)}</strong></div>
                <div><span>Tax</span><strong>Rs ${totals.taxAmount.toFixed(2)}</strong></div>
                <div><span>Discount</span><strong>Rs ${totals.discount.toFixed(2)}</strong></div>
                <div class="grand"><span>Total</span><strong>Rs ${totals.total.toFixed(2)}</strong></div>
            </div>
        </div>

        <p class="footer-note">Generated by Hisab Kitab</p>
    </div>
</body>
</html>`;

    const blob = new Blob([documentHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceNumber}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function saveInvoice() {
    if (!validateInvoice()) {
        return;
    }

    const invoice = collectInvoiceData();

    try {
        if (editInvoiceId) {
            await apiFetch(`/api/invoices/${editInvoiceId}`, {
                method: 'PUT',
                body: JSON.stringify(invoice)
            });
            alert("Invoice updated successfully.");
        } else {
            await apiFetch('/api/invoices', {
                method: 'POST',
                body: JSON.stringify(invoice)
            });
            alert("Invoice saved successfully.");
        }
        
        await fetchInvoices();
        clearInvoiceForm();
        navigate('/history');
    } catch (error) {
        alert("Error saving invoice: " + error.message);
    }
}

function renderHistory() {
    const historyBody = document.getElementById("history-body");
    const searchValue = (document.getElementById("history-search")?.value || "").trim().toLowerCase();
    const statusFilter = document.getElementById("history-status-filter")?.value || "All";
    const filteredHistory = invoiceHistory.filter((invoice) => {
        const matchesSearch =
            !searchValue ||
            invoice.invoiceNumber.toLowerCase().includes(searchValue) ||
            invoice.clientName.toLowerCase().includes(searchValue);
        const matchesStatus = statusFilter === "All" || (invoice.status || "Pending") === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (!filteredHistory.length) {
        historyBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No matching invoices found.</td></tr>';
        return;
    }

    historyBody.innerHTML = filteredHistory.map((invoice) => `
        <tr>
            <td>${invoice.invoiceNumber}</td>
            <td>${invoice.clientName}</td>
            <td><span class="status-badge ${(invoice.status || "Pending").toLowerCase()}">${invoice.status || "Pending"}</span></td>
            <td>Rs ${invoice.total.toFixed(2)}</td>
            <td>${invoice.savedAt}</td>
            <td>
                <div class="action-buttons-group">
                    <button class="nav-btn secondary history-edit-btn" type="button" data-id="${invoice.id}">Edit</button>
                    ${(invoice.status || "Pending") !== "Paid" ? `<button class="nav-btn primary history-pay-btn" type="button" data-id="${invoice.id}">Pay</button>` : ''}
                </div>
            </td>
        </tr>
    `).join("");

    historyBody.querySelectorAll(".history-edit-btn").forEach((button) => {
        button.addEventListener("click", () => {
            navigate(`/generator?edit=${button.dataset.id}`);
        });
    });

    historyBody.querySelectorAll(".history-pay-btn").forEach((button) => {
        button.addEventListener("click", () => {
            payInvoice(Number(button.dataset.id));
        });
    });
}

async function loadInvoiceForEdit(id) {
    let invoice = invoiceHistory.find((item) => item.id === id);
    if (!invoice) {
        try {
            invoice = await apiFetch(`/api/invoices/${id}`);
        } catch (err) {
            console.error("Error loading invoice for edit:", err);
            alert("Could not load invoice data.");
            navigate('/history');
            return;
        }
    }

    editInvoiceId = invoice.id;
    document.getElementById("company-name").value = invoice.companyName || '';
    document.getElementById("company-email").value = invoice.companyEmail || '';
    document.getElementById("company-phone").value = invoice.companyPhone || '';
    document.getElementById("company-address").value = invoice.companyAddress || '';
    document.getElementById("client-name").value = invoice.clientName || '';
    document.getElementById("client-email").value = invoice.clientEmail || '';
    document.getElementById("client-phone").value = invoice.clientPhone || '';
    document.getElementById("invoice-number").value = invoice.invoiceNumber || '';
    document.getElementById("invoice-date").value = invoice.invoiceDate || '';
    document.getElementById("due-date").value = invoice.dueDate || '';
    document.getElementById("invoice-status").value = invoice.status || "Pending";
    document.getElementById("tax-percentage").value = invoice.taxPercentage || 0;
    document.getElementById("discount").value = invoice.discount || 0;
    document.getElementById("notes").value = invoice.notes || '';
    document.getElementById("payment-method").value = invoice.paymentMethod || '';
    document.getElementById("payment-details").value = invoice.paymentDetails || '';

    const itemsContainer = document.getElementById("items-container");
    itemsContainer.innerHTML = "";
    if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((item) => itemsContainer.appendChild(createItemRow(item)));
    } else {
        itemsContainer.appendChild(createItemRow());
    }

    updatePreview();
}

// Razorpay checkout opening and confirmation
async function payInvoice(invoiceId) {
    try {
        const orderData = await apiFetch('/api/payments/create-order', {
            method: 'POST',
            body: JSON.stringify({ invoiceId })
        });

        if (orderData.mode === 'mock') {
            const confirmPay = confirm(`[Mock Mode] Pay Rs ${(orderData.amount / 100).toFixed(2)} for Invoice ${orderData.invoiceNumber}?`);
            if (confirmPay) {
                const verifyRes = await apiFetch('/api/payments/verify-payment', {
                    method: 'POST',
                    body: JSON.stringify({
                        razorpay_order_id: orderData.orderId,
                        razorpay_payment_id: 'pay_mock_' + Math.random().toString(36).substr(2, 9),
                        razorpay_signature: 'sig_mock_verified'
                    })
                });
                if (verifyRes.success) {
                    alert("Payment successful (Mock Mode)!");
                    await fetchInvoices();
                    renderHistory();
                } else {
                    alert("Payment verification failed.");
                }
            }
            return;
        }

        // Real Razorpay Mode checkout configuration
        const options = {
            key: orderData.key,
            amount: orderData.amount,
            currency: orderData.currency,
            name: "Hisab Kitab",
            description: `Payment for Invoice ${orderData.invoiceNumber}`,
            order_id: orderData.orderId,
            handler: async function (response) {
                try {
                    const verifyRes = await apiFetch('/api/payments/verify-payment', {
                        method: 'POST',
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });
                    if (verifyRes.success) {
                        alert("Payment successful! Invoice status updated to Paid.");
                        await fetchInvoices();
                        renderHistory();
                    } else {
                        alert("Payment verification failed.");
                    }
                } catch (err) {
                    alert("Payment verification error: " + err.message);
                }
            },
            prefill: {
                name: orderData.clientName,
                email: orderData.clientEmail,
                contact: orderData.clientPhone
            },
            theme: {
                color: "#1d74d6"
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response){
            alert("Payment failed: " + response.error.description);
        });
        rzp.open();
    } catch (err) {
        alert("Payment initialization error: " + err.message);
    }
}

function setupInvoiceApp() {
    const itemsContainer = document.getElementById("items-container");
    const addItemBtn = document.getElementById("add-item-btn");
    const startGeneratorBtn = document.getElementById("start-generator-btn");
    const newInvoiceBtn = document.getElementById("nav-new-invoice");
    const historyBtn = document.getElementById("nav-history");
    const logoutBtn = document.getElementById("logout-btn");
    const clearFormBtn = document.getElementById("clear-form-btn");
    const saveBtn = document.getElementById("save-invoice-btn");
    const printBtn = document.getElementById("print-btn");
    const downloadBtn = document.getElementById("download-btn");
    const closeGeneratorBtn = document.getElementById("close-generator-modal");
    const generatorBackdrop = document.getElementById("generator-backdrop");
    const historySearch = document.getElementById("history-search");
    const historyStatusFilter = document.getElementById("history-status-filter");

    itemsContainer.appendChild(createItemRow());

    if (localStorage.getItem("hisabkitab_logged_in") === "true") {
        fetchNextInvoiceNumber();
    }
    document.getElementById("invoice-date").value = new Date().toISOString().split("T")[0];

    addItemBtn.addEventListener("click", () => {
        itemsContainer.appendChild(createItemRow());
    });

    startGeneratorBtn.addEventListener("click", () => navigate('/generator'));
    newInvoiceBtn.addEventListener("click", () => {
        clearInvoiceForm();
        navigate('/generator');
    });
    historyBtn.addEventListener("click", () => navigate('/history'));
    
    closeGeneratorBtn.addEventListener("click", () => {
        // Go back in router
        window.history.back();
    });
    generatorBackdrop.addEventListener("click", () => {
        window.history.back();
    });

    logoutBtn.addEventListener("click", () => {
        localStorage.setItem("hisabkitab_logged_in", "false");
        localStorage.removeItem("hisabkitab_token");
        localStorage.removeItem("hisabkitab_user");
        closeGeneratorModal();
        navigate('/');
    });
    clearFormBtn.addEventListener("click", clearInvoiceForm);
    saveBtn.addEventListener("click", saveInvoice);
    printBtn.addEventListener("click", () => window.print());
    downloadBtn.addEventListener("click", downloadInvoiceFile);

    [
        "company-name",
        "company-email",
        "company-phone",
        "company-address",
        "client-name",
        "client-email",
        "client-phone",
        "invoice-number",
        "invoice-date",
        "due-date",
        "invoice-status",
        "tax-percentage",
        "discount",
        "notes",
        "payment-method",
        "payment-details"
    ].forEach((id) => {
        document.getElementById(id).addEventListener("input", updatePreview);
    });

    historySearch.addEventListener("input", renderHistory);
    historyStatusFilter.addEventListener("change", renderHistory);

    // Make branding elements clickable to navigate
    document.querySelectorAll(".brand-lockup").forEach((el) => {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
            if (localStorage.getItem("hisabkitab_logged_in") === "true") {
                navigate('/dashboard');
            } else {
                navigate('/');
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !document.getElementById("generator-screen").classList.contains("hidden-area")) {
            window.history.back();
        }
    });

    updatePreview();
}

window.onload = async () => {
    setupThemeToggle();
    setupAuth();
    setupInvoiceApp();

    const loggedIn = localStorage.getItem("hisabkitab_logged_in") === "true";
    if (loggedIn) {
        await fetchInvoices();
    }

    handleRoute();
};
