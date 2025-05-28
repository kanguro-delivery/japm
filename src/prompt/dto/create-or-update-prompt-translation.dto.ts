import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreateOrUpdatePromptTranslationDto {
  @ApiProperty({
    description: 'Language code for the translation (e.g., es-ES, fr-FR, en). Valid BCP 47 language tag.',
    example: 'fr-FR',
  })
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2,3})?$/, {
    message: 'languageCode must be a valid BCP 47 language tag (e.g., en, es-ES)',
  })
  languageCode: string;

  @ApiProperty({
    description: 'Translated prompt text for this version and language. Cannot be empty.',
    example: 'Bonjour le monde!'
  })
  @IsString()
  @IsNotEmpty()
  promptText: string;
}
