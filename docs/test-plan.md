# Test Plan — Online Food Delivery System (Team 12)

> Covers normal operations and the failure cases required by the assignment:
> missing input, invalid values, duplicate keys, invalid foreign keys, and
> confirming that changes are saved in MySQL.

## Test environment

| Item                         | Value                                                     |
| ---------------------------- | --------------------------------------------------------- |
| Operating system             | Windows 11 Home                                           |
| Browser                      | _fill in: e.g. Google Chrome 1xx / Microsoft Edge 1xx_    |
| Mobile device (extra credit) | _fill in in M11: device + browser_                        |
| Node.js                      | 22.16.0                                                   |
| MySQL                        | 8.0.46 Community Server                                   |
| Database state               | Fresh `schema.sql` + `seed.sql` before the final test run |

## How tests were run

- **A — Automated:** `npm test` in `server/` (31 API tests, Node's built-in test
  runner). The server must be running (`npm start`). These tests never change
  data: they only read, or send requests that must be rejected or change nothing.
- **M — Manual:** performed in the browser; persistence checked in MySQL
  Workbench with the SQL shown.

---

## 1. View and search

| ID  | Feature           | Steps / input                       | Expected result                                  | Type | Result |
| --- | ----------------- | ----------------------------------- | ------------------------------------------------ | ---- | ------ |
| S1  | Menu search       | Open **Menu**, no filters           | All 39 items with restaurant name (JOIN)         | M    | ✅     |
| S2  | Menu search       | Keyword `chicken`                   | Only items with "chicken" in name or description | A, M | ✅     |
| S3  | Menu search       | Restaurant = Sakura, Available only | Sakura's available items only                    | M    | ✅     |
| S4  | Menu search       | Min `10`, Max `15`                  | Only prices $10.00–$15.00                        | A, M | ✅     |
| S5  | Menu search       | Keyword `%`                         | Treated as text, not a wildcard (no rows)        | A    | ✅     |
| S6  | Order search      | Customer `chen`                     | Michael Chen's orders only                       | M    | ✅     |
| S7  | Order search      | Status = Delivered                  | Only Delivered orders                            | A, M | ✅     |
| S8  | Order search      | From = To = 11/16/2026              | Orders on that whole day (To is inclusive)       | A, M | ✅     |
| S9  | Customer search   | `lee`, then `2175550105`            | Grace Lee; Aisha Patel (phone without dashes)    | M    | ✅     |
| S10 | Customer search   | No filter                           | Customers with 0 orders still listed (LEFT JOIN) | A, M | ✅     |
| S11 | Customer → orders | Click "3 — view" on Michael Chen    | Orders page filtered to that customer            | M    | ✅     |

## 2. Insert

| ID  | Feature                    | Steps / input                                                           | Expected result                                                                     | Type           | Result |
| --- | -------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------- | ------ |
| I1  | Add customer               | Valid data                                                              | Green success, new row highlighted                                                  | M              | ✅     |
| I2  | Add customer — persistence | `SELECT * FROM CUSTOMER WHERE CustomerID = <new id>;` then refresh page | Row exists in MySQL and is still shown                                              | M              | ✅     |
| I3  | **Missing input**          | Save empty form                                                         | Message under all 5 fields; nothing saved                                           | A, M           | ✅     |
| I4  | **Invalid values**         | Name `J0hn`, phone `12`, email `abc`                                    | Field-specific messages; nothing saved                                              | A, M           | ✅     |
| I5  | **Duplicate key**          | Email of an existing customer (any letter case)                         | "A customer with this email address already exists." (MySQL 1062, UNIQUE)           | A, M           | ✅     |
| I6  | Cancel                     | Type, then Cancel → OK                                                  | Confirmation; "No customer was added."                                              | M              | ✅     |
| I7  | Place order                | Hannah Garcia, Taqueria El Sol, Burrito ×2 + Chips ×1                   | Success, total $31.25, status Placed                                                | M              | ✅     |
| I8  | Place order — persistence  | `SELECT * FROM ORDER_ITEM WHERE OrderID = <new id>;`                    | 2 rows; PriceAtOrderTime 12.25 and 6.75                                             | M              | ✅     |
| I9  | **Invalid foreign key**    | API: customerId 2147483647                                              | "The selected customer does not exist." (MySQL 1452); whole transaction rolled back | A              | ✅     |
| I10 | Business rule              | API: Golden Wok order with a Bella Napoli item                          | "…An order can only contain items from one restaurant." Nothing saved               | A, M (console) | ✅     |
| I11 | Unavailable item           | API: order containing Churros (unavailable)                             | "Churros is currently unavailable."                                                 | A              | ✅     |
| I12 | Missing input              | Place order with nothing selected / all quantities 0                    | Field messages; nothing saved                                                       | A, M           | ✅     |
| I13 | Invalid values             | Quantity 0, 100, 1.5, `true`, `""`                                      | Rejected with 400                                                                   | A              | ✅     |
| I14 | Cancel                     | Fill form, Cancel → OK                                                  | "No order was placed."                                                              | M              | ✅     |

