import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  Request,
  UnauthorizedException,
  HttpStatus,
  Req,
  HttpCode,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Project, Prisma, User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Logger } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ProjectDto } from './dto/project.dto';

interface RequestWithUser extends Request {
  user: User & {
    id: string;
    tenantId: string;
  };
}

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectController {
  private readonly logger = new Logger(ProjectController.name);

  constructor(private readonly projectService: ProjectService) { }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  @ApiOperation({
    summary: 'Get current user projects',
    description:
      'Returns all projects that the authenticated user has access to',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'List of user projects',
    type: [CreateProjectDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Tenant information not available',
  })
  findMine(@Request() req: RequestWithUser): Promise<Pick<Project, 'id' | 'name'>[]> {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      this.logger.error(
        'TenantId not found in authenticated user request for findMine',
      );
      throw new UnauthorizedException('User tenant information is missing');
    }
    return this.projectService.findAllForUser(userId, tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Create new project',
    description:
      'Creates a new project for the current tenant. Accessible by global admins or tenant admins.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Project successfully created',
    type: ProjectDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data - Check the request body format',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Project already exists - A project with this name already exists for this tenant',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Insufficient permissions to create projects',
  })
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Req() req: RequestWithUser,
  ): Promise<ProjectDto> {
    this.logger.debug(
      `[create] Received POST request. Body: ${JSON.stringify(createProjectDto, null, 2)}`,
    );
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    if (!userId || !tenantId) {
      this.logger.error(
        'User ID or Tenant ID not found in authenticated user request for project creation',
      );
      throw new UnauthorizedException('User or tenant information is missing');
    }
    return this.projectService.create(createProjectDto, userId, tenantId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get all projects',
    description:
      'Retrieves a list of all projects for the current tenant. Results are cached for 1 hour.',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of projects retrieved successfully',
    type: [ProjectDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @CacheKey('projects')
  @CacheTTL(3600)
  findAll(@Req() req: RequestWithUser): Promise<ProjectDto[]> {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      this.logger.error('TenantId not found in authenticated user request');
      throw new UnauthorizedException('User tenant information is missing');
    }
    this.logger.debug(`[findAll] Fetching projects for tenantId: ${tenantId}`);
    return this.projectService.findAll(tenantId).then((projects) =>
      projects.map((project) => ({
        ...project,
        ownerUserId: project.ownerUserId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get project by ID',
    description:
      'Retrieves a specific project by its unique ID. Results are cached for 1 hour.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project found successfully',
    type: ProjectDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Project not found - The specified ID does not exist for this tenant',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Unique project identifier (UUID)',
    required: true,
  })
  @CacheKey('project')
  @CacheTTL(3600)
  findOne(@Param('id') id: string, @Req() req: RequestWithUser): Promise<ProjectDto> {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      this.logger.error(
        'TenantId not found in authenticated user request for findOne',
      );
      throw new UnauthorizedException('User tenant information is missing');
    }
    return this.projectService.findOne(id, tenantId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update project',
    description: 'Updates an existing project by ID.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project updated successfully',
    type: ProjectDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() req: RequestWithUser,
  ): Promise<ProjectDto> {
    this.logger.debug(
      `[update] Received PATCH request for project ${id}. Body: ${JSON.stringify(
        updateProjectDto,
        null,
        2,
      )}`,
    );
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    if (!tenantId || !userId) {
      this.logger.error(
        'TenantId or UserId not found in authenticated user request for update',
      );
      throw new UnauthorizedException('User or tenant information is missing');
    }
    return this.projectService.update(id, updateProjectDto, tenantId, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete project',
    description: 'Deletes a project by ID.',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Project deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  async remove(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    if (!tenantId || !userId) {
      this.logger.error(
        'TenantId or UserId not found in authenticated user request for remove',
      );
      throw new UnauthorizedException('User or tenant information is missing');
    }
    await this.projectService.remove(id, tenantId, userId);
  }
}
