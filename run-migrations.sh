#!/bin/sh
# run-migrations.sh

# Salir inmediatamente si un comando falla
set -e

# Ejecutar las migraciones de Prisma
# Este comando aplica las migraciones pendientes sin generar nuevas ni interactuar.
# Es ideal para CI/CD y entornos de producción.
echo "Applying Prisma migrations..."
npx prisma migrate deploy

echo "Prisma migrations applied successfully." 