import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ExecutePromptQueryDto {
  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsString()
  environmentName?: string; // Note: Logic to use environmentName needs implementation

  @ApiProperty({
    required: false,
    description:
      'If true, the response will include an array of all assets associated with the prompt.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  includeAssets?: boolean;

  @ApiProperty({
    required: false,
    description:
      'If true, the prompt is fully processed. If false, it returns the raw template. Defaults to true.',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === undefined) return true; // Default to true if not provided
    return value as boolean;
  })
  processed?: boolean = true;
}
