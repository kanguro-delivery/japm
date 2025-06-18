import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class CreateApiKeyDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsDateString()
    @IsOptional()
    expiresAt?: string;
} 