import { Request } from 'express';
import { Role } from 'src/auth/enums/role.enum';

/**
 * User data attached to request after JWT authentication
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: Role;
}

/**
 * Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Type guard to check if request has authenticated user
 */
export function isAuthenticatedRequest(req: any): req is AuthenticatedRequest {
  return req && req.user && typeof req.user.id === 'string';
}
