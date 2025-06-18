import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Role } from '../../auth/enums/role.enum';
import { AuthenticatedUser } from '../types/request.types';

@Injectable()
export class PromptConsumerGuard implements CanActivate {
  private readonly logger = new Logger(PromptConsumerGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    const path = request.url;

    this.logger.log(`[PromptConsumerGuard] Checking access for user to path: ${path}`);

    if (!user || !user.role) {
      this.logger.warn(
        `[PromptConsumerGuard] DENIED: Request is missing user or user.role. User object: ${JSON.stringify(user)}`,
      );
      throw new ForbiddenException(
        'Access Denied: User details or role are missing from the request.',
      );
    }

    // Ensure userRoles is always an array
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];

    this.logger.log(`[PromptConsumerGuard] User roles found: ${JSON.stringify(userRoles)}`);

    const allowedRoles = [Role.PROMPT_CONSUMER, Role.TENANT_ADMIN, Role.ADMIN];
    this.logger.log(`[PromptConsumerGuard] Roles allowed for this route: ${JSON.stringify(allowedRoles)}`);

    const hasRequiredRole = userRoles.some((role) =>
      allowedRoles.includes(role),
    );

    if (!hasRequiredRole) {
      this.logger.error(
        `[PromptConsumerGuard] PERMISSION DENIED: User (ID: ${user.id}, Tenant: ${user.tenantId}) with roles [${userRoles.join(', ')}] does not have any of the required roles [${allowedRoles.join(', ')}].`,
      );
      throw new ForbiddenException(
        `Access Denied: Your roles [${userRoles.join(', ')}] are not sufficient to access this resource.`,
      );
    }

    this.logger.log(
      `[PromptConsumerGuard] ACCESS GRANTED: User (ID: ${user.id}, Tenant: ${user.tenantId}) has required role.`,
    );
    return true;
  }
}
