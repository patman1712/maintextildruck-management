# Main Textildruck Management System - Technical Architecture & Page Design

## 1. Technical Architecture

### 1.1 Tech Stack
- **Frontend**: React (TypeScript) + Vite
  - **Styling**: Tailwind CSS + Shadcn UI (Radix Primitives)
  - **State Management**: Zustand
  - **Routing**: React Router DOM
  - **Icons**: Lucide React
  - **HTTP Client**: Axios / Fetch
- **Backend**: Express.js (TypeScript)
  - **Database**: Supabase (PostgreSQL)
  - **Authentication**: Supabase Auth
  - **Storage**: Supabase Storage (for file uploads)
  - **API**: RESTful API endpoints

### 1.2 Database Schema (Supabase)

#### Users Table (`users`)
- `id` (UUID, Primary Key) - linked to auth.users
- `email` (Text, Unique)
- `full_name` (Text)
- `role` (Text: 'admin', 'employee')
- `created_at` (Timestamp)

#### Orders Table (`orders`)
- `id` (UUID, Primary Key)
- `customer_name` (Text)
- `order_date` (Date)
- `delivery_date` (Date)
- `status` (Text: 'pending', 'design', 'printing', 'finishing', 'shipped', 'completed')
- `items` (JSONB: Array of objects { product, quantity, size, color })
- `total_amount` (Decimal)
- `assigned_to` (UUID, Foreign Key to users.id, nullable)
- `created_at` (Timestamp)

#### Inventory Orders Table (`inventory_orders`)
- `id` (UUID, Primary Key)
- `product_name` (Text)
- `quantity` (Integer)
- `supplier` (Text)
- `status` (Text: 'ordered', 'received')
- `ordered_by` (UUID, Foreign Key to users.id)
- `created_at` (Timestamp)

#### Customer Files Table (`customer_files`)
- `id` (UUID, Primary Key)
- `customer_name` (Text) - or link to a Customers table if needed (keeping simple for now)
- `file_name` (Text)
- `file_url` (Text)
- `file_type` (Text)
- `uploaded_by` (UUID, Foreign Key to users.id)
- `created_at` (Timestamp)

### 1.3 Project Structure
```
/src
  /components
    /ui          # Reusable UI components
    /layout      # Layout components (Sidebar, Header)
    /features    # Feature-specific components
  /pages         # Page components
  /hooks         # Custom hooks
  /store         # Zustand store
  /types         # TypeScript types
  /utils         # Utility functions
  /services      # API services (Supabase client)
/server          # Express backend (if needed for custom logic beyond Supabase)
  /routes
  /controllers
```

## 2. Page Design & UI/UX

### 2.1 Design System
- **Colors**:
  - Primary: Red Gradient (from Logo) - `from-red-700 to-red-500`
  - Secondary: Dark Gray/Charcoal - `slate-900`
  - Background: Light Gray - `slate-50`
  - Surface: White - `white`
- **Typography**: Sans-serif (Inter or similar geometric font)
- **Components**: Rounded corners, subtle shadows, clean spacing.

### 2.2 Page Details

#### 1. Login Page (`/login`)
- **Layout**: Centered card on a red gradient background.
- **Content**:
  - Logo (Main Textildruck)
  - Email & Password input fields
  - "Login" button (Primary color)
  - Error message display

#### 2. Dashboard (`/`)
- **Layout**: Sidebar navigation (left), Header (top), Main content area.
- **Sidebar**:
  - Logo
  - Navigation Links: Dashboard, Orders, Inventory, Files, Admin (if admin)
  - User Profile (mini) & Logout
- **Content**:
  - **Stats Cards**: Active Orders, Pending Orders, Completed Today.
  - **Recent Activity**: List of recent order updates.
  - **Quick Actions**: "New Order", "Order Supplies".

#### 3. Order Management
- **Create Order (`/orders/new`)**:
  - Form: Customer Name, Deadline, Items (Dynamic list: Product, Size, Color, Qty).
  - "Create Order" button.
- **Active Orders (`/orders`)**:
  - Filterable list/table of orders.
  - Columns: ID, Customer, Date, Status (Badge), Actions (Edit, View).
  - Status flow: Pending -> Design -> Printing -> Finishing -> Shipped -> Completed.
- **Order Details (`/orders/:id`)**:
  - View order details.
  - Update status buttons.
  - Comments/Notes section.

#### 4. Inventory / Supplies (`/inventory`)
- **Order Supplies**:
  - Form to request new materials (T-shirts, Ink, etc.).
- **List**:
  - Table of ordered supplies and their status (Ordered / Received).

#### 5. Customer Files (`/files`)
- **Upload**: Drag & drop zone or file picker.
- **List**: Grid or List view of files.
- **Meta**: Customer Name, Date, File Type.
- **Actions**: Preview, Download, Delete.

#### 6. Admin (`/admin`) - Admin Only
- **User Management**:
  - List of employees.
  - "Add Employee" button (Email, Name, Role, Password).
  - Edit/Delete employee.

## 3. Implementation Plan
1. **Setup**: Initialize project, configure Tailwind, setup Supabase.
2. **Auth**: Implement Login and Protected Routes.
3. **Layout**: Create Dashboard Shell (Sidebar, Header).
4. **Features**:
   - Orders (CRUD)
   - Inventory (Simple list)
   - Files (Storage + Database)
5. **Refinement**: UI Polish (Gradients, Shadows), Error Handling.
