# Hisab Kitab - Invoice Generator

Hisab Kitab is a responsive invoice generator website built for freelancers, students, and small businesses who want a simple way to create, preview, save, edit, and download invoices.

The project starts as a polished landing page and opens into a dashboard-style invoice workspace after login. It includes invoice history, status tracking, live preview, multiple item rows, automatic calculations, and a formatted invoice export.

## Live Project Idea

This project is designed as a practical invoice generator product with:

- a welcome landing page
- login and sign up flow
- dashboard workspace
- invoice generator popup
- invoice history with search and filter
- invoice status tracking

## Features

- User signup and login using browser `localStorage`
- Dark and light mode toggle
- Responsive landing page
- Welcome section with animated title
- Step guide section image
- Invoice preview guide section image
- FAQ section
- Dashboard after login
- Left sidebar navigation
- Start screen before opening generator
- Invoice generator modal popup
- Company and client details
- Invoice number auto generation
- Invoice date and due date
- Invoice status: `Pending`, `Paid`, `Unpaid`
- Multiple item/service rows
- Automatic subtotal, tax, discount, and total calculation
- Live invoice preview
- Notes and payment details
- Save invoice
- Edit invoice from history
- Search invoice history by client or invoice number
- Filter invoice history by status
- Print invoice
- Download formatted invoice file

## Tech Stack

- HTML
- CSS
- JavaScript
- LocalStorage for temporary browser-based data handling

## Project Structure

```text
assets/
index.html
style.css
script.js
README.md
```

## How It Works

1. Open the landing page.
2. Sign up with basic user details.
3. Log in with the same account.
4. Enter the dashboard and click `Start Here`.
5. Fill invoice details in the generator.
6. Add multiple items if needed.
7. Preview totals automatically.
8. Save the invoice to history.
9. Edit saved invoices from history.
10. Print or download the invoice.

## Main Modules

### Landing Page

The landing page contains:

- site branding
- login and signup buttons
- dark/light mode
- step-by-step section
- preview section
- FAQ section

### Authentication

Authentication is currently browser-based and uses `localStorage`. It is suitable for front-end demonstration projects and portfolio use.

### Invoice Generator

The invoice generator includes:

- company information
- client information
- invoice details
- item rows
- tax and discount
- payment method and UPI/bank details
- notes
- status selection

### History

The history section allows users to:

- view saved invoices
- search invoices
- filter by status
- edit any saved invoice

## Current Limitations

- Authentication is not backend-based
- Data is stored only in the browser
- Download is HTML export, not true PDF generation
- No database integration yet
- No secure production auth system yet

## Future Improvements

- Add backend authentication
- Connect to a real database
- Add true PDF export
- Add invoice delete option
- Add paid/unpaid analytics cards
- Add client management section
- Add invoice sharing by email
- Deploy live on the web

## Why This Project Is Useful

This project is useful as a portfolio project because it shows:

- front-end UI design
- real-world product thinking
- form handling
- data storage
- filtering and editing workflows
- responsive design
- practical business use case

## Author

Created by Riya Singh

GitHub Repo:
`https://github.com/Singhhriya94/HisabKitab-invoice-generator`
