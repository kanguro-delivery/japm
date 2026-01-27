import { Module } from '@nestjs/common';
import { ServePromptController } from './serve-prompt.controller';
import { ServePromptService } from './serve-prompt.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RuleModule } from '../rule/rule.module';

@Module({
  imports: [PrismaModule, RuleModule],
  controllers: [ServePromptController],
  providers: [ServePromptService],
  exports: [ServePromptService],
})
export class ServePromptModule {}
