import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAnalysisPlanDto {
  @ApiProperty({
    description: 'The name of the analysis plan',
    example: 'Sentiment Analysis Plan',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The prompt used for structured data extraction',
    example: 'Analyze the sentiment of the following text and extract key entities...',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  structuredDataPrompt: string;

  @ApiProperty({
    description: 'JSON schema defining the structure of the extracted data',
    example: {
      type: 'object',
      properties: {
        sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              sentiment: { type: 'string' }
            }
          }
        }
      },
      required: ['sentiment', 'confidence']
    },
    required: true
  })
  @IsObject()
  @IsNotEmpty()
  structuredDataSchema: object;
}
