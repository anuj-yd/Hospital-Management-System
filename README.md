# 🏥 Hospital Management System (HMS) - REST API

An enterprise-grade, secure, and modular clinical administration backend built with **Node.js**, **Express**, **Prisma ORM**, and **PostgreSQL 16**. Featuring strict **Role-Based Access Control (RBAC)**, transaction-safe appointment scheduling, electronic medical records (EMR), automated billing with Decimal precision, comprehensive audit trails, and self-documenting OpenAPI 3.0 explorer.

---

## 📑 Table of Contents

- [Executive Overview](#-executive-overview)
- [System Architecture](#-system-architecture)
  - [Layered Request Pipeline](#layered-request-pipeline)
  - [Codebase Directory Structure](#codebase-directory-structure)
- [Prerequisites](#-prerequisites)
- [Environment Variables](#-environment-variables)
- [Step-by-Step Setup](#-step-by-step-setup)
- [Demo Credentials](#-demo-credentials)
- [Testing Suite](#-testing-suite)
- [API Documentation](#-api-documentation)
- [RBAC Permission Matrix](#-rbac-permission-matrix)
- [Key Design Decisions](#-key-design-decisions)
- [Known Limitations](#-known-limitations)
- [Assessment Acceptance Verification](#-assessment-acceptance-verification)

---

## 🌟 Executive Overview

The Hospital Management System REST API is engineered to solve complex operational challenges in healthcare clinics and hospitals:
- **Zero Race Conditions**: PostgreSQL partial unique constraints and atomic row-level locks prevent double-booking and payment settlement races under high concurrency.
- **Strict Role-Based Security**: Three defined staff tiers (`ADMIN`, `FRONT_DESK`, `CLINICIAN`) with clinical narrative protection and read/write perimeter checks.
- **Audit Compliance**: Immutable audit logging tracks every sensitive entity creation, status transition, monetary adjustment, and demographic access with user, IP, and timestamp provenance.
- **Decimal Precision Billing**: Exact Decimal calculations ensure line item totals, taxes, discounts, and payments reconcile without floating-point rounding errors.

---

## 🏗 System Architecture

### Layered Request Pipeline

The architecture follows a strict, unidirectional pattern:
**`Routes` $\to$ `Middleware` $\to$ `Controller` $\to$ `Service` $\to$ `Repository` $\to$ `PostgreSQL Database`**

```
                     ┌─────────────────────────────────────────┐
                     │            Client HTTP Client           │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │           Global Middleware             │
                     │  Helmet • CORS • RateLimit • PinoHttp   │
                     │    RequestID • AsyncLocalStorage Ctx    │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │        Security & Routing Layer         │
                     │  authenticate.js   •   authorize.js     │
                     │       Zod DTO Schema Validation         │
                     │     idempotency.js Middleware           │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │           Controller Layer              │
                     │ HTTP Request/Response Parsing & Status  │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │             Service Layer               │
                     │  Business Logic • Decimal Calculations  │
                     │  State Machine • Invariant Enforcement  │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │           Repository Layer              │
                     │  Prisma Queries • Raw SQL Aggregations  │
                     │  Row Locks (SELECT FOR UPDATE) • Seqs   │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │          PostgreSQL 16 Engine           │
                     │  Partial Indexes • Foreign Keys • Enums │
                     └─────────────────────────────────────────┘
```

### Codebase Directory Structure

```text
HMS/
├── docs/
│   ├── openapi.yaml                 # OpenAPI 3.0 complete API specification
│   └── ERD.md                       # Mermaid ERD with cardinalities & index analysis
├── backend/
│   ├── docker-compose.yml           # PostgreSQL container orchestration
│   ├── package.json                 # Dependencies and test runner scripts
│   ├── jest.config.js               # Jest ESM test runner configuration
│   ├── .env.example                 # Environment configuration template
│   ├── docs/
│   │   ├── openapi.yaml             # API specification (served at /api-docs)
│   │   └── ERD.md                   # Database schema documentation
│   ├── prisma/
│   │   ├── schema.prisma            # Declarative Prisma schema (16 models, 8 enums)
│   │   ├── migrations/              # Database migration history
│   │   └── seed.js                  # Synthetic data seeder (users, doctors, patients, appts)
│   ├── src/
│   │   ├── app.js                   # Express application setup and route mounting
│   │   ├── server.js                # Server entrypoint with graceful shutdown handlers
│   │   ├── config/
│   │   │   ├── env.js               # Validated environment configuration
│   │   │   ├── logger.js            # Structured Pino logger
│   │   │   └── swagger.js           # Swagger UI explorer configuration
│   │   ├── common/
│   │   │   ├── constants/           # Roles, statuses, transition maps, permissions
│   │   │   ├── context/             # AsyncLocalStorage request context
│   │   │   ├── errors/              # Domain AppError hierarchy
│   │   │   ├── middleware/          # authenticate, authorize, validate, rateLimit, error
│   │   │   └── utils/               # dates, money, pagination, response helpers
│   │   ├── infra/
│   │   │   └── prisma.js            # Prisma client singleton
│   │   └── modules/
│   │       ├── auth/                # Login, refresh token rotation, revocation
│   │       ├── users/               # Administrative staff accounts & password resets
│   │       ├── departments/         # Clinical departments with deactivation protection
│   │       ├── doctors/             # Doctor profiles, fees, specialization
│   │       ├── schedules/           # Weekly recurring templates & slot alignment
│   │       ├── patients/            # Patient demographics & concurrency-safe MRN
│   │       ├── appointments/        # Slot generation, atomic booking, transitions
│   │       ├── visits/              # EMR encounters, notes, clinical closure
│   │       ├── prescriptions/       # Medical prescriptions with dosage validation
│   │       ├── diagnostic-reports/  # Diagnostic metadata & status management
│   │       ├── billing/             # Invoicing, Decimal totals, sandbox payment gateway
│   │       ├── reports/             # SQL analytics, dashboard KPIs, billing summaries
│   │       └── audit/               # Immutable compliance change tracker
│   └── tests/
│       ├── helpers/                 # authHelper, fixtures, dbReset, globalSetup
│       ├── unit/                    # 81 unit tests across all domain services
│       └── integration/             # Supertest suites covering A1-A5 & negative cases
└── README.md
```

---

## 💻 Prerequisites

- **Node.js**: `v20.0.0` or higher (`v24.x` supported)
- **Docker Desktop**: Docker Engine & Docker Compose
- **PostgreSQL**: `16-alpine` (managed automatically via Docker)
- **Package Manager**: `npm` (v10+) or `pnpm`

---

## ⚙️ Environment Variables

Copy `backend/.env.example` to `backend/.env`. All default values are configured for local development:

| Variable | Type | Default | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | `string` | `development` | Runtime environment (`development`, `test`, `production`) |
| `PORT` | `number` | `3000` | HTTP application port |
| `DATABASE_URL` | `string` | `postgresql://hms_user:hms_password@localhost:5432/hms_dev?schema=public` | Primary PostgreSQL connection string |
| `TEST_DATABASE_URL`| `string` | `postgresql://hms_user:hms_password@localhost:5432/hms_test?schema=public` | Isolated test database connection string |
| `JWT_ACCESS_SECRET`| `string` | *(32+ char secret)* | Cryptographic HMAC secret for short-lived access tokens |
| `JWT_REFRESH_SECRET`| `string`| *(32+ char secret)* | Cryptographic secret for rotating refresh tokens |
| `JWT_ACCESS_TTL` | `string` | `15m` | Access token lifespan (e.g. `15m`, `1h`) |
| `JWT_REFRESH_TTL`| `string` | `7d` | Refresh token lifespan (e.g. `7d`, `30d`) |
| `CLINIC_TZ` | `string` | `Asia/Kolkata` | Standard operational clinic timezone (e.g. `Asia/Kolkata`) |
| `BCRYPT_ROUNDS` | `number` | `12` | Salt rounds for password hashing |
| `CORS_ORIGINS` | `string` | `http://localhost:5173,http://localhost:3000` | Whitelisted frontend web origins |
| `LOG_LEVEL` | `string` | `debug` | Structured logger threshold (`fatal`, `error`, `warn`, `info`, `debug`) |

---

## 🚀 Step-by-Step Setup

### Step 1: Start PostgreSQL via Docker

From the `backend/` directory:

```bash
cd backend
docker compose up -d
```

Verify that the `hms-postgres` container is healthy and listening on port `5432`:

```bash
docker ps --filter "name=hms-postgres"
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Run Database Migrations

Apply the migration history to initialize tables, partial unique indexes, and sequences:

```bash
npx prisma migrate dev
```

### Step 4: Seed Synthetic Clinic Data

Seeds administrative staff, departments, doctors, weekly schedules, 25 synthetic patients, appointments, visits, prescriptions, and invoices:

```bash
node prisma/seed.js
```

### Step 5: Start the Application

```bash
# Development mode with hot-reload:
npm run dev

# Production mode:
npm start
```

The API will start at **`http://localhost:3000`**.  
Swagger documentation is available at **`http://localhost:3000/api-docs`**.

---

## 🔐 Demo Credentials

All seed accounts are pre-configured with secure credentials:

| Role | Full Name | Email Address | Password | Department / Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | System Administrator | `admin@hms.test` | `Admin@12345` | Global hospital administration & audit |
| **FRONT_DESK** | Priya Sharma | `frontdesk1@hms.test` | `FrontDesk@12345` | Patient registration, scheduling & billing |
| **FRONT_DESK** | Rahul Verma | `frontdesk2@hms.test` | `FrontDesk@12345` | Desk check-ins, payments & invoicing |
| **CLINICIAN** | Dr. Rajesh Sharma | `dr.sharma@hms.test` | `Doctor@12345` | Cardiology (Specialist) |
| **CLINICIAN** | Dr. Anita Patel | `dr.patel@hms.test` | `Doctor@12345` | Pediatrics (Specialist) |
| **CLINICIAN** | Dr. David Williams | `dr.williams@hms.test` | `Doctor@12345` | Orthopedics (Specialist) |

---

## 🧪 Testing Suite

The testing suite contains unit tests, integration tests, and acceptance test coverage:

```bash
# Run unit tests across all 9 domain test suites:
npm run test:unit --prefix backend

# Run integration tests (requires live PostgreSQL connection):
npm run test:integration --prefix backend

# Run code coverage analysis:
npm run test:coverage --prefix backend
```

---

## 📖 API Documentation

Interactive Swagger UI documentation is served automatically:
- **Swagger UI URL**: `http://localhost:3000/api-docs`
- **Raw OpenAPI 3.0 Spec**: `backend/docs/openapi.yaml` (also mirrored at `docs/openapi.yaml`)
- **Root Redirect**: Accessing `http://localhost:3000/` automatically redirects to `/api-docs`.

---

## 🛡 RBAC Permission Matrix

| Endpoint Group | Method | Path | Allowed Roles | Description |
| :--- | :---: | :--- | :---: | :--- |
| **Auth** | `POST` | `/api/v1/auth/login` | Public | Authenticates credentials, returns access & refresh tokens |
| | `POST` | `/api/v1/auth/refresh` | Public | Rotates single-use refresh token |
| | `POST` | `/api/v1/auth/logout` | Authenticated | Revokes refresh token in database |
| | `GET` | `/api/v1/auth/me` | Authenticated | Returns current authenticated profile |
| **Users** | `POST/GET`| `/api/v1/users` | `ADMIN` | Manage staff accounts; passwords omitted; audited |
| | `PATCH` | `/api/v1/users/:id` | `ADMIN` | Update staff role or status |
| | `POST` | `/api/v1/users/:id/reset-password` | `ADMIN` | Enforce administrative password reset |
| **Departments**| `GET` | `/api/v1/departments` | All Roles | View department listing |
| | `POST/PATCH`| `/api/v1/departments/:id` | `ADMIN` | Create or update departments; 422 if active doctors exist |
| **Doctors** | `GET` | `/api/v1/doctors` | All Roles | List doctors with specialization and fee |
| | `POST/PATCH`| `/api/v1/doctors/:id` | `ADMIN` | Link clinician user to doctor profile |
| **Schedules** | `GET` | `/api/v1/doctors/:id/schedules` | All Roles | View doctor weekly schedules |
| | `PUT` | `/api/v1/doctors/:id/schedules` | `ADMIN` | Replace weekly schedule atomically |
| **Patients** | `POST` | `/api/v1/patients` | `ADMIN`, `FRONT_DESK` | Register patient with concurrency-safe MRN (`HMS-XXXXXX`) |
| | `GET` | `/api/v1/patients` | `ADMIN`, `FRONT_DESK`, `CLINICIAN` | List patients (CLINICIAN scoped to own patients) |
| | `GET` | `/api/v1/patients/:id` | `ADMIN`, `FRONT_DESK`, `CLINICIAN` | View demographics; audited on every read |
| | `PATCH` | `/api/v1/patients/:id` | `ADMIN`, `FRONT_DESK` | Update demographics |
| | `DELETE`| `/api/v1/patients/:id` | `ADMIN` | Soft-deactivate patient (`isActive: false`) |
| **Slots** | `GET` | `/api/v1/doctors/:id/slots` | All Roles | Dynamic 14-day slot generator in clinic timezone |
| **Appointments**| `POST`| `/api/v1/appointments` | `ADMIN`, `FRONT_DESK` | Idempotent slot booking; 409 on slot collision |
| | `GET` | `/api/v1/appointments` | All Roles | Paginated list (CLINICIAN scoped to own doctor) |
| | `PATCH` | `/api/v1/appointments/:id/reschedule` | `ADMIN`, `FRONT_DESK` | Reschedule (max 3 times; atomic slot swap) |
| | `POST` | `/api/v1/appointments/:id/cancel` | `ADMIN`, `FRONT_DESK` | Cancel appointment; slot immediately freed |
| | `POST` | `/api/v1/appointments/:id/check-in`| `FRONT_DESK` | Mark checked in on appointment date |
| | `POST` | `/api/v1/appointments/:id/no-show` | `FRONT_DESK` | Mark no-show after start time has elapsed |
| **Visits** | `POST` | `/api/v1/visits` | `CLINICIAN` (Owner) | Create OPEN visit from CHECKED_IN appointment |
| | `GET` | `/api/v1/visits/:id` | All Roles | CLINICIAN own only; FRONT_DESK stripped of clinical notes |
| | `PATCH` | `/api/v1/visits/:id` | `CLINICIAN` (Owner) | Update chief complaint / clinical notes while OPEN |
| | `POST` | `/api/v1/visits/:id/close` | `CLINICIAN` (Owner) | Atomic OPEN $\to$ CLOSED & Appointment $\to$ COMPLETED |
| **Prescriptions**| `POST/GET`| `/api/v1/visits/:id/prescriptions`| `CLINICIAN` (Owner) | Add/list prescriptions (duration: 1-365 days) |
| **Reports** | `POST/PATCH`| `/api/v1/diagnostic-reports`| `CLINICIAN` (Owner) | Order/complete diagnostic metadata |
| **Billing** | `POST` | `/api/v1/invoices` | `ADMIN`, `FRONT_DESK` | Create DRAFT invoice with Decimal totals; CLINICIAN denied (403) |
| | `POST/DELETE`| `/api/v1/invoices/:id/items` | `ADMIN`, `FRONT_DESK` | Add or delete line items on DRAFT invoice |
| | `POST` | `/api/v1/invoices/:id/issue` | `ADMIN`, `FRONT_DESK` | Lock invoice amounts (DRAFT $\to$ ISSUED) |
| | `POST` | `/api/v1/invoices/:id/payments` | `ADMIN`, `FRONT_DESK` | Row-locked payment simulation; idempotency cache |
| | `POST` | `/api/v1/invoices/:id/void` | `ADMIN` only | Void invoice with 0 succeeded payments |
| **Analytics** | `GET` | `/api/v1/reports/dashboard` | `ADMIN`, `FRONT_DESK` | Operational KPIs & month-to-date metrics |
| | `GET` | `/api/v1/reports/appointments-summary` | `ADMIN` | SQL aggregation by day, doctor, department, or status |
| | `GET` | `/api/v1/reports/billing-summary` | `ADMIN`, `FRONT_DESK` | Invoiced, collected, and outstanding totals |
| **Audit** | `GET` | `/api/v1/audit-logs` | `ADMIN` only | Read-only compliance viewer; no update or delete |

---

## 💡 Key Design Decisions

1. **Partial Unique Index on Appointment Slots**:
   - Instead of relying on vulnerable application-level pre-checks that suffer from race conditions, double-booking is prevented at the database kernel level using a partial index:
     ```sql
     CREATE UNIQUE INDEX "appointment_doctor_slot_active_uq"
     ON "Appointment" ("doctorId", "startTime")
     WHERE status IN ('SCHEDULED', 'CHECKED_IN');
     ```
   - When an appointment is `CANCELLED` or `NO_SHOW`, the index ignores it, immediately freeing the slot without table cleanup.
2. **Single-Transaction Isolation (`prisma.$transaction`)**:
   - Appointment booking atomically creates the appointment, inserts the initial `AppointmentHistory` row, and records the `AuditLog` inside a single ACID transaction.
   - Closing a clinical visit moves `Visit.status = CLOSED` and `Appointment.status = COMPLETED` simultaneously.
3. **Pessimistic Row-Level Locking on Payments**:
   - During payment settlement, concurrent requests for the same invoice are serialized using raw SQL row locking:
     ```sql
     SELECT id, "totalAmount", "amountPaid", status
     FROM "Invoice"
     WHERE id = $1::uuid FOR UPDATE;
     ```
   - This prevents two parallel payment submissions from overpaying the outstanding balance.
4. **Idempotency Key Middleware**:
   - All critical mutations (`POST /appointments`, `POST /invoices/:id/payments`) support the `Idempotency-Key` header.
   - Responses are persisted in the `IdempotencyKey` table and replayed with the `X-Idempotent-Replay: true` header when duplicate requests arrive.
5. **Safe Sequence Generation for Identifiers**:
   - Medical Record Numbers (`HMS-XXXXXX`) and Invoice Numbers (`INV-YYYY-XXXXXX`) are generated using dedicated PostgreSQL sequences (`patient_mrn_seq`, `invoice_num_seq`) via `nextval()`, preventing sequence collisions under heavy concurrent registration.
6. **Immutable Audit Trail with Redaction**:
   - Auditing records attribute-level deltas while redacting sensitive fields (`passwordHash`, `clinicalNotes`, `refreshToken`). Audit records have no `UPDATE` or `DELETE` endpoints.

---

## ⚠️ Known Limitations

1. **In-Memory Rate Limiting**:
   - The rate limiters currently utilize an in-memory store. In a multi-instance distributed cluster, backing the rate limiters with Redis (`rate-limit-redis`) is recommended.
2. **File Attachments in Diagnostic Reports**:
   - As per assessment specifications, `DiagnosticReport.fileReference` stores document metadata only. Real-world deployments should integrate S3/GCS presigned upload URLs with virus scanning.
3. **No External Payment Gateway SDK**:
   - Payments run against an integrated sandbox gateway simulator (`simulateOutcome: 'success' | 'fail'`) rather than an external provider (Razorpay/Stripe).
4. **Sequence Rollover**:
   - Sequence generation resets at database creation. For multi-facility healthcare systems, prefixing sequences with facility branch codes is advised.

---

## 📋 Assessment Acceptance Verification

| Criteria | Assessment Requirement | Implementation File | Verification Test File |
| :---: | :--- | :--- | :--- |
| **A1** | Patient booked into an available slot | `src/modules/appointments/appointments.service.js` | `tests/integration/acceptance.test.js` |
| **A2** | Conflicting booking prevented (10 concurrent attempts) | `prisma/migrations/20261106000000_init/migration.sql` | `tests/integration/appointments.concurrency.test.js` |
| **A3** | Strict RBAC allowed vs forbidden across roles | `src/common/middleware/authorize.js` | `tests/unit/rbac.test.js` & `tests/integration/acceptance.test.js` |
| **A4** | Invoice reconciles with items, tax, discount & payments | `src/modules/billing/billing.service.js` | `tests/unit/billing.test.js` |
| **A5** | Sensitive read/edit produces audit rows | `src/modules/audit/audit.service.js` | `tests/unit/audit.test.js` & `tests/integration/acceptance.test.js` |
| **Neg**| Standard error shape (400, 401, 403, 404, 409, 422, 429) | `src/common/middleware/errorHandler.js` | `tests/unit/infra.test.js` |
| **Docs**| OpenAPI 3.0 specification & Swagger UI explorer | `docs/openapi.yaml` & `src/config/swagger.js` | Served at `GET /api-docs` |
| **ERD** | Mermaid entity relationship diagram with cardinalities | `docs/ERD.md` | Verified Mermaid syntax |
