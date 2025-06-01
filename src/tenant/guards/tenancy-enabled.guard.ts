import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenancyEnabledGuard implements CanActivate {
    constructor(private configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const isTenancyEnabled = this.configService.get<boolean>('tenancy.enabled');

        if (!isTenancyEnabled) {
            throw new ForbiddenException('Tenancy feature is disabled');
        }

        return true;
    }
} 