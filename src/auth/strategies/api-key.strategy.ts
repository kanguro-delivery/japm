import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { ApiKeyService } from 'src/api-key/api-key.service';
import { User } from '@prisma/client';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(
    HeaderAPIKeyStrategy,
    'api-key',
) {
    constructor(private readonly apiKeyService: ApiKeyService) {
        super({ header: 'X-Api-Key', prefix: '' }, false);
    }

    async validate(apiKey: string): Promise<User> {
        const user = await this.apiKeyService.findUserByApiKey(apiKey);
        if (!user) {
            throw new UnauthorizedException('Invalid API Key');
        }
        return user;
    }
} 