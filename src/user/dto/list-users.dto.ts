import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ListUsersDto {
    @ApiPropertyOptional({
        description: 'Optional tenant ID to filter users. Only used if the requesting user is a tenant_admin. Can be a UUID or "default-tenant"',
        type: String,
    })
    @IsOptional()
    @IsString()
    @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^default-tenant$/, {
        message: 'tenantId must be a valid UUID or "default-tenant"',
    })
    tenantId?: string;
} 