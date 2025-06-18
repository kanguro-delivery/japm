import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsDateString,
    IsBoolean,
} from 'class-validator';

export class UpdateApiKeyDto {
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    name?: string;

    @IsDateString()
    @IsOptional()
    expiresAt?: string | null;

    @IsBoolean()
    @IsOptional()
    revoked?: boolean;
} 