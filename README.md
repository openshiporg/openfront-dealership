![Openfront Dealership](https://openship.org/og/openfront-dealership.png)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenshiporg%2Fopenfront-dealership&env=DATABASE_URL%2CSESSION_SECRET%2CS3_BUCKET_NAME%2CS3_REGION%2CS3_ACCESS_KEY_ID%2CS3_SECRET_ACCESS_KEY)

Openfront Dealership is a self-hostable digital showroom and dealership-operations application. Shoppers can explore vehicles, compare options, and submit sales, test-drive, trade-in, finance, or service requests. Teams coordinate inventory, CRM, deal desk, finance records, delivery, service, parts, and accounting.

## Demo

![Vehicle photograph included with the Dealership storefront](public/images/family-suv.jpg)

Explore the application locally using the setup instructions below.

| | |
|---|---|
| **Public application** | `/` on your development URL |
| **Dashboard** | `/dashboard` on your development URL |

[Learn more →](https://openship.org/products/openfront-dealership)

[Documentation →](https://docs.openship.org/docs/openfront/dealership/)

## The Openfront Ecosystem

Openfront is part of an ecosystem of open-source commerce tools:

- **[Openfront E-commerce](https://github.com/openshiporg/openfront)**: Headless e-commerce for retail.
- **[Openfront Restaurant](https://github.com/openshiporg/openfront-restaurant)**: Restaurant ordering, point of sale, and kitchen operations.
- **[Openship](https://github.com/openshiporg/openship)**: Order routing for multi-channel fulfillment.
- **Openfront Dealership**: (This repository) a self-hostable digital showroom and dealership-operations application.

## Core Features

### Admin Dashboard
Manage accounting, store settings, crm, deals, test drives, delivery, vehicles, finance, service, overview, analytics, trade ins through dedicated dashboard workspaces and permission-controlled data screens.

### Storefront
Public routes include `/inventory`, vehicle details, `/compare`, `/test-drive`, `/trade-in`, `/financing`, `/service`, and customer accounts. Financing intake is a request workflow, not a promise of lender approval.

### Vehicle Inventory & CRM
Track acquisitions, stock, recon work, merchandising versions, pricing, customer identity, lead assignments, interactions, and contact preferences.

### Deal Desk & Finance
Prepare deal pencils, record approvals, financing applications, lender submissions and decisions, finance products, funding cases, and contract packages.

### Delivery & Fixed Operations
Coordinate delivery cases and we-owe items, service appointments and repair orders, labor operations, parts inventory, purchasing, and accounting batches. External lender and accounting responses must be configured and recorded through their workflows.

## Architecture

### Technology Stack
- **Frontend**: Next.js 16 with App Router and React 19.
- **Backend**: KeystoneJS 6 with a GraphQL API.
- **Database**: PostgreSQL with Prisma ORM.
- **Styling**: Tailwind CSS 4 and shared shadcn/ui components.
- **Authentication**: Password-based user accounts and session-based access with role capabilities.

### Application Structure
```text
openfront-dealership/
├── app/                    # Public pages, dashboard routes, and HTTP endpoints
├── features/
│   ├── keystone/           # Backend models, access rules, and GraphQL workflows
│   ├── platform/           # Operator workspaces and onboarding
│   ├── storefront/         # Public application components and screens
│   └── dashboard/          # Authentication and shared dashboard shell
└── components/             # Shared UI components
```

### Data Models
The [model registry](features/keystone/models/index.ts) and [Prisma schema](schema.prisma) cover:

- Dealer groups, rooftops, memberships, roles, and dealership profiles.
- Vehicles, images, condition, history, acquisitions, stock events, and merchandising versions.
- Customers, leads, tasks, test drives, deals, approvals, and financing records.
- Delivery cases, service orders, repair lines, parts, accounting batches, payment records, and reports.

## Getting Started

### Prerequisites
- Node.js 22, compatible with the [package requirements](package.json) and Next.js 16.
- A PostgreSQL database you can migrate.
- npm.

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/openshiporg/openfront-dealership.git
   cd openfront-dealership
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Review the [example configuration](.env.example) and replace its placeholders. Keep only the local settings you need; do not copy production-mode or infrastructure examples unchanged.

   ```env
   DATABASE_URL=postgresql://user:password@host/database
   SESSION_SECRET=replace-with-a-new-private-random-secret
   ```

   Generate the session secret with `openssl rand -hex 32`; use the generated value, not the placeholder. Never commit `.env`.

   Review [runtime configuration](features/keystone/index.ts) for additional application settings before building or deploying. Configure enabled integrations separately; the two values above are not a complete production configuration.

   Production also requires configured object storage. Set `S3_BUCKET_NAME`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`, and supply the S3-compatible endpoint described in the source. Review mail and application-specific security settings there as well.

3. **Start development server:**
   ```bash
   npm run dev
   ```

   The development script prepares the backend schema, applies checked-in migrations, and starts Next.js.

4. **Access the application:**
   Open the URL `npm run dev` prints, then use these paths:

   - **Public application**: `/`
   - **Admin dashboard**: `/dashboard`
   - **GraphQL API**: `/api/graphql`

5. **Create your first admin user:**
   Visit `/dashboard/init` on an empty database to create the initial administrator, then sign in to the dashboard.

6. **Run application onboarding:**
   Use dealership onboarding to establish dealer-group and rooftop records, memberships, public profile, and inventory. Review finance, service, and provider configuration before enabling their workflows.

## Development Commands

- `npm run dev` - Prepare the backend schema, apply migrations, and start Next.js development.
- `npm run build` - Build the backend and Next.js for production; does not apply migrations.
- `npm start` - Start the production Next.js server.
- `npm run migrate:gen` - Prepare the schema and generate/apply development migrations.
- `npm run migrate` - Apply checked-in Prisma migrations.
- `npm run lint` - Run the repository's ESLint script.

Use a disposable development database for migration generation. Review the script before running it against any existing data.

### Finance & Accounting Workflows
The [business-command registry](features/keystone/mutations/index.ts) connects lender decisions, finance operations, delivery, service, payment records, and accounting operations. A stored provider response or submission is not a guarantee of an active external connection.

## Documentation

See the [Openfront Dealership documentation](https://docs.openship.org/docs/openfront/dealership/) for the application guide. The [backend models](features/keystone/models), [registered business workflows](features/keystone/mutations/index.ts), [access rules](features/keystone/access.ts), and [application routes](app) document the implementation in this repository.

## Security & Permissions

### Role-Based Access Control
- `canAccessDashboard` - Access dashboard.
- `canManageInventory` - Manage inventory.
- `canManageLeads` - Manage leads.
- `canManageDeals` - Manage deals.
- `canApproveDeals` - Approve deals.
- `canManageFinancing` - Manage financing.
- `canManageService` - Manage service.

### Security Features
- Session-based authentication for signed-in users.
- Backend list access and workflow authorization, rather than dashboard visibility alone.
- Operational access is scoped by dealer-group and rooftop memberships. Global user and role administration remains separate from rooftop capabilities; lead visibility also respects assignment and broader-view permissions.

Review the [access implementation](features/keystone/access.ts) and individual workflow checks before extending permissions.

## Platform Components

### Admin Platform (`/dashboard`)
- **Accounting**: `/dashboard/platform/accounting`.
- **Store Settings**: `/dashboard/platform/store-settings`.
- **Crm**: `/dashboard/platform/crm`.
- **Deals**: `/dashboard/platform/deals`.
- **Test Drives**: `/dashboard/platform/test-drives`.
- **Delivery**: `/dashboard/platform/delivery`.
- **Vehicles**: `/dashboard/platform/vehicles`.
- **Finance**: `/dashboard/platform/finance`.
- **Service**: `/dashboard/platform/service`.
- **Overview**: `/dashboard/platform/overview`.
- **Analytics**: `/dashboard/platform/analytics`.
- **Trade Ins**: `/dashboard/platform/trade-ins`.

### Storefront Experience
Public routes include `/inventory`, vehicle details, `/compare`, `/test-drive`, `/trade-in`, `/financing`, `/service`, and customer accounts. Financing intake is a request workflow, not a promise of lender approval.

Track acquisitions, stock, recon work, merchandising versions, pricing, customer identity, lead assignments, interactions, and contact preferences.

## Deployment

### Production Deployment
The Vercel button imports this application's own repository. Provision PostgreSQL and configure the application's complete runtime requirements, storage, mail, and enabled providers before building. Importing the source does not configure these services.

Build the application and apply checked-in migrations as a release step before starting the server. Back up existing data before migration.

```bash
npm run build
npm run migrate
npm start
```

The included [Railway configuration](railway.toml) defines this app's build and startup lifecycle. Provision services and secrets separately.

### Scaling Considerations
Keep the shared PostgreSQL database, session secrets, and configured object storage consistent across application processes. Review background delivery and integration requirements before choosing a serverless runtime; a source import does not supply persistent workers.

## Contributing

Use the development commands above when preparing changes. Keep model changes and their migrations together, and describe workflow and permission changes in pull requests.

## License

No top-level license file or package license declaration is included in this repository.

## Support

- **Documentation**: [Openfront Dealership guide](https://docs.openship.org/docs/openfront/dealership/).
- **Issues**: [Report bugs and feature requests](https://github.com/openshiporg/openfront-dealership/issues).
- **Product**: [Learn more about Openfront Dealership](https://openship.org/products/openfront-dealership).

---

Built with [Next.js](https://nextjs.org) and [KeystoneJS](https://keystonejs.com).
