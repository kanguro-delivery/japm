import { IsOptional, IsString, IsArray, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PromptType } from '@prisma/client';

// No usar PartialType/OmitType para tener control explícito sobre los tipos actualizables
export class UpdatePromptDto {
  @ApiPropertyOptional({
    description: "New name for the prompt.",
    example: 'Updated Greeting Prompt',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: "New description of the prompt's purpose.",
    example: 'Updated prompt for greetings.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'New type for the prompt.',
    enum: PromptType,
    example: PromptType.USER,
  })
  @IsOptional()
  @IsEnum(PromptType)
  type?: PromptType;

  @ApiPropertyOptional({
    description:
      'Complete list of Tag IDs to associate (replaces existing ones). Empty array to remove all.',
    example: ['cma...uuid1', 'cma...uuid2'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}
