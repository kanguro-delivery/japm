import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateUserCredentialsDto {
    @ApiPropertyOptional({
        example: 'john.doe@example.com',
        description: 'New email address',
    })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({
        example: 'newpassword123',
        description: 'New password (min 8 characters)',
        minLength: 8,
    })
    @IsString()
    @MinLength(8)
    @IsOptional()
    password?: string;
} 