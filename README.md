# JAPM (Just Another Prompt Manager)

A robust, scalable, and secure prompt management system designed for multi-tenant environments. JAPM helps organizations manage, version, and deploy AI prompts efficiently across different projects and regions.

## Features

- **Multi-tenant Architecture**: Secure isolation between different organizations
- **Project-based Organization**: Group prompts by projects for better management
- **Version Control**: Track and manage different versions of prompts
- **Regional Support**: Deploy prompts with region-specific configurations
- **Role-based Access Control**: Fine-grained permissions for different user roles
- **API-first Design**: RESTful API for seamless integration with other systems
- **Swagger Documentation**: Interactive API documentation for easy testing and integration
- **Multiple Database Support**: SQLite, MySQL, and PostgreSQL compatibility
- **Docker & Kubernetes Ready**: Production-ready containerization and orchestration

## Tech Stack

- **Backend**: NestJS
- **Database**: SQLite (development), MySQL/PostgreSQL (production) with Prisma ORM
- **Authentication**: JWT-based authentication
- **API Documentation**: Swagger/OpenAPI
- **Caching**: In-memory caching for improved performance
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Kubernetes support with Helm charts

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Database system of choice (SQLite included by default)
- npm, yarn, or pnpm
- Docker (optional, for containerized deployment)

### Quick Start (SQLite)

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/japm.git
   cd japm
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp env.example .env
   ```

4. Initialize database:
   ```bash
   ./init_db.sh
   ```

5. Start the development server:
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3001`.

## Project Structure

```
japm/
├── src/                     # Source code
│   ├── auth/               # Authentication and authorization
│   ├── llm-execution/      # LLM execution and prompt processing
│   ├── project/            # Project management
│   ├── prompt/             # Prompt management
│   ├── serve-prompt/       # Prompt serving and resolution
│   ├── tenant/             # Tenant management
│   └── region/             # Regional configurations
├── prisma/                 # Database schema and migrations
├── seed/                   # Database seeding scripts
├── scripts/                # Utility scripts
├── docs/                   # Documentation
└── k8s/                    # Kubernetes manifests
```

## Scripts

### Docker

```bash
# Desarrollo
docker build -f Dockerfile.dev -t japm-dev .
docker run -p 3000:3000 japm-dev

# Producción
docker build -f Dockerfile.production -t japm-prod .
docker run -p 3000:3000 japm-prod

# Debug
docker build -f Dockerfile.debug -t japm-debug .
docker run -p 3000:3000 japm-debug
```

### Base de Datos

```bash
# Inicializar la base de datos
./init_db.sh

# Ejecutar migraciones
./run-migrations.sh

# Crear una nueva migración
npx prisma migrate dev --name nombre_de_la_migracion

# Generar el cliente de Prisma
npx prisma generate
```

### Inicialización en Producción

```bash
# 1. Configurar la base de datos
# Asegúrate de que la base de datos existe y las credenciales son correctas
mysql -u root -p
CREATE DATABASE japm;
CREATE USER 'japm_user'@'localhost' IDENTIFIED BY 'japm_password';
GRANT ALL PRIVILEGES ON japm.* TO 'japm_user'@'localhost';
FLUSH PRIVILEGES;

# 2. Aplicar migraciones en producción
npx prisma migrate deploy

# 3. Generar el cliente de Prisma
npx prisma generate

# 4. Verificar el estado de las migraciones
npx prisma migrate status
```

### Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run start:dev

# Ejecutar tests
npm run test

# Ejecutar linting
npm run lint
```

### Docker Compose

```bash
# Desarrollo
docker-compose up

# Producción
docker-compose -f docker-compose.production.yml up
```

## Docker Support

### Development with Docker

```bash
# Desarrollo con Docker Compose
docker-compose up

# O usando el Dockerfile de desarrollo
docker build -f Dockerfile.dev -t japm-dev .
docker run -p 3000:3000 japm-dev
```

### Production Deployment

```bash
# Construir y ejecutar en producción
docker build -f Dockerfile.production -t japm-prod .
docker run -p 3000:3000 japm-prod

# O usando Docker Compose para producción
docker-compose -f docker-compose.production.yml up
```

## Environment Configuration

Key environment variables:

```bash
# Database
DATABASE_URL="mysql://japm_user:japm_password@localhost:3306/japm"  # MySQL
#DATABASE_URL="file:./prisma/japm.db"  # SQLite
# DATABASE_URL="postgresql://user:pass@localhost:5432/japm"  # PostgreSQL

# Application
PORT=3001
NODE_ENV=development
JWT_SECRET=your_secure_secret

# AI Models
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
