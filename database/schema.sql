-- =====================================================================
-- Online Food Delivery System - Schema Creation Script
-- Team 12
-- MySQL 8.0+
--
-- Run:  mysql -u root -p < database/schema.sql
-- WARNING: drops and recreates the food_delivery database each run.
-- =====================================================================

DROP DATABASE IF EXISTS food_delivery;
CREATE DATABASE food_delivery
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;
USE food_delivery;

-- ---------------------------------------------------------------------
-- Parent tables first (they are referenced by others)
-- ---------------------------------------------------------------------

CREATE TABLE CUSTOMER (
    CustomerID   INT          NOT NULL AUTO_INCREMENT,
    FirstName    VARCHAR(50)  NOT NULL,
    LastName     VARCHAR(50)  NOT NULL,
    PhoneNumber  VARCHAR(20)  NOT NULL,
    Email        VARCHAR(100) NOT NULL,
    Address      VARCHAR(200) NOT NULL,

    PRIMARY KEY (CustomerID),
    CONSTRAINT uq_customer_email UNIQUE (Email),
    CONSTRAINT chk_customer_email CHECK (Email LIKE '%_@_%._%'),
    CONSTRAINT chk_customer_first CHECK (TRIM(FirstName) <> ''),
    CONSTRAINT chk_customer_last  CHECK (TRIM(LastName)  <> '')
);

CREATE TABLE RESTAURANT (
    RestaurantID    INT          NOT NULL AUTO_INCREMENT,
    RestaurantName  VARCHAR(100) NOT NULL,
    PhoneNumber     VARCHAR(20)  NOT NULL,
    OpenHours       VARCHAR(100) NOT NULL,   -- e.g. 'Mon-Sun 10:00-22:00'
    Address         VARCHAR(200) NOT NULL,

    PRIMARY KEY (RestaurantID),
    CONSTRAINT chk_restaurant_name CHECK (TRIM(RestaurantName) <> '')
);

-- Lookup table: the only allowed order statuses
CREATE TABLE ORDER_STATUS (
    StatusID    INT         NOT NULL AUTO_INCREMENT,
    StatusName  VARCHAR(30) NOT NULL,

    PRIMARY KEY (StatusID),
    CONSTRAINT uq_status_name UNIQUE (StatusName)
);

-- ---------------------------------------------------------------------
-- Child tables
-- ---------------------------------------------------------------------

CREATE TABLE MENU_ITEM (
    ItemID              INT           NOT NULL AUTO_INCREMENT,
    RestaurantID        INT           NOT NULL,
    ItemName            VARCHAR(100)  NOT NULL,
    Description         VARCHAR(255)  NULL,
    Price               DECIMAL(8,2)  NOT NULL,
    AvailabilityStatus  BOOLEAN       NOT NULL DEFAULT TRUE,

    PRIMARY KEY (ItemID),
    -- a restaurant cannot list the same item name twice
    CONSTRAINT uq_menu_item_name UNIQUE (RestaurantID, ItemName),
    CONSTRAINT chk_menu_price    CHECK (Price >= 0),
    CONSTRAINT chk_menu_name     CHECK (TRIM(ItemName) <> ''),
    CONSTRAINT fk_menu_restaurant
        FOREIGN KEY (RestaurantID) REFERENCES RESTAURANT(RestaurantID)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Named ORDERS because ORDER is a reserved word in SQL
CREATE TABLE ORDERS (
    OrderID          INT          NOT NULL AUTO_INCREMENT,
    CustomerID       INT          NOT NULL,
    RestaurantID     INT          NOT NULL,
    StatusID         INT          NOT NULL,
    OrderDate        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    DeliveryAddress  VARCHAR(200) NOT NULL,
    -- TotalAmount removed: derived value, computed with SUM() in queries

    PRIMARY KEY (OrderID),
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (CustomerID) REFERENCES CUSTOMER(CustomerID)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_orders_restaurant
        FOREIGN KEY (RestaurantID) REFERENCES RESTAURANT(RestaurantID)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_orders_status
        FOREIGN KEY (StatusID) REFERENCES ORDER_STATUS(StatusID)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Associative (bridge) table resolving ORDERS M:N MENU_ITEM
CREATE TABLE ORDER_ITEM (
    OrderID           INT          NOT NULL,
    ItemID            INT          NOT NULL,
    Quantity          INT          NOT NULL,
    PriceAtOrderTime  DECIMAL(8,2) NOT NULL,
    -- Subtotal removed: derived (Quantity * PriceAtOrderTime), violates 3NF

    PRIMARY KEY (OrderID, ItemID),
    CONSTRAINT chk_orderitem_qty   CHECK (Quantity > 0),
    CONSTRAINT chk_orderitem_price CHECK (PriceAtOrderTime >= 0),
    CONSTRAINT fk_orderitem_order
        FOREIGN KEY (OrderID) REFERENCES ORDERS(OrderID)
        ON UPDATE CASCADE
        ON DELETE CASCADE,      -- deleting an order removes its line items
    CONSTRAINT fk_orderitem_item
        FOREIGN KEY (ItemID) REFERENCES MENU_ITEM(ItemID)
        ON UPDATE CASCADE
        ON DELETE RESTRICT      -- cannot delete a menu item that was ordered
);

-- ---------------------------------------------------------------------
-- Lookup values (required for the application to work)
-- ---------------------------------------------------------------------
INSERT INTO ORDER_STATUS (StatusName) VALUES
    ('Placed'),
    ('Preparing'),
    ('Out for Delivery'),
    ('Delivered'),
    ('Cancelled');
