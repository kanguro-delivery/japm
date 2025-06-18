import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { ApiKey, User } from '@prisma/client';

@Injectable()
export class ApiKeyService {
    private readonly logger = new Logger(ApiKeyService.name);

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
        const parts = apiKey.split('_');
        if (parts.length !== 3) {
            this.logger.warn(
                `[findUserByApiKey] DENIED: Received malformed API Key (incorrect number of parts). Expected format: part1_part2_part3.`,
            );
            return null;
        }

        const prefix = `${parts[0]}_${parts[1]}`;
        const key = parts[2];

        const hashedKey = this.hashApiKey(key);
        this.logger.log(
            `[findUserByApiKey] Searching for API Key with prefix: ${prefix}`,
        );

        const apiKeyRecord = await this.prisma.apiKey.findFirst({
            where: {
                prefix: prefix,
                hashedKey: hashedKey,
            },
            include: { user: true },
        });

        if (!apiKeyRecord) {
            this.logger.warn(
                `[findUserByApiKey] DENIED: No API Key found in DB for prefix: ${prefix}`,
            );
            return null;
        }

        if (apiKeyRecord.revoked) {
            this.logger.warn(
                `[findUserByApiKey] DENIED: API Key with ID ${apiKeyRecord.id} is REVOKED.`,
            );
            return null;
        }

        const now = new Date();
        if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < now) {
            this.logger.warn(
                `[findUserByApiKey] DENIED: API Key with ID ${apiKeyRecord.id} EXPIRED at ${apiKeyRecord.expiresAt}.`,
            );
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
                this.logger.error(
                    `Failed to update lastUsedAt for API key ${apiKeyRecord.id}`,
                    err,
                );
            });

        this.logger.log(
            `[findUserByApiKey] SUCCESS: API Key is valid. Returning user ${apiKeyRecord.userId}.`,
        );
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