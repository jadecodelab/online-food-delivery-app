-- =====================================================================
-- Online Food Delivery System - Sample Data Script
-- Team 12
--
-- Run AFTER schema.sql (schema.sql recreates an empty database and
-- inserts the ORDER_STATUS lookup values).
--
-- Explicit IDs are used so ORDER_ITEM rows can reference them reliably.
-- AUTO_INCREMENT continues from the highest ID for new rows from the app.
--
-- All names, phone numbers (555 numbers) and emails (example.com) are fictional.
-- =====================================================================

USE food_delivery;

-- ORDER_STATUS IDs (inserted by schema.sql):
--   1 = Placed, 2 = Preparing, 3 = Out for Delivery, 4 = Delivered, 5 = Cancelled

-- ---------------------------------------------------------------------
-- CUSTOMER (12)  - customers 11 and 12 have no orders yet
-- ---------------------------------------------------------------------
INSERT INTO CUSTOMER (CustomerID, FirstName, LastName, PhoneNumber, Email, Address) VALUES
(1,  'Emily',   'Johnson',  '217-555-0101', 'emily.johnson@example.com',  '412 Maple Ave, Springfield, IL 62701'),
(2,  'Michael', 'Chen',     '217-555-0102', 'michael.chen@example.com',   '88 Oak St, Apt 3B, Springfield, IL 62702'),
(3,  'Sofia',   'Martinez', '217-555-0103', 'sofia.martinez@example.com', '1501 Pine Rd, Springfield, IL 62703'),
(4,  'James',   'Wilson',   '217-555-0104', 'james.wilson@example.com',   '27 Cedar Ln, Springfield, IL 62704'),
(5,  'Aisha',   'Patel',    '217-555-0105', 'aisha.patel@example.com',    '930 Birch Blvd, Springfield, IL 62701'),
(6,  'David',   'Kim',      '217-555-0106', 'david.kim@example.com',      '64 Elm Ct, Springfield, IL 62702'),
(7,  'Olivia',  'Brown',    '217-555-0107', 'olivia.brown@example.com',   '2200 Walnut Dr, Springfield, IL 62703'),
(8,  'Daniel',  'Nguyen',   '217-555-0108', 'daniel.nguyen@example.com',  '15 Spruce Way, Springfield, IL 62704'),
(9,  'Grace',   'Lee',      '217-555-0109', 'grace.lee@example.com',      '703 Willow St, Springfield, IL 62701'),
(10, 'Ryan',    'Thompson', '217-555-0110', 'ryan.thompson@example.com',  '350 Chestnut Ave, Springfield, IL 62702'),
(11, 'Hannah',  'Garcia',   '217-555-0111', 'hannah.garcia@example.com',  '19 Poplar Pl, Springfield, IL 62703'),
(12, 'Lucas',   'Anderson', '217-555-0112', 'lucas.anderson@example.com', '481 Magnolia Rd, Springfield, IL 62704');

-- ---------------------------------------------------------------------
-- RESTAURANT (7)  - restaurant 7 has no orders yet
-- ---------------------------------------------------------------------
INSERT INTO RESTAURANT (RestaurantID, RestaurantName, PhoneNumber, OpenHours, Address) VALUES
(1, 'Golden Wok',                 '217-555-0201', 'Mon-Sun 11:00-22:00', '120 Main St, Springfield, IL 62701'),
(2, 'Bella Napoli Pizzeria',      '217-555-0202', 'Tue-Sun 11:30-23:00', '455 Washington St, Springfield, IL 62702'),
(3, 'Taqueria El Sol',            '217-555-0203', 'Mon-Sat 10:00-21:00', '78 Monroe St, Springfield, IL 62703'),
(4, 'Burger Barn',                '217-555-0204', 'Mon-Sun 10:30-23:30', '901 Capitol Ave, Springfield, IL 62701'),
(5, 'Spice Route Indian Kitchen', '217-555-0205', 'Mon-Sun 12:00-22:00', '233 Jefferson St, Springfield, IL 62702'),
(6, 'Sakura Sushi Bar',           '217-555-0206', 'Wed-Mon 12:00-21:30', '610 Adams St, Springfield, IL 62704'),
(7, 'Green Bowl Salads',          '217-555-0207', 'Mon-Fri 08:00-18:00', '34 Lincoln Sq, Springfield, IL 62701');

