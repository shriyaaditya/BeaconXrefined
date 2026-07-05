-- Drop existing tables if they exist to allow clean re‑execution
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS centers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing enum types if they exist to allow re‑execution
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS transaction_action CASCADE;

-- ==========================================
-- SETUP ENUMS & EXTENSIONS
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM (
    'super_admin',
    'state_manager',
    'district_manager',
    'warehouse_manager',
    'viewer'
);

CREATE TYPE transaction_action AS ENUM (
    'restock',
    'dispatch',
    'transfer_in',
    'transfer_out',
    'correction'
);

-- ==========================================
-- TABLE 5: users
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL,
    assigned_region VARCHAR(255),
    assigned_district VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_assigned_district ON users(assigned_district);

-- ==========================================
-- TABLE 1: centers
-- ==========================================
CREATE TABLE centers (
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

CREATE INDEX idx_centers_district ON centers(district);
CREATE INDEX idx_centers_region ON centers(region);

-- ==========================================
-- TABLE 2: resources
-- ==========================================
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resources_category ON resources(category);

-- ==========================================
-- TABLE 3: inventory
-- ==========================================
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    available_qty INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_center_resource UNIQUE(center_id, resource_id)
);

CREATE INDEX idx_inventory_center_id ON inventory(center_id);
CREATE INDEX idx_inventory_resource_id ON inventory(resource_id);

-- ==========================================
-- TABLE 4: inventory_transactions
-- ==========================================
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    quantity_change INTEGER NOT NULL,
    action_type transaction_action NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inv_transactions_created_at ON inventory_transactions(created_at);
CREATE INDEX idx_inv_transactions_center_resource ON inventory_transactions(center_id, resource_id);

-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_centers_updated_at
    BEFORE UPDATE ON centers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SEED DATA
-- ==========================================
INSERT INTO users (id, full_name, email, role, assigned_region, assigned_district) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Admin Superuser', 'admin@beaconx.org', 'super_admin', NULL, NULL),
    ('00000000-0000-0000-0000-000000000002', 'Ravi Sharma', 'ravi.sharma@beaconx.org', 'district_manager', 'Konkan Division', 'Mumbai Suburban');

INSERT INTO centers (id, center_code, name, district, region, latitude, longitude) VALUES
    ('11111111-1111-1111-1111-111111111111', 'wh-mum-sub-001', 'Mumbai Suburban EOC Depot (Bandra)', 'Mumbai Suburban', 'Konkan Division', 19.0607, 72.8362),
    ('11111111-1111-1111-1111-111111111112', 'wh-pune-001', 'Pune Central Relief Hub', 'Pune', 'Pune Division', 18.5204, 73.8567);

INSERT INTO resources (id, resource_code, name, category, unit) VALUES
    ('22222222-2222-2222-2222-222222222221', 'IDRN-RE-001', 'Inflatable Gemini Rescue Boat (6-Person)', 'Rescue Equipment', 'pieces'),
    ('22222222-2222-2222-2222-222222222222', 'IDRN-MED-101', 'Trauma & First Aid Kit (Large)', 'Medical Supplies', 'kits'),
    ('22222222-2222-2222-2222-222222222223', 'IDRN-WAT-301', 'High-Capacity Diesel Water Pump (5 HP)', 'Water & Sanitation', 'pieces'),
    ('22222222-2222-2222-2222-222222222224', 'IDRN-SHT-401', 'Family Relief Tent (Waterproof, 6-person)', 'Shelter & Camps', 'pieces'),
    ('22222222-2222-2222-2222-222222222225', 'IDRN-FOD-501', 'Ready-to-Eat Meal Ration Packets', 'Food & Survival', 'packets');

INSERT INTO inventory (center_id, resource_id, available_qty, min_threshold) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 15, 10),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 80, 50),
    ('11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222225', 1500, 1000),
    ('11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222224', 30, 30);

INSERT INTO inventory_transactions (center_id, resource_id, quantity_change, action_type, reason, created_by) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 15, 'restock', 'Initial stock allocation from state HQ', '00000000-0000-0000-0000-000000000001'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', -20, 'dispatch', 'Flood relief deployment to local shelter', '00000000-0000-0000-0000-000000000002');
