-- =====================================================================
-- Online Food Delivery System - SQL used by the application (Team 12)
--
-- Every statement the web app runs, collected for the report.
-- In the app, user values are sent as ? placeholders (parameterized
-- queries); here they are written as @variables with sample values so the
-- file can be run in MySQL Workbench.
--
-- SAFE TO RUN: INSERT/UPDATE examples are wrapped in
-- START TRANSACTION ... ROLLBACK, so the data is not changed.
-- =====================================================================

USE food_delivery;

-- Make @variables use the same collation as the tables (otherwise
-- comparing them with LIKE can fail with "Illegal mix of collations").
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- =====================================================================
-- A. VIEW AND SEARCH (filtering with WHERE, LIKE, ranges)
-- =====================================================================

-- A1. Menu search (Menu page) - all filters optional, combined with AND.
--     Helps customers/staff find dishes by keyword, restaurant, price, availability.
SET @search = '%chicken%', @restaurantId = NULL, @minPrice = 10.00, @maxPrice = 15.00, @available = 1;
SELECT m.ItemID, m.ItemName, m.Description, m.Price, m.AvailabilityStatus,
       r.RestaurantID, r.RestaurantName
FROM MENU_ITEM m
JOIN RESTAURANT r ON r.RestaurantID = m.RestaurantID
WHERE (m.ItemName LIKE @search OR m.Description LIKE @search)
  AND (@restaurantId IS NULL OR m.RestaurantID = @restaurantId)
  AND m.Price >= @minPrice
  AND m.Price <= @maxPrice
  AND m.AvailabilityStatus = @available
ORDER BY r.RestaurantName, m.ItemName;

-- A2. Customer search with order count (Customers page).
--     LEFT JOIN keeps customers with no orders (OrderCount = 0).
SET @customerSearch = '%lee%', @digits = NULL;
SELECT c.CustomerID, c.FirstName, c.LastName, c.Email, c.PhoneNumber, c.Address,
       COUNT(o.OrderID) AS OrderCount
FROM CUSTOMER c
LEFT JOIN ORDERS o ON o.CustomerID = c.CustomerID
WHERE (CONCAT(c.FirstName, ' ', c.LastName) LIKE @customerSearch
       OR c.Email LIKE @customerSearch
       OR c.PhoneNumber LIKE @customerSearch
       OR REPLACE(c.PhoneNumber, '-', '') LIKE @digits)
GROUP BY c.CustomerID, c.FirstName, c.LastName, c.Email, c.PhoneNumber, c.Address
ORDER BY c.LastName, c.FirstName;

-- A3. Dropdown data (lookup table + restaurants)
SELECT StatusID, StatusName FROM ORDER_STATUS ORDER BY StatusID;
SELECT RestaurantID, RestaurantName, PhoneNumber, OpenHours, Address FROM RESTAURANT ORDER BY RestaurantName;

-- =====================================================================
-- B. MULTIPLE-TABLE JOIN QUERIES
-- =====================================================================

-- B1. Order search (Orders page) - joins 5 tables.
--     Shows who ordered, from where, the status name, and the order total
--     (computed with SUM because TotalAmount is not stored - 3NF).
--     "To" date is inclusive: OrderDate < to + 1 day.
SET @customer = '%emily%', @statusId = NULL, @orderRestaurant = NULL,
    @from = '2026-09-01', @to = '2026-11-30';
SELECT o.OrderID, o.OrderDate,
       c.CustomerID, CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
       r.RestaurantID, r.RestaurantName,
       s.StatusID, s.StatusName,
       o.DeliveryAddress,
       COUNT(oi.ItemID)                       AS ItemCount,
       SUM(oi.Quantity)                       AS TotalQuantity,
       SUM(oi.Quantity * oi.PriceAtOrderTime) AS TotalAmount
FROM ORDERS o
JOIN CUSTOMER     c  ON c.CustomerID   = o.CustomerID
JOIN RESTAURANT   r  ON r.RestaurantID = o.RestaurantID
JOIN ORDER_STATUS s  ON s.StatusID     = o.StatusID
JOIN ORDER_ITEM   oi ON oi.OrderID     = o.OrderID
WHERE (CONCAT(c.FirstName, ' ', c.LastName) LIKE @customer OR c.Email LIKE @customer)
  AND (@statusId IS NULL OR o.StatusID = @statusId)
  AND (@orderRestaurant IS NULL OR o.RestaurantID = @orderRestaurant)
  AND o.OrderDate >= @from
  AND o.OrderDate < DATE_ADD(@to, INTERVAL 1 DAY)
