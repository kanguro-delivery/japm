import { Module } from '@nestjs/common';
import { AuditLoggerService } from './services/audit-logger.service';
import { StructuredLoggerService } from './services/structured-logger.service';
import { PromptBackupService } from './services/prompt-backup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [PrismaModule, ConfigModule],
    providers: [
        AuditLoggerService,
        StructuredLoggerService,
        PromptBackupService,
    ],
    exports: [
        AuditLoggerService,
        StructuredLoggerService,
        PromptBackupService,
    ],
})
export class CommonModule { } 