-- ---------------------------------------------------------------------
-- MENU_ITEM (39)  - every restaurant offers at least one item
--                   items 17, 23, 35 are currently unavailable
-- ---------------------------------------------------------------------
INSERT INTO MENU_ITEM (ItemID, RestaurantID, ItemName, Description, Price, AvailabilityStatus) VALUES
-- 1 Golden Wok
(1,  1, 'Kung Pao Chicken',       'Spicy stir-fried chicken with peanuts and dried chili',  13.95, TRUE),
(2,  1, 'Beef with Broccoli',     'Sliced flank steak and broccoli in oyster sauce',        14.50, TRUE),
(3,  1, 'Vegetable Fried Rice',   'Wok-fried rice with egg, peas, carrots and scallions',    9.75, TRUE),
(4,  1, 'Hot and Sour Soup',      'Tofu, mushrooms and bamboo shoots in a tangy broth',      5.25, TRUE),
(5,  1, 'Pork Dumplings (6 pcs)', 'Pan-fried dumplings with soy-vinegar dipping sauce',      7.95, TRUE),
(6,  1, 'Orange Chicken',         'Crispy chicken tossed in sweet orange glaze',            13.25, TRUE),
-- 2 Bella Napoli Pizzeria
(7,  2, 'Margherita Pizza',       'Tomato, fresh mozzarella and basil, 12 inch',            15.00, TRUE),
(8,  2, 'Pepperoni Pizza',        'Tomato, mozzarella and pepperoni, 12 inch',              16.50, TRUE),
(9,  2, 'Fettuccine Alfredo',     'Fettuccine in a parmesan cream sauce',                   14.75, TRUE),
(10, 2, 'Lasagna Bolognese',      'Layered pasta with beef ragu and bechamel',              17.25, TRUE),
(11, 2, 'Caesar Salad',           'Romaine, croutons, parmesan and Caesar dressing',         9.50, TRUE),
(12, 2, 'Tiramisu',               'Espresso-soaked ladyfingers with mascarpone',             7.50, TRUE),
-- 3 Taqueria El Sol
(13, 3, 'Carne Asada Tacos (3)',  'Grilled steak tacos with onion, cilantro and salsa',     11.50, TRUE),
(14, 3, 'Chicken Burrito',        'Chicken, rice, beans, cheese and pico de gallo',         12.25, TRUE),
(15, 3, 'Veggie Quesadilla',      'Peppers, onions, black beans and melted cheese',         10.00, TRUE),
(16, 3, 'Chips and Guacamole',    'House-made tortilla chips with fresh guacamole',          6.75, TRUE),
(17, 3, 'Churros',                'Cinnamon-sugar churros with chocolate sauce',             5.50, FALSE),
-- 4 Burger Barn
(18, 4, 'Classic Cheeseburger',   'Beef patty, cheddar, lettuce, tomato and pickles',       11.95, TRUE),
(19, 4, 'Bacon BBQ Burger',       'Beef patty, bacon, onion rings and BBQ sauce',           13.95, TRUE),
(20, 4, 'Veggie Burger',          'Black bean patty with avocado and chipotle mayo',        12.50, TRUE),
(21, 4, 'French Fries',           'Crispy skin-on fries with sea salt',                      4.50, TRUE),
(22, 4, 'Chocolate Milkshake',    'Hand-spun with vanilla ice cream and chocolate',          6.25, TRUE),
(23, 4, 'Onion Rings',            'Beer-battered onion rings',                               5.25, FALSE),
-- 5 Spice Route Indian Kitchen
(24, 5, 'Chicken Tikka Masala',   'Tandoori chicken in a creamy tomato sauce',              16.95, TRUE),
(25, 5, 'Lamb Rogan Josh',        'Slow-cooked lamb in Kashmiri spices',                    18.50, TRUE),
(26, 5, 'Palak Paneer',           'Cottage cheese cubes in spiced spinach',                 14.25, TRUE),
(27, 5, 'Garlic Naan',            'Tandoor-baked flatbread with garlic butter',              3.95, TRUE),
(28, 5, 'Vegetable Samosas (2)',  'Pastry filled with spiced potatoes and peas',             6.50, TRUE),
(29, 5, 'Mango Lassi',            'Yogurt drink blended with mango',                         4.75, TRUE),
-- 6 Sakura Sushi Bar
(30, 6, 'California Roll',        'Crab, avocado and cucumber, 8 pieces',                    8.95, TRUE),
(31, 6, 'Salmon Nigiri (2 pcs)',  'Fresh salmon over seasoned rice',                         7.50, TRUE),
(32, 6, 'Spicy Tuna Roll',        'Tuna, spicy mayo and cucumber, 8 pieces',                10.50, TRUE),
(33, 6, 'Chicken Teriyaki Bento', 'Teriyaki chicken, rice, salad and gyoza',                15.95, TRUE),
(34, 6, 'Miso Soup',              'Tofu, seaweed and scallions in miso broth',               3.50, TRUE),
(35, 6, 'Dragon Roll',            'Shrimp tempura topped with eel and avocado',             15.50, FALSE),
-- 7 Green Bowl Salads
(36, 7, 'Quinoa Power Bowl',      'Quinoa, chickpeas, kale, roasted vegetables and tahini', 12.95, TRUE),
(37, 7, 'Greek Salad',            'Tomato, cucumber, olives, feta and oregano dressing',    11.25, TRUE),
(38, 7, 'Avocado Toast',          'Sourdough with smashed avocado and chili flakes',         9.25, TRUE),
(39, 7, 'Green Juice',            'Fresh-pressed kale, apple, cucumber and lemon',           6.95, TRUE);

