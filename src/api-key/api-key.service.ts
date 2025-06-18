import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { ApiKey, User } from '@prisma/client';

@Injectable()
export class ApiKeyService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createApiKeyDto: CreateApiKeyDto, user: User) {
        const prefix = this.generatePrefix();
        const apiKey = this.generateApiKey();
        const hashedKey = this.hashApiKey(apiKey);

        const newKey = await this.prisma.apiKey.create({
            data: {
                ...createApiKeyDto,
                prefix,
                hashedKey,
                userId: user.id,
            },
        });

        return {
            ...this.mapToDto(newKey),
            apiKey: `${prefix}_${apiKey}`, // Return plain text key only on creation
        };
    }

    async findAllForUser(user: User) {
        const apiKeys = await this.prisma.apiKey.findMany({
            where: { userId: user.id },
        });
        return apiKeys.map(this.mapToDto);
    }

    async findOneForUser(id: string, user: User) {
        const apiKey = await this.findApiKeyByIdAndUser(id, user);
        return this.mapToDto(apiKey);
    }

    async update(id: string, updateApiKeyDto: UpdateApiKeyDto, user: User) {
        await this.findApiKeyByIdAndUser(id, user); // Authorization check
        const updatedKey = await this.prisma.apiKey.update({
            where: { id },
            data: updateApiKeyDto,
        });
        return this.mapToDto(updatedKey);
    }

    async revoke(id: string, user: User) {
        await this.findApiKeyByIdAndUser(id, user); // Authorization check
        const revokedKey = await this.prisma.apiKey.update({
            where: { id },
            data: { revoked: true },
        });
        return this.mapToDto(revokedKey);
    }

    async findUserByApiKey(apiKey: string): Promise<User | null> {
        const [prefix, key] = apiKey.split('_');
        if (!prefix || !key) {
            return null;
        }

        const hashedKey = this.hashApiKey(key);

        const apiKeyRecord = await this.prisma.apiKey.findUnique({
            where: { prefix, hashedKey },
            include: { user: true },
        });

        if (!apiKeyRecord || apiKeyRecord.revoked) {
            return null;
        }

        // Update last used timestamp (fire and forget)
        this.prisma.apiKey
            .update({
                where: { id: apiKeyRecord.id },
                data: { lastUsedAt: new Date() },
            })
            .catch((err) => {
                // Log the error but don't block the request
                console.error(`Failed to update lastUsedAt for API key ${apiKeyRecord.id}`, err);
            });

        return apiKeyRecord.user;
    }

    private async findApiKeyByIdAndUser(id: string, user: User): Promise<ApiKey> {
        const apiKey = await this.prisma.apiKey.findUnique({
            where: { id },
        });
        if (!apiKey || apiKey.userId !== user.id) {
            throw new UnauthorizedException('API Key not found or access denied');
        }
        return apiKey;
    }

    private generatePrefix(): string {
        return `japm_${crypto.randomBytes(4).toString('hex')}`;
    }

    private generateApiKey(): string {
        return crypto.randomBytes(24).toString('hex');
    }

    private hashApiKey(apiKey: string): string {
        return crypto.createHash('sha256').update(apiKey).digest('hex');
    }

    private mapToDto(apiKey: ApiKey) {
        const { hashedKey, ...rest } = apiKey;
        return rest;
    }
} 