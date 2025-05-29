import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PromptType } from '@prisma/client';

export class PromptMetaDto {
  @ApiProperty({
    description: 'Suggested name for the prompt.',
    example: 'Invoice Details Extractor',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Suggested description for the prompt.',
    example:
      'Extracts invoice number, date, and total amount from invoice documents.',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'ID of the user who owns this prompt.',
    example: 'user-123',
  })
  @IsNotEmpty()
  @IsString()
  ownerUserId: string;

  @ApiProperty({
    description: 'Type of the prompt.',
    enum: PromptType,
    example: PromptType.USER,
  })
  @IsEnum(PromptType)
  type: PromptType;
}

export class PromptVersionTranslationDto {
  @ApiProperty({
    description: 'Language code for the translation.',
    example: 'en-US',
  })
  @IsNotEmpty()
  @IsString()
  languageCode: string;

  @ApiProperty({
    description:
      'Translated prompt text, potentially including {{asset_key}} placeholders.',
    example: 'Review this invoice and extract the {{invoice_number_field}}.',
  })
  @IsNotEmpty()
  @IsString()
  promptText: string;
}

export class PromptVersionStructureDto {
  @ApiProperty({
    description:
      'Core prompt text, potentially including {{asset_key}} placeholders.',
    example:
      'Extract the {{invoice_number_field}} and the {{total_amount_field}} from the attached invoice.',
  })
  @IsNotEmpty()
  @IsString()
  promptText: string;

  @ApiProperty({
    description: 'Change message for this version.',
    example: 'Initial structure generated from user prompt.',
  })
  @IsNotEmpty()
  @IsString()
  changeMessage: string;

  @ApiProperty({
    description:
      'Array of asset keys (slug-case) used in this prompt version. These keys must correspond to assets defined in the main "assets" list.',
    example: ['invoice_number_field', 'total_amount_field'],
  })
  @IsArray()
  @IsString({ each: true })
  assets: string[]; // Array of asset keys

  @ApiProperty({
    type: [PromptVersionTranslationDto],
    description: 'Translations for the prompt text.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptVersionTranslationDto)
  translations: PromptVersionTranslationDto[];
}

export class PromptAssetStructureDto {
  @ApiProperty({
    description: 'Key (slug-case) for the asset.',
    example: 'invoice_number_field',
  })
  @IsNotEmpty()
  @IsString()
  key: string;

  @ApiProperty({
    description: 'Name of the asset.',
    example: 'Invoice Number Field',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Value of the asset.',
    example: 'invoice_number',
  })
  @IsNotEmpty()
  @IsString()
  value: string;

  @ApiProperty({
    description: 'Change message for this asset version.',
    example: 'Initial version from loaded structure.',
  })
  @IsOptional()
  @IsString()
  changeMessage?: string;

  @ApiProperty({
    type: [PromptVersionTranslationDto],
    description: 'Translations for the asset value.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptVersionTranslationDto)
  translations?: PromptVersionTranslationDto[];
}

export class LoadPromptStructureDto {
  @ApiProperty({
    type: PromptMetaDto,
    description: 'Metadata for the prompt to be created.',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PromptMetaDto)
  @IsObject() // Asegura que 'prompt' sea un objeto
  prompt: PromptMetaDto;

  @ApiProperty({
    type: PromptVersionStructureDto,
    description: 'Structure for the initial prompt version.',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PromptVersionStructureDto)
  @IsObject() // Asegura que 'version' sea un objeto
  version: PromptVersionStructureDto;

  @ApiProperty({
    description:
      'Código de idioma para la versión inicial (e.g., en-US, es-ES). Se obtiene del listado de regiones del proyecto.',
    example: 'en-US',
  })
  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @ApiProperty({
    type: [PromptAssetStructureDto],
    description:
      'List of assets to be created and associated with the prompt (conceptually via placeholders).',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptAssetStructureDto)
  assets: PromptAssetStructureDto[];

  @ApiProperty({
    description: 'Optional list of tag names to associate with the prompt.',
    example: ['invoicing', 'extraction'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
