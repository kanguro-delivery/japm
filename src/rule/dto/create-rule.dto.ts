import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRuleDto {
  @ApiProperty({
    description: 'The title of the rule',
    example: 'Password Policy',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'The content/description of the rule',
    example: 'Passwords must be at least 8 characters long',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Language code for the rule (ISO 639-1)',
    example: 'en-US',
    default: 'en-US',
    required: false
  })
  @IsString()
  @IsOptional()
  language?: string = 'en-US';

  @ApiProperty({
    description: 'Version of the rule',
    example: '1.0.0',
    default: '1.0.0',
    required: false
  })
  @IsString()
  @IsOptional()
  version?: string = '1.0.0';
}