-- ---------------------------------------------------------------------
-- ORDERS (25)  - Sept to Nov 2026; mix of all statuses
--   Orders 4 and 20 use a delivery address different from the customer's
-- ---------------------------------------------------------------------
INSERT INTO ORDERS (OrderID, CustomerID, RestaurantID, StatusID, OrderDate, DeliveryAddress) VALUES
(1,  1,  2, 4, '2026-09-05 18:42:00', '412 Maple Ave, Springfield, IL 62701'),
(2,  2,  1, 4, '2026-09-08 12:15:00', '88 Oak St, Apt 3B, Springfield, IL 62702'),
(3,  3,  3, 4, '2026-09-12 19:30:00', '1501 Pine Rd, Springfield, IL 62703'),
(4,  4,  4, 4, '2026-09-15 13:05:00', '500 Corporate Dr, Suite 200, Springfield, IL 62703'),
(5,  5,  5, 4, '2026-09-20 20:10:00', '930 Birch Blvd, Springfield, IL 62701'),
(6,  1,  6, 4, '2026-09-26 19:00:00', '412 Maple Ave, Springfield, IL 62701'),
(7,  6,  2, 4, '2026-10-01 18:20:00', '64 Elm Ct, Springfield, IL 62702'),
(8,  7,  5, 5, '2026-10-03 21:45:00', '2200 Walnut Dr, Springfield, IL 62703'),
(9,  2,  4, 4, '2026-10-07 12:40:00', '88 Oak St, Apt 3B, Springfield, IL 62702'),
(10, 8,  1, 4, '2026-10-10 18:55:00', '15 Spruce Way, Springfield, IL 62704'),
(11, 9,  6, 4, '2026-10-14 13:30:00', '703 Willow St, Springfield, IL 62701'),
(12, 3,  2, 4, '2026-10-18 19:15:00', '1501 Pine Rd, Springfield, IL 62703'),
(13, 10, 3, 4, '2026-10-21 12:05:00', '350 Chestnut Ave, Springfield, IL 62702'),
(14, 1,  5, 4, '2026-10-24 19:40:00', '412 Maple Ave, Springfield, IL 62701'),
(15, 4,  1, 4, '2026-10-28 18:30:00', '27 Cedar Ln, Springfield, IL 62704'),
(16, 5,  2, 4, '2026-11-01 17:50:00', '930 Birch Blvd, Springfield, IL 62701'),
(17, 6,  4, 4, '2026-11-03 12:25:00', '64 Elm Ct, Springfield, IL 62702'),
(18, 2,  6, 5, '2026-11-05 20:00:00', '88 Oak St, Apt 3B, Springfield, IL 62702'),
(19, 7,  3, 4, '2026-11-08 18:10:00', '2200 Walnut Dr, Springfield, IL 62703'),
(20, 8,  5, 4, '2026-11-10 19:25:00', '75 University Ave, Dorm Hall 4, Springfield, IL 62704'),
(21, 9,  1, 3, '2026-11-16 18:35:00', '703 Willow St, Springfield, IL 62701'),
(22, 10, 2, 2, '2026-11-16 19:05:00', '350 Chestnut Ave, Springfield, IL 62702'),
(23, 3,  4, 2, '2026-11-17 11:50:00', '1501 Pine Rd, Springfield, IL 62703'),
(24, 1,  1, 1, '2026-11-17 12:10:00', '412 Maple Ave, Springfield, IL 62701'),
(25, 4,  6, 1, '2026-11-17 12:20:00', '27 Cedar Ln, Springfield, IL 62704');