GROUP BY o.OrderID, o.OrderDate, c.CustomerID, c.FirstName, c.LastName,
         r.RestaurantID, r.RestaurantName, s.StatusID, s.StatusName, o.DeliveryAddress
ORDER BY o.OrderDate DESC;

-- B2. Order details: the items in one order (Update status panel).
--     Subtotal is computed (Quantity * PriceAtOrderTime), not stored.
SET @orderId = 1;
SELECT oi.ItemID, m.ItemName, oi.Quantity, oi.PriceAtOrderTime,
       oi.Quantity * oi.PriceAtOrderTime AS Subtotal
FROM ORDER_ITEM oi
JOIN MENU_ITEM m ON m.ItemID = oi.ItemID
WHERE oi.OrderID = @orderId
ORDER BY m.ItemName;

-- =====================================================================
-- C. SUMMARY REPORTS (GROUP BY + COUNT / SUM / AVG / MAX, HAVING)
--    Cancelled orders are excluded (they are not real sales).
-- =====================================================================

-- C1. Revenue by restaurant.
--     Inner query: one row per order with its total.
--     Outer query: LEFT JOIN restaurants -> restaurants with no orders show 0.
--     AVG is over ORDER totals (not item lines), hence the two levels.
SELECT r.RestaurantID, r.RestaurantName,
       COUNT(t.OrderID)               AS OrderCount,
       COALESCE(SUM(t.OrderTotal), 0) AS Revenue,
       AVG(t.OrderTotal)              AS AvgOrderValue,
       MAX(t.OrderTotal)              AS LargestOrder
FROM RESTAURANT r
LEFT JOIN (
    SELECT o.OrderID, o.RestaurantID, SUM(oi.Quantity * oi.PriceAtOrderTime) AS OrderTotal
    FROM ORDERS o
    JOIN ORDER_ITEM   oi ON oi.OrderID = o.OrderID
    JOIN ORDER_STATUS s  ON s.StatusID = o.StatusID
    WHERE s.StatusName <> 'Cancelled'
    GROUP BY o.OrderID, o.RestaurantID
) t ON t.RestaurantID = r.RestaurantID
GROUP BY r.RestaurantID, r.RestaurantName
ORDER BY Revenue DESC, r.RestaurantName;

-- C2. Top-selling menu items. HAVING filters on the aggregated value.
SET @minUnits = 2;
SELECT m.ItemID, m.ItemName, r.RestaurantName,
       SUM(oi.Quantity)                       AS UnitsSold,
       COUNT(DISTINCT oi.OrderID)             AS OrderCount,
       SUM(oi.Quantity * oi.PriceAtOrderTime) AS Revenue
FROM ORDER_ITEM oi
JOIN ORDERS       o ON o.OrderID      = oi.OrderID
JOIN ORDER_STATUS s ON s.StatusID     = o.StatusID
JOIN MENU_ITEM    m ON m.ItemID       = oi.ItemID
JOIN RESTAURANT   r ON r.RestaurantID = m.RestaurantID
WHERE s.StatusName <> 'Cancelled'
GROUP BY m.ItemID, m.ItemName, r.RestaurantName
HAVING SUM(oi.Quantity) >= @minUnits
ORDER BY UnitsSold DESC, Revenue DESC, m.ItemName
LIMIT 10;

-- C3. Customer spending (orders, total, average, last order date).
SELECT c.CustomerID, CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName, c.Email,
       COUNT(t.OrderID)               AS OrderCount,
       COALESCE(SUM(t.OrderTotal), 0) AS TotalSpent,
       AVG(t.OrderTotal)              AS AvgOrderValue,
       MAX(t.OrderDate)               AS LastOrderDate
FROM CUSTOMER c
LEFT JOIN (
    SELECT o.OrderID, o.CustomerID, o.OrderDate, SUM(oi.Quantity * oi.PriceAtOrderTime) AS OrderTotal
    FROM ORDERS o
    JOIN ORDER_ITEM   oi ON oi.OrderID = o.OrderID
    JOIN ORDER_STATUS s  ON s.StatusID = o.StatusID
    WHERE s.StatusName <> 'Cancelled'
    GROUP BY o.OrderID, o.CustomerID, o.OrderDate
) t ON t.CustomerID = c.CustomerID
GROUP BY c.CustomerID, c.FirstName, c.LastName, c.Email
ORDER BY TotalSpent DESC, c.LastName, c.FirstName;

