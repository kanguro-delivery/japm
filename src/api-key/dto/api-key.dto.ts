export class ApiKeyDto {
    id: string;
    name: string;
    prefix: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    revoked: boolean;
    userId: string;
} 