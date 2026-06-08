import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const SSL_PARAMS = 'sslidentity=&sslpassword=&sslcert=&sslaccept=accept_invalid_certs';

function buildDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.DB_SSL !== 'true') return url;
  // Phase 1: TLS-in-transit only, no cert validation. Equivalent of `rejectUnauthorized: false`
  // in the NestJS+TypeORM services (baseapp-api, orchestration-system, incidents-api).
  // Empty `sslidentity`/`sslpassword`/`sslcert` paired with `sslaccept=accept_invalid_certs`
  // is the documented Prisma+MySQL pattern that reliably forces a TLS handshake on AWS RDS
  // without requiring a local cert file. SQLite ignores the params.
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${SSL_PARAMS}`;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

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
    const rawUrl = process.env.DATABASE_URL ?? '';
    const host = rawUrl.replace(/^[a-z]+:\/\/[^@]*@/, '').split(/[/?]/)[0] || '<unset>';
    this.logger.log(
      `Prisma init: DB_SSL=${process.env.DB_SSL ?? '<unset>'} host=${host} tls=${process.env.DB_SSL === 'true' ? 'on' : 'off'}`,
    );
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
