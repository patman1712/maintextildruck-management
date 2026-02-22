
-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    deadline DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    processing BOOLEAN DEFAULT FALSE,
    produced BOOLEAN DEFAULT FALSE,
    invoiced BOOLEAN DEFAULT FALSE,
    description TEXT,
    employees TEXT[],
    files JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing public access for now as per "admin" user concept)
CREATE POLICY "Enable all access for all users" ON customers FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON orders FOR ALL USING (true);