## 3. Update

| ID  | Feature                      | Steps / input                                                                      | Expected result                                                 | Type | Result |
| --- | ---------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---- | ------ |
| U1  | Edit customer                | Change Lucas Anderson's phone and address                                          | Success; only row 12 changed                                    | M    | ✅     |
| U2  | Edit customer — persistence  | `SELECT CustomerID, PhoneNumber, Address FROM CUSTOMER;`                           | Only CustomerID 12 differs                                      | M    | ✅     |
| U3  | No change                    | Save without editing                                                               | "No changes were made"                                          | A, M | ✅     |
| U4  | **Duplicate key**            | Change email to another customer's                                                 | 409 "already exists" (MySQL 1062)                               | A, M | ✅     |
| U5  | Not found                    | API: PUT /api/customers/999999999                                                  | 404 "not found"                                                 | A    | ✅     |
| U6  | Order status                 | #31 Placed → Preparing                                                             | Success; dropdown then hides Placed                             | M    | ✅     |
| U7  | Order status — persistence   | `SELECT OrderID, StatusID FROM ORDERS WHERE OrderID = 31;`                         | StatusID = 2                                                    | M    | ✅     |
| U8  | Status rule                  | Delivered order → Placed (API/console)                                             | "Delivered orders are final and cannot be changed."             | A, M | ✅     |
| U9  | Status rule                  | Out for Delivery → Cancelled (API)                                                 | "…can no longer be cancelled."                                  | A    | ✅     |
| U10 | Edit menu item               | Margherita price 15.00 → 16.00                                                     | Success; order #1 still shows $14.00 paid                       | M    | ✅     |
| U11 | Edit menu item — persistence | `SELECT ItemID, Price, AvailabilityStatus FROM MENU_ITEM WHERE ItemID IN (7, 17);` | 16.00 and 1                                                     | M    | ✅     |
| U12 | **Duplicate key**            | Rename Margherita to `Pepperoni Pizza`                                             | 409 "already has a menu item with that name" (composite UNIQUE) | A, M | ✅     |
| U13 | Allowed duplicate            | Rename Sakura's Miso Soup to `Caesar Salad`                                        | Succeeds (unique per restaurant)                                | M    | ✅     |
| U14 | Invalid values               | Blank name, price `-5`                                                             | Field messages                                                  | A, M | ✅     |
| U15 | Cancel                       | Change a field, Cancel                                                             | "No changes were saved."                                        | M    | ✅     |

## 4. JOIN query and summary reports

| ID  | Feature              | Steps / input                             | Expected result                                                       | Type | Result |
| --- | -------------------- | ----------------------------------------- | --------------------------------------------------------------------- | ---- | ------ |
| R1  | JOIN query           | Orders page                               | Customer, restaurant, status name, and SQL total per order (5 tables) | A, M | ✅     |
| R2  | Revenue report       | Reports page                              | All restaurants; Green Bowl shows 0 / $0.00 (LEFT JOIN)               | A, M | ✅     |
| R3  | Date filter          | Nov 1–30, 2026                            | All three reports update                                              | M    | ✅     |
| R4  | Include cancelled    | Tick checkbox                             | Counts increase where orders were cancelled                           | M    | ✅     |
| R5  | Top items + HAVING   | Golden Wok, min units 3                   | Only items with ≥ 3 units                                             | A, M | ✅     |
| R6  | Customer spending    | "Only customers with orders"              | Customers with 0 orders hidden                                        | A, M | ✅     |
| R7  | Invalid report input | From after To; min units 0; top = 7 (API) | Error message, no crash                                               | A, M | ✅     |
| R8  | Live data            | Place an order, revisit Reports           | New order counted                                                     | M    | ✅     |
| R9  | `queries.sql`        | Run whole file in Workbench               | All statements run; data unchanged (writes rolled back)               | M    | ✅     |

