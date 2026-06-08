import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.DB_SSL !== 'true') return url;
  // Phase 1: TLS-in-transit only, no cert validation. Matches `rejectUnauthorized: false`
  // in the NestJS+TypeORM services (baseapp-api, orchestration-system, incidents-api).
  // Only applies to MySQL/PostgreSQL — SQLite ignores the param.
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}sslaccept=accept_invalid_certs`;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: {
          url: buildDatabaseUrl(),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