-- ---------------------------------------------------------------------
-- ORDER_ITEM (62)  - every item belongs to its order's restaurant
--   Price history examples (PriceAtOrderTime < current Price):
--     order 1 item 7 (Margherita was 14.00, now 15.00)
--     order 3 item 13 (Carne Asada Tacos were 10.95, now 11.50)
--     order 5 item 24 (Tikka Masala was 15.95, now 16.95)
--   Items 17, 23, 35 were ordered before they became unavailable.
-- ---------------------------------------------------------------------
INSERT INTO ORDER_ITEM (OrderID, ItemID, Quantity, PriceAtOrderTime) VALUES
(1,  7,  2, 14.00), (1,  12, 1,  7.50),
(2,  1,  1, 13.95), (2,  3,  1,  9.75), (2,  5,  2,  7.95),
(3,  13, 2, 10.95), (3,  16, 1,  6.75),
(4,  18, 2, 11.95), (4,  21, 2,  4.50), (4,  22, 1,  6.25),
(5,  24, 1, 15.95), (5,  27, 2,  3.95), (5,  29, 1,  4.75),
(6,  30, 2,  8.95), (6,  32, 1, 10.50), (6,  34, 2,  3.50),
(7,  8,  1, 16.50), (7,  11, 1,  9.50),
(8,  25, 1, 18.50), (8,  27, 1,  3.95),
(9,  19, 1, 13.95), (9,  23, 1,  5.25),
(10, 6,  2, 13.25), (10, 4,  2,  5.25),
(11, 33, 1, 15.95), (11, 31, 2,  7.50), (11, 35, 1, 15.50),
(12, 9,  1, 14.75), (12, 10, 1, 17.25), (12, 12, 2,  7.50),
(13, 14, 2, 12.25), (13, 17, 2,  5.50),
(14, 24, 2, 16.95), (14, 26, 1, 14.25), (14, 27, 3,  3.95), (14, 28, 1,  6.50),
(15, 2,  1, 14.50), (15, 3,  1,  9.75),
(16, 7,  1, 15.00), (16, 8,  1, 16.50), (16, 11, 2,  9.50),
(17, 20, 1, 12.50), (17, 21, 1,  4.50),
(18, 32, 2, 10.50),
(19, 13, 1, 11.50), (19, 15, 1, 10.00), (19, 16, 1,  6.75),
(20, 26, 1, 14.25), (20, 27, 2,  3.95), (20, 29, 2,  4.75),
(21, 1,  2, 13.95), (21, 5,  1,  7.95),
(22, 10, 2, 17.25), (22, 12, 1,  7.50),
(23, 18, 1, 11.95), (23, 19, 1, 13.95), (23, 21, 2,  4.50), (23, 22, 2,  6.25),
(24, 6,  1, 13.25), (24, 4,  1,  5.25),
(25, 30, 1,  8.95), (25, 33, 1, 15.95);

-- =====================================================================
-- Verification queries (results appear as tabs in Workbench)
-- =====================================================================

-- 1) Row counts - expected: 12, 7, 5, 39, 25, 62
SELECT 'CUSTOMER'     AS TableName, COUNT(*) AS RowCount FROM CUSTOMER
UNION ALL SELECT 'RESTAURANT',   COUNT(*) FROM RESTAURANT
UNION ALL SELECT 'ORDER_STATUS', COUNT(*) FROM ORDER_STATUS
UNION ALL SELECT 'MENU_ITEM',    COUNT(*) FROM MENU_ITEM
UNION ALL SELECT 'ORDERS',       COUNT(*) FROM ORDERS
UNION ALL SELECT 'ORDER_ITEM',   COUNT(*) FROM ORDER_ITEM;

-- 2) Business rule check: items from a different restaurant than the order
--    expected: 0 rows
SELECT oi.OrderID, oi.ItemID, o.RestaurantID AS OrderRestaurant, m.RestaurantID AS ItemRestaurant
FROM ORDER_ITEM oi
JOIN ORDERS    o ON o.OrderID = oi.OrderID
JOIN MENU_ITEM m ON m.ItemID  = oi.ItemID
WHERE o.RestaurantID <> m.RestaurantID;

-- 3) Business rule check: orders with no items - expected: 0 rows
SELECT o.OrderID
FROM ORDERS o
LEFT JOIN ORDER_ITEM oi ON oi.OrderID = o.OrderID
WHERE oi.OrderID IS NULL;
