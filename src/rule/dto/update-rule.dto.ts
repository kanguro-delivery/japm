import { PartialType } from '@nestjs/mapped-types';
import { CreateRuleDto } from './create-rule.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRuleDto extends PartialType(CreateRuleDto) {
  @ApiPropertyOptional({ 
    description: 'The title of the rule',
    example: 'Updated Password Policy'
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'The content/description of the rule',
    example: 'Updated: Passwords must be at least 12 characters long'
  })
  content?: string;

  @ApiPropertyOptional({
    description: 'Language code for the rule (ISO 639-1)',
    example: 'es-ES'
  })
  language?: string;

  @ApiPropertyOptional({
    description: 'Version of the rule',
    example: '1.1.0'
  })
  version?: string;
}
