-- Minimal database schema for the prototype
-- This file is used by scripts/executeSchema.js to initialise the PostgreSQL tables.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for user roles (optional, kept for completeness)
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM (
    'super_admin',
    'state_manager',
    'district_manager',
    'warehouse_manager',
    'viewer'
);

-- Table: centers (master catalog of warehouse locations)
CREATE TABLE IF NOT EXISTS centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    district VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: resources (static metadata for each item code)
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: inventory (links a center to a resource, stores operational quantities)
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    available_qty INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_center_resource UNIQUE (center_id, resource_id)
);

-- Table: inventory_transactions (immutable audit log of all inventory movements)
DROP TABLE IF EXISTS inventory_transactions CASCADE;
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id VARCHAR(50) NOT NULL,
    center_name VARCHAR(255),
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(255),
    quantity INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    notes TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_centers_code ON centers(center_code);
CREATE INDEX IF NOT EXISTS idx_resources_code ON resources(resource_code);
CREATE INDEX IF NOT EXISTS idx_inventory_center ON inventory(center_id);
CREATE INDEX IF NOT EXISTS idx_inventory_resource ON inventory(resource_id);
CREATE INDEX IF NOT EXISTS idx_transactions_center ON inventory_transactions(center_id);
CREATE INDEX IF NOT EXISTS idx_transactions_item ON inventory_transactions(item_code);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON inventory_transactions(timestamp DESC);

-- End of schema
