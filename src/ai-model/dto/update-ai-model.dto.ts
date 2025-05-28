import { PartialType } from '@nestjs/swagger';
import { CreateAiModelDto } from './create-ai-model.dto';

export class UpdateAiModelDto extends PartialType(CreateAiModelDto) {}

/**
 * Type for UpdateAiModelDto with potential extra fields filtered out
 */
export type UpdateAiModelData = UpdateAiModelDto & {
  // Allow for potential extra fields that should be filtered out
  [key: string]: unknown;
};
