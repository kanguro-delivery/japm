import { Module } from '@nestjs/common';
import { RuleService } from './rule.service';
import { RuleController } from './rule.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RuleController],
  providers: [RuleService],
  exports: [RuleService],
})
export class RuleModule {}
