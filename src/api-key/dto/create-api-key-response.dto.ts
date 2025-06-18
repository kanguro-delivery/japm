import { ApiProperty } from '@nestjs/swagger';
import { ApiKeyDto } from './api-key.dto';

export class CreateApiKeyResponseDto extends ApiKeyDto {
    @ApiProperty({
        description:
            'The full API Key secret. This is only returned once upon creation. Save it securely.',
        example: 'japm_1234abcd_unSecretoMuyLargoQueSoloVesUnaVez',
    })
    apiKey: string;
} 