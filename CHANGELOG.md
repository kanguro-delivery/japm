# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Enforce DB SSL (phase 1)**: Added an opt-in `DB_SSL` env var. When set to `"true"`, `PrismaService` appends `sslaccept=accept_invalid_certs` to `DATABASE_URL`, enabling TLS without certificate validation (Prisma's equivalent of `rejectUnauthorized: false`). Default is off so local SQLite/docker-compose MySQL keep working unchanged. `env.example` documents the variable.

  **Why**: AWS RDS for the test environment is being switched to enforce `require_secure_transport=ON` (plus transparent encryption-at-rest via KMS). Without a client-side TLS opt-in the service would fail to connect to RDS with `Connections using insecure transport are prohibited`.

  **Impact**: No runtime impact for local development (SSL remains off by default). Deployed environments (test first, then staging/prod) need `DB_SSL=true` set in their env-var source **before** RDS starts enforcing SSL.

  **Breaking**: NO for local dev or any environment that does not have `DB_SSL=true` set. The change is purely additive and gated.

  **Key decisions**:
  - Phase 1 ships **without certificate validation**. The DB lives in an internal AWS subnet, so MITM is treated as out-of-scope. Proper CA validation is **deferred to phase 2**.
  - Truthy check is strict `=== 'true'`, matching the convention used in baseapp-api (PR #695), orchestration-system, and incidents-api.
  - Implemented at the URL layer because Prisma's `PrismaClient` constructor exposes the URL but not driver-level SSL options; appending the query param is the supported Prisma mechanism.
  - SQLite ignores the param, so the same flag is safe across all three providers configured in `schema.prisma`.

## [1.0.0] - 2025-05-25

### Added
- **Core Prompt Management System**
  - Multi-tenant prompt management with project-based organization
  - Complete CRUD operations for prompts, versions, and translations
  - Advanced prompt versioning with semantic tags and change tracking
  - Multi-language translation support with regional configurations
  - Prompt reference resolution system ({{prompt:name:version}} syntax)

- **Authentication & Authorization**
  - JWT-based authentication system
  - Role-based access control (RBAC)
  - Project-level permission guards
  - Multi-tenant isolation and security

- **Advanced Features**
  - Asset management and translation system
  - AI model integration for prompt execution
  - Cultural data support for localization
  - Marketplace functionality for prompt sharing
  - RAG document metadata management

- **Production Infrastructure**
  - Docker containerization with multi-stage builds
  - Kubernetes deployment configurations
  - Support for SQLite (dev), MySQL, and PostgreSQL
  - Comprehensive audit logging and structured logging
  - Health checks and monitoring endpoints
  - Rate limiting and throttling protection

- **API & Documentation**
  - RESTful API with OpenAPI/Swagger documentation
  - Comprehensive endpoint coverage
  - Interactive API testing interface
  - Complete TypeScript type definitions

- **Testing & Quality**
  - 73 unit tests covering core functionality
  - 45 end-to-end tests for complete workflows
  - Automated migration handling and database seeding
  - Robust test setup and cleanup procedures

### Technical Details
- **Framework**: NestJS with TypeScript
- **Database**: Prisma ORM with multi-database support
- **Authentication**: JWT with Passport strategies
- **API Documentation**: Swagger/OpenAPI integration
- **Testing**: Jest with comprehensive unit and e2e tests
- **Deployment**: Docker + Kubernetes ready
- **Monitoring**: Structured logging with audit trails

### Security
- JWT token-based authentication
- Multi-tenant data isolation
- Input validation with class-validator
- Rate limiting and request throttling
- Audit logging for all operations
- Secure handling of sensitive data

### Performance
- Optimized database queries with Prisma
- In-memory caching for frequently accessed data
- Efficient prompt reference resolution
- Containerized deployment for scalability

### Known Limitations
- TypeScript linting issues need attention (912 items)
- Test coverage could be improved (currently 10.96%)
- Rate limiting temporarily disabled for development

## [Unreleased]

### Planned Features
- Enhanced audit log search and filtering
- Real-time notifications system
- Advanced analytics dashboard
- CI/CD pipeline automation
- Performance optimizations

---

## Migration Guide

For detailed deployment and migration instructions, see:
- `docs/deployment.md` - Production deployment guide
- `docs/DATABASE.md` - Database configuration and migration
- `docs/architecture.md` - System architecture overview
- `README.md` - Quick start and development setup 