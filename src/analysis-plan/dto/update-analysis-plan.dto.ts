import { PartialType } from '@nestjs/mapped-types';
import { CreateAnalysisPlanDto } from './create-analysis-plan.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAnalysisPlanDto extends PartialType(CreateAnalysisPlanDto) {
  @ApiPropertyOptional({ 
    description: 'The name of the analysis plan',
    example: 'Updated Sentiment Analysis Plan'
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'The prompt used for structured data extraction',
    example: 'Updated analysis prompt...'
  })
  structuredDataPrompt?: string;

  @ApiPropertyOptional({
    description: 'JSON schema defining the structure of the extracted data',
    example: {
      type: 'object',
      properties: {
        // Updated schema
      }
    }
  })
  structuredDataSchema?: object;
}
