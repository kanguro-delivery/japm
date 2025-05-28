import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Corrected path assuming standard structure
import { Reflector } from '@nestjs/core'; // Import Reflector
import { AuthenticatedUser } from '../types/request.types';
// import { validate as isUuid } from 'uuid'; // O usa class-validator si prefieres
// Asumiendo CUIDs para IDs de proyecto

export const PROJECT_ID_PARAM_KEY = 'projectIdParam'; // Key for metadata

@Injectable()
export class ProjectGuard implements CanActivate {
  private readonly logger = new Logger(ProjectGuard.name);

  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) { } // Inject Reflector

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get the custom param name from metadata, default to 'projectId'
    const projectIdParamName =
      this.reflector.getAllAndOverride<string>(PROJECT_ID_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'projectId';

    const projectId = request.params[projectIdParamName]; // Use dynamic param name
    const user = request.user as AuthenticatedUser; // Cast to your user type

    if (!user || !user.tenantId) {
      this.logger.warn(
        `[ProjectGuard] DENIED: User or user.tenantId is undefined. User: ${JSON.stringify(user)}`
      );
      throw new ForbiddenException(
        'User does not have permission to access this project (missing tenantId)',
      );
    }

    // 2. Validate projectId presence and basic format
    if (!projectId) {
      this.logger.warn(
        `[ProjectGuard] DENIED: Project ID missing (expected param: ${projectIdParamName}).`
      );
      throw new BadRequestException(
        `Project ID parameter (expected: ${projectIdParamName}) is missing in URL`,
      );
    }
    if (typeof projectId !== 'string' || projectId.trim() === '') {
      this.logger.warn(
        `[ProjectGuard] Invalid Project ID format received (param: ${projectIdParamName}): ${projectId}`
      );
      throw new BadRequestException('Invalid Project ID format');
    }

    // 3. Fetch project and check ownership
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { tenantId: true, name: true }, // Select name for logging
      });

      // 4. Check if project exists
      if (!project) {
        this.logger.warn(
          `[ProjectGuard] DENIED: Project with ID "${projectId}" not found in DB.`
        );
        throw new NotFoundException(
          `Project with ID "${projectId}" not found`,
        );
      }

      // 5. Check if the authenticated user owns the project (using tenantId)
      if (project.tenantId !== user.tenantId) {
        this.logger.warn(
          `[ProjectGuard] DENIED: Tenant mismatch. Project Tenant: "${project.tenantId}", User Tenant: "${user.tenantId}"`
        );
        throw new ForbiddenException(
          'User does not have permission to access this project (tenant mismatch)',
        );
      }

      // 6. Attach validated projectId to request (using the original dynamic key for clarity if needed, or a fixed key like 'validatedProjectId')
      // request.projectId = projectId; // Keep this simple, the controller now uses @Param directly for new routes
      request[projectIdParamName] = projectId; // Or set it dynamically if other parts rely on this specific key
      request.validatedProjectId = projectId; // A new, consistently named property

      this.logger.log(
        `[ProjectGuard] GRANTED for User ID: "${user.userId}", TenantID: "${user.tenantId}" to Project: "${project.name}" (ID: "${projectId}")`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[ProjectGuard] EXCEPTION during project validation: ${error.message}`,
        error.stack
      );
      // Log before re-throwing known exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `[ProjectGuard] Unexpected error in ProjectGuard for projectId ${projectId} (param: ${projectIdParamName}) and userId ${user.userId}:`,
        error.stack || error
      ); // Use user.userId in log
      // Throw a generic internal server error
      throw new InternalServerErrorException(
        'Internal error during project access authorization.',
      ); // Use NestJS exception
    }
  }
}
