-- ════════════════════════════════════════════════════════════
-- MGE SCHOOL PORTAL v2 — Neon PostgreSQL Setup
-- Run this ONCE in: console.neon.tech → SQL Editor → New Query
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  access     TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── STUDENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  unit           TEXT NOT NULL CHECK (unit IN ('hindi','english','college')),
  name           TEXT NOT NULL,
  name_hindi     TEXT,
  roll_no        TEXT,
  class          TEXT,
  section        TEXT,
  gender         TEXT,
  dob            DATE,
  father_name    TEXT,
  mother_name    TEXT,
  phone          TEXT,
  father_phone   TEXT,
  address        TEXT,
  aadhar         TEXT,
  category       TEXT DEFAULT 'General',
  admission_date DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── FEE PAYMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_payments (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  student_id   TEXT REFERENCES students(id) ON DELETE CASCADE,
  unit         TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  mode         TEXT DEFAULT 'Cash',
  receipt_no   TEXT,
  payment_date DATE DEFAULT CURRENT_DATE,
  fee_type     TEXT DEFAULT 'Tuition',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── TEACHERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  unit          TEXT NOT NULL,
  name          TEXT NOT NULL,
  designation   TEXT,
  department    TEXT,
  subject       TEXT,
  qualification TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  dob           DATE,
  joining_date  DATE,
  salary        NUMERIC(10,2) DEFAULT 0,
  bank_account  TEXT,
  aadhar        TEXT,
  photo_url     TEXT,
  status        TEXT DEFAULT 'Active',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── SALARY PAYMENTS (monthly) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_payments (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  teacher_id  TEXT REFERENCES teachers(id) ON DELETE CASCADE,
  unit        TEXT NOT NULL,
  month       TEXT NOT NULL,
  year        INTEGER NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  mode        TEXT DEFAULT 'Bank Transfer',
  paid_date   DATE DEFAULT CURRENT_DATE,
  remarks     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ACCOUNT BALANCES (cash/bank per unit) ────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  unit         TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_name TEXT,
  balance      NUMERIC(12,2) DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── INCOME ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS income (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  unit        TEXT NOT NULL,
  source      TEXT NOT NULL,
  description TEXT,
  amount      NUMERIC(10,2) NOT NULL,
  date        DATE DEFAULT CURRENT_DATE,
  mode        TEXT DEFAULT 'Cash',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── EXPENSES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  unit        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  amount      NUMERIC(10,2) NOT NULL,
  date        DATE DEFAULT CURRENT_DATE,
  mode        TEXT DEFAULT 'Cash',
  bill_no     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── BUSES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buses (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  bus_no       TEXT NOT NULL UNIQUE,
  route        TEXT,
  driver       TEXT,
  driver_phone TEXT,
  capacity     INTEGER DEFAULT 0,
  students     INTEGER DEFAULT 0,
  status       TEXT DEFAULT 'Active',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRANSPORT EXPENSES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_expenses (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  bus_no      TEXT,
  type        TEXT,
  description TEXT,
  amount      NUMERIC(10,2) NOT NULL,
  date        DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── HOSTEL ROOMS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hostel_rooms (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  room_no         TEXT NOT NULL UNIQUE,
  floor           TEXT,
  capacity        INTEGER DEFAULT 4,
  occupied        INTEGER DEFAULT 0,
  fee_per_student NUMERIC(10,2) DEFAULT 3000,
  type            TEXT DEFAULT 'Standard',
  status          TEXT DEFAULT 'Available',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── HOSTEL STUDENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hostel_students (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name         TEXT NOT NULL,
  room_no      TEXT,
  unit         TEXT,
  class        TEXT,
  phone        TEXT,
  parent_phone TEXT,
  father_name  TEXT,
  monthly_fee  NUMERIC(10,2) DEFAULT 3000,
  check_in     DATE,
  status       TEXT DEFAULT 'Active',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── HOSTEL FEE PAYMENTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS hostel_fee_payments (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  student_name TEXT NOT NULL,
  month        TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  mode         TEXT DEFAULT 'Cash',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- SEED USERS  (temp password hash = 'temppass123')
-- Real passwords set by /api/seed?key=MGE2024SETUP
-- ════════════════════════════════════════════════════════════
INSERT INTO users (id, name, role, username, password, access) VALUES
('u_dir',  'Sh. Devilal Kumawat Ji', 'Director',               'director',    '$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['director']),
('u_hindi','Sh. Madanlal Ji',        'Principal – Hindi',       'hindi_prin',  '$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['hindi_principal']),
('u_eng',  'Sh. Kamlesh Kumar Ji',   'Principal – English',     'eng_prin',    '$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['english_principal']),
('u_col',  'Sh. Pankaj Sharma Ji',   'Principal – College',     'col_prin',    '$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['college_principal']),
('u_trans','Sh. Babulal Ji',         'Transport Head',          'transport_hd','$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['transport']),
('u_host', 'Sh. Suresh Kumar Ji',    'Hostel Warden',           'hostel_ward', '$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['hostel']),
('u_de_h', 'Hindi Data Entry',       'Data Entry – Hindi',      'hindi_data',  '$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['hindi_data']),
('u_de_e', 'English Data Entry',     'Data Entry – English',    'eng_data',    '$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['english_data']),
('u_de_c', 'College Data Entry',     'Data Entry – College',    'col_data',    '$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['college_data']),
('u_de_ho','Hostel Data Entry',      'Data Entry – Hostel',     'hostel_data', '$2a$10$rBnNSG7KRhEp73OPuXHGNeOsGWFuwFmpLFJQ8mMq7cAXiPVXnXXLi', ARRAY['hostel_data'])
ON CONFLICT (id) DO NOTHING;

-- ── SEED ACCOUNTS (all start at zero — update via portal) ────
INSERT INTO accounts (unit, account_type, account_name, balance) VALUES
('hindi',    'Cash', 'Hindi School – Cash Box',    0),
('hindi',    'Bank', 'Hindi School – SBI Account', 0),
('english',  'Cash', 'English School – Cash Box',  0),
('english',  'Bank', 'English School – SBI Account',0),
('college',  'Cash', 'Girls College – Cash Box',   0),
('college',  'Bank', 'Girls College – SBI Account',0),
('hostel',   'Cash', 'Hostel – Cash Box',          0),
('transport','Cash', 'Transport – Cash Box',        0),
('transport','Bank', 'Transport – Bank Account',   0)
ON CONFLICT DO NOTHING;

-- ── SAMPLE BUSES ────────────────────────────────────────────
INSERT INTO buses (id,bus_no,route,driver,driver_phone,capacity,students,status) VALUES
('b001','RJ-20-PA-1234','Kuchaman City – Ward 1','Ramchandra Ji','9414003001',40,32,'Active'),
('b002','RJ-20-PA-5678','Kuchaman City – Ward 2','Motichand Ji','9414003002',40,28,'Active'),
('b003','RJ-20-GA-9999','Nawa City Route','Bhagirath Ji','9414003003',35,20,'Active')
ON CONFLICT (id) DO NOTHING;

-- ── SAMPLE HOSTEL ROOMS ──────────────────────────────────────
INSERT INTO hostel_rooms (id,room_no,floor,capacity,occupied,fee_per_student,status) VALUES
('r001','101','Ground',4,4,3000,'Full'),
('r002','102','Ground',4,2,3000,'Available'),
('r003','201','First', 3,3,3500,'Full'),
('r004','202','First', 3,1,3500,'Available')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- Done! Deploy to Vercel, then run:
-- https://your-app.vercel.app/api/seed?key=MGE2024SETUP
-- ════════════════════════════════════════════════════════════
