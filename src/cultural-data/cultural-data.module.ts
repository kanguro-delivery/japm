import { Module } from '@nestjs/common';
import { CulturalDataController } from './cultural-data.controller';
import { CulturalDataService } from './cultural-data.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [CulturalDataController],
  providers: [CulturalDataService],
  exports: [CulturalDataService],
})
export class CulturalDataModule {}
