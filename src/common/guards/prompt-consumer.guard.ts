import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Role } from '../../auth/enums/role.enum';
import { AuthenticatedUser } from '../types/request.types';

@Injectable()
export class PromptConsumerGuard implements CanActivate {
    private readonly logger = new Logger(PromptConsumerGuard.name);

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user as AuthenticatedUser;
        const path = request.url;

        this.logger.debug(`[PromptConsumerGuard] Path: ${path}, User: ${JSON.stringify(user)}`);

        if (!user || !user.role) {
            this.logger.warn(
                `[PromptConsumerGuard] DENIED: User or user.role not found. User: ${JSON.stringify(user)}`,
            );
            throw new ForbiddenException(
                'Authentication required. User details or role missing.',
            );
        }

        const userRoles = Array.isArray(user.role) ? user.role : [user.role];

        const allowedRoles = [Role.PROMPT_CONSUMER, Role.TENANT_ADMIN, Role.ADMIN]; // ADMIN también por si acaso

        const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));

        if (!hasRequiredRole) {
            this.logger.warn(
                `[PromptConsumerGuard] DENIED: User (ID: ${user.userId}, Tenant: ${user.tenantId}) has role(s) "${user.role}". Expected one of: "${allowedRoles.join(', ')}".`,
            );
            throw new ForbiddenException(
                `Access denied. Required roles are ${allowedRoles.join(', ')}.`,
            );
        }

        this.logger.log(
            `[PromptConsumerGuard] GRANTED: User (ID: ${user.userId}, Tenant: ${user.tenantId}, Role(s): ${user.role}) to path ${path}`,
        );
        return true;
    }
} 