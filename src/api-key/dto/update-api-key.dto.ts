import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateApiKeyDto {
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    name?: string;
} 