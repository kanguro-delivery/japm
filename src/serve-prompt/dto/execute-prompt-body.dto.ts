import { IsObject, IsOptional } from 'class-validator';

export class ExecutePromptBodyDto {
  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;
}