-- =====================================================================
-- D. INSERT (rolled back at the end of this section)
-- =====================================================================
START TRANSACTION;

-- D1. Add customer. Duplicate Email -> error 1062 (UNIQUE uq_customer_email).
INSERT INTO CUSTOMER (FirstName, LastName, PhoneNumber, Email, Address)
VALUES ('Test', 'Customer', '217-555-0999', 'test.customer@example.com', '1 Test St, Springfield, IL 62701');
SET @newCustomerId = LAST_INSERT_ID();

-- D2. Place order (app runs D2a-D2d in ONE transaction; any error -> ROLLBACK).
--   D2a. Insert the order with status 'Placed' (FKs check customer/restaurant -> error 1452).
SET @orderRestaurantId = 3;
INSERT INTO ORDERS (CustomerID, RestaurantID, StatusID, DeliveryAddress)
VALUES (@newCustomerId, @orderRestaurantId,
        (SELECT StatusID FROM ORDER_STATUS WHERE StatusName = 'Placed'),
        '1 Test St, Springfield, IL 62701');
SET @newOrderId = LAST_INSERT_ID();

--   D2b. Read chosen items, locking them; the app checks each item exists,
--        belongs to the order's restaurant (one restaurant per order), and is available.
SELECT m.ItemID, m.ItemName, m.RestaurantID, m.Price, m.AvailabilityStatus
FROM MENU_ITEM m
WHERE m.ItemID IN (14, 16)
FOR SHARE;

--   D2c. Insert items; PriceAtOrderTime is copied from MENU_ITEM.Price (not from the browser).
INSERT INTO ORDER_ITEM (OrderID, ItemID, Quantity, PriceAtOrderTime)
SELECT @newOrderId, m.ItemID, q.Quantity, m.Price
FROM MENU_ITEM m
JOIN (SELECT 14 AS ItemID, 2 AS Quantity UNION ALL SELECT 16, 1) q ON q.ItemID = m.ItemID;

--   D2d. Verify (app then COMMITs)
SELECT o.OrderID, SUM(oi.Quantity * oi.PriceAtOrderTime) AS TotalAmount
FROM ORDERS o JOIN ORDER_ITEM oi ON oi.OrderID = o.OrderID
WHERE o.OrderID = @newOrderId
GROUP BY o.OrderID;

ROLLBACK;   -- undo section D (the app uses COMMIT)

-- =====================================================================
-- E. UPDATE (rolled back at the end of this section)
--    Each UPDATE targets ONE row by primary key (WHERE ... = ?).
-- =====================================================================
START TRANSACTION;

-- E1. Edit customer. Email used by another customer -> error 1062.
UPDATE CUSTOMER
SET FirstName = 'Lucas', LastName = 'Anderson', PhoneNumber = '217-555-0199',
    Email = 'lucas.anderson@example.com', Address = '500 Oak St, Springfield, IL 62704'
WHERE CustomerID = 12;

-- E2. Change order status. App locks the row and checks the transition rule
--     (forward only; Delivered/Cancelled final; cancel only before Out for Delivery).
SET @statusOrderId = 24;
SELECT o.OrderID, s.StatusName
FROM ORDERS o JOIN ORDER_STATUS s ON s.StatusID = o.StatusID
WHERE o.OrderID = @statusOrderId
FOR UPDATE;
UPDATE ORDERS
SET StatusID = (SELECT StatusID FROM ORDER_STATUS WHERE StatusName = 'Preparing')
WHERE OrderID = @statusOrderId;

-- E3. Edit menu item. Same name in the same restaurant -> error 1062
--     (UNIQUE uq_menu_item_name on (RestaurantID, ItemName)).
--     Past orders keep PriceAtOrderTime, so their totals do not change.
UPDATE MENU_ITEM
SET ItemName = 'Margherita Pizza', Description = 'Tomato, fresh mozzarella and basil, 12 inch',
    Price = 16.00, AvailabilityStatus = TRUE
WHERE ItemID = 7;

ROLLBACK;   -- undo section E (the app commits each update)
