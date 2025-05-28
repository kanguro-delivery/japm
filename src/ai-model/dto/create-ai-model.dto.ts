import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateAiModelDto {
  @ApiProperty({
    description: 'Unique name for the AI model',
    example: 'gpt-4-turbo-2024-04-09',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Provider of the AI model',
    example: 'OpenAI',
  })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ description: 'Optional description for the AI model' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Identifier used for API calls',
    example: 'openai/gpt-4-turbo',
  })
  @IsString()
  @IsOptional()
  apiIdentifier?: string;
}

/**
 * Type for CreateAiModelDto with potential extra fields filtered out
 */
export type CreateAiModelData = Omit<CreateAiModelDto, never> & {
  // Allow for potential extra fields that should be filtered out
  [key: string]: unknown;
};