## 5. Robustness

| ID  | Case                                               | Expected result                                                                         | Type | Result |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ------ |
| X1  | Unknown API URL                                    | 404 JSON message                                                                        | A    | ✅     |
| X2  | Unknown page (`/abc.html`)                         | Friendly "Page not found" page with navigation                                          | A    | ✅     |
| X3  | Malformed JSON body                                | 400 "not valid JSON"                                                                    | A    | ✅     |
| X4  | Body larger than 100 KB                            | 413 "too large"                                                                         | A    | ✅     |
| X5  | Wrong MySQL password in `.env` at startup          | Server prints a specific hint and exits                                                 | M    | ✅     |
| X6  | MySQL stopped while app runs (optional)            | 503 "database is not available"; works again after restart                              | M    | ⏳     |
| X7  | HTML in data: menu item description `<b>Spicy</b>` | Shown literally as `<b>Spicy</b>`, not bold (escapeHtml prevents HTML/script injection) | M    | ✅     |

---

## 6. Mobile (extra credit)

| ID  | Case                                                                                                         | Expected result                                    | Result |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------ |
| P1  | Open the app on a phone over the same Wi-Fi (`http://<laptop IP>:3000`)                                      | All pages load                                     | ✅     |
| P2  | ☰ menu opens / closes; choosing a page closes it                                                            | Works by touch                                     | ✅     |
| P3  | Search, insert (customer, order), update (customer, status, menu item), JOIN, reports, invalid input, Cancel | All work; tables shown as cards; 44 px tap targets | ✅     |

---

## Summary

**Final run (M12):** database rebuilt from `schema.sql` + `seed.sql`
(12 customers, 7 restaurants, 5 statuses, 39 menu items, 25 orders, 62 order
items; both integrity checks returned 0 rows), then:

- **Manual end-to-end run:** search, add customer (ID 13), duplicate email,
  place order (#26, $26.85), status update, customer edit, menu price change,
  reports, final-status rule, and Workbench persistence checks — all passed.
- **Automated:** `npm test` — **31 tests, 31 passed, 0 failed.**
- **Totals:** 59 test cases in this plan; 58 passed; 1 optional case (X6,
  stopping MySQL while the app runs) _fill in: passed / not run_.

**Bugs found and fixed during development and testing:**

| Found in       | Problem                                                                                  | Fix                                                               |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Design review  | `Subtotal` and `TotalAmount` stored as columns (derived data; `Subtotal` violated 3NF)   | Removed; computed with SQL (`Quantity * PriceAtOrderTime`, `SUM`) |
| Order search   | A "combined value" total was being added up in JavaScript                                | Removed — all aggregation is done in SQL (reports use `GROUP BY`) |
| Customer edit  | Small "Edit" buttons rendered full size (`.btn` rule came after `.btn-small` in CSS)     | Reordered CSS rules                                               |
| Phone layout   | An empty results table could still appear on phones (`display: block` overrode `hidden`) | Global `[hidden] { display: none !important; }`                   |
| `queries.sql`  | "Illegal mix of collations" when run from some MySQL clients                             | `SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci` at the top         |
| Place order    | Server accepted `true`, `""`, `"1e1"` as quantities (JavaScript `Number()` conversion)   | Strict whole-number check; covered by automated test I13          |
| Error handling | Oversized request or MySQL outage returned a generic 500                                 | Now 413 "too large" and 503 "database not available"              |
| Unknown pages  | Bare "Cannot GET" text                                                                   | Friendly 404 page with navigation                                 |
