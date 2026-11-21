# Online Food Delivery System — Team 12

A web application for an online food delivery service. Users can browse and
search menu items, add and edit customers, place orders, update order status,
edit menu items, and view sales reports — all through the browser, backed by a
MySQL database.

**Demo video:** _add link here_ (≤ 7 minutes)

---

## Features

| Requirement             | Where in the app                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| View and search         | **Menu** (keyword, restaurant, price range, availability) · **Orders** (customer, status, restaurant, date range) · **Customers** (name, email, phone)                                                 |
| Insert                  | **Customers → + Add customer** (CUSTOMER) · **Orders → + Place order** (ORDERS + ORDER_ITEM in one transaction)                                                                                        |
| Update                  | **Customers → Edit** (CUSTOMER) · **Orders → Update status** (ORDERS) · **Menu → Edit** (MENU_ITEM)                                                                                                    |
| Multiple-table query    | Order list joins 5 tables (ORDERS, CUSTOMER, RESTAURANT, ORDER_STATUS, ORDER_ITEM); order details join ORDER_ITEM + MENU_ITEM                                                                          |
| Summary reports         | **Reports:** revenue by restaurant, top-selling items, customer spending (`GROUP BY` with `COUNT`, `SUM`, `AVG`, `MAX`, `HAVING`)                                                                      |
| Validation and feedback | Checks in the browser **and** on the server; clear messages for missing input, invalid values, duplicate keys (MySQL 1062), invalid foreign keys (1452), and business rules; every form has **Cancel** |
| Mobile                  | Responsive layout, ☰ menu                                                                                                                                                                             |

All filtering, joins, and totals are done by MySQL. Every user-supplied value is
sent with a **parameterized query** (`?` placeholders).

---

## Prerequisites

| Software                                                         | Version tested                                            | Notes                  |
| ---------------------------------------------------------------- | --------------------------------------------------------- | ---------------------- |
| [Node.js](https://nodejs.org/)                                   | 22.16.0 (18 or newer works)                               | Includes `npm`         |
| [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) | 8.0.46 (8.0.16 or newer required for `CHECK` constraints) | Installed locally      |
| MySQL Workbench (optional)                                       | 8.0                                                       | to run the SQL scripts |
| Web browser                                                      | Chrome                                                    | Any modern browser     |

---

## Project structure

```
online-food-delivery-app/
├── database/
│   ├── schema.sql        # creates the database, tables, constraints, status lookup values
│   ├── seed.sql          # sample data (+ integrity check queries at the end)
│   └── queries.sql       # every SQL statement the app uses, for the report (safe to run)
├── server/
│   ├── index.js          # Express server: starts the app, routes, error handling
│   ├── DAO.js            # MySQL connection pool + parameterized query helper
│   ├── validators.js     # server-side input validation
│   ├── errors.js         # MySQL error codes -> clear user messages
│   ├── orderStatusRules.js  # allowed order status changes
│   ├── routes/           # API: customers, restaurants, menuItems, orders, orderStatuses, reports
│   ├── public/           # the web pages (HTML, CSS, JavaScript)
│   ├── test/api.test.js  # 31 automated API tests
│   ├── package.json      # dependencies: express, mysql2, dotenv
│   └── .env.example      # database settings template
├── docs/
│   ├── design.md         # final schema, changes from earlier design, FDs, 3NF
│   ├── er-diagram.svg    # ER diagram source file
│   ├── er-diagram.png    # ER diagram image
│   └── test-plan.md      # test cases and results
└── README.md
```

---

## Setup

### 1. Create the database

**MySQL Workbench**

1. Connect to your local MySQL server.
2. **File → Open SQL Script…** → `database/schema.sql` → click ⚡ **Execute All**.
3. **File → Open SQL Script…** → `database/seed.sql` → click ⚡ **Execute All**.
   The first result tab should show row counts **12, 7, 5, 39, 25, 62**.

### 2. Configure the database connection

```bash
cd server
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Open `server/.env` and set your MySQL password (and user/port if different):

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=food_delivery
PORT=3000
```

`.env` is excluded from Git, so the password is never committed.

### 3. Install dependencies

```bash
cd server
npm install
```

### 4. Start the application

```bash
npm start
```

Expected output:

```
Connected to MySQL 8.0.46, database "food_delivery"
Server running at http://localhost:3000
```

### 5. Open it in a browser

**http://localhost:3000**

---

## Running the automated tests

With the server running (`npm start`), open a second terminal:

```bash
cd server
npm test
```

Expected: `# tests 31`, `# pass 31`, `# fail 0`.
The tests never change data — they only read, or send requests that must be
rejected (missing/invalid input, duplicate keys, invalid foreign keys, business
rules) or that change nothing.

## Resetting the sample data

Run `database/schema.sql` and then `database/seed.sql` again.
