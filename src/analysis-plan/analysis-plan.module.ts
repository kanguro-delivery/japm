import { Module } from '@nestjs/common';
import { AnalysisPlanService } from './analysis-plan.service';
import { AnalysisPlanController } from './analysis-plan.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalysisPlanController],
  providers: [AnalysisPlanService],
  exports: [AnalysisPlanService],
})
export class AnalysisPlanModule {}
