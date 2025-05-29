import { Module } from '@nestjs/common';
import { PromptAssetVersionService } from './prompt-asset-version.service';
import { PromptAssetVersionController } from './prompt-asset-version.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { CommonModule } from '../common/common.module';
import { ActivityLogModule } from '../services/activity-log.module';

@Module({
  imports: [
    PrismaModule,
    TenantModule,
    CommonModule,
    ActivityLogModule
  ],
  controllers: [PromptAssetVersionController],
  providers: [PromptAssetVersionService],
  exports: [PromptAssetVersionService],
})
export class PromptAssetVersionModule { }
