import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  Logger,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
  UsePipes,
  ValidationPipe,
  SetMetadata,
  Request,
} from '@nestjs/common';
import { PromptService } from './prompt.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Prompt, PromptVersion, PromptTranslation } from '@prisma/client';
import { ProjectService } from '../project/project.service';
import { GeneratePromptStructureDto } from './dto/generate-prompt-structure.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PromptDto } from './dto/prompt.dto';
import { LoadPromptStructureDto } from './dto/load-prompt-structure.dto';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { RegionService } from '../region/region.service';
import { Request as ExpressRequest } from 'express';
import {
  ThrottleCreation,
  ThrottleRead,
  ThrottleLLM,
  ThrottleApi,
} from '../common/decorators/throttle.decorator';
import {
  AuditCreate,
  AuditUpdate,
  AuditDelete,
  AuditView,
  AuditList,
} from '../common/decorators/audit.decorator';
import { PromptBackupService } from '../common/services/prompt-backup.service';
import { CreatePromptBackupRequestDto } from './dto/prompt-backup.dto';
import {
  ProjectGuard,
  PROJECT_ID_PARAM_KEY,
} from '../common/guards/project.guard';
import { AuthenticatedRequest } from '../common/types/request.types';
import { CreateOrUpdatePromptTranslationDto } from './dto/create-or-update-prompt-translation.dto';

interface RequestWithUser extends ExpressRequest {
  user: {
    tenantId: string;
  };
}

@Controller('projects/:projectId/prompts')
@UseGuards(JwtAuthGuard)
@ApiTags('prompts')
export class PromptController {
  private readonly logger = new Logger(PromptController.name);

  constructor(
    private readonly promptService: PromptService,
    private readonly projectService: ProjectService,
    private readonly regionService: RegionService,
    private readonly promptBackupService: PromptBackupService,
  ) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Create new prompt',
    description:
      'Creates a new prompt for the current tenant. Accessible by global admins or tenant admins.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Prompt successfully created',
    type: PromptDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data - Check the request body format',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Prompt already exists - A prompt with this name already exists for this tenant',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Insufficient permissions to create prompts',
  })
  @ThrottleCreation()
  @AuditCreate('Prompt', { resourceNameField: 'name' })
  create(
    @Param('projectId') projectId: string,
    @Body() createPromptDto: CreatePromptDto,
    @Req() req: any,
  ): Promise<PromptDto> {
    return this.promptService
      .create(createPromptDto, projectId, req.user.tenantId)
      .then((prompt) => ({
        ...prompt,
        description: prompt.description || undefined,
      }));
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get all prompts',
    description:
      'Retrieves a list of all prompts for the current tenant. Results are cached for 1 hour.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of prompts retrieved successfully',
    type: [PromptDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @CacheKey('prompts')
  @CacheTTL(3600)
  @ThrottleRead()
  @AuditList('Prompt')
  findAll(
    @Param('projectId') projectId: string,
    @Req() req: any,
  ): Promise<PromptDto[]> {
    return this.promptService.findAll(projectId).then((prompts) =>
      prompts.map((prompt) => ({
        ...prompt,
        description: prompt.description || undefined,
      })),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get prompt by ID',
    description:
      'Retrieves a specific prompt by its unique ID. Results are cached for 1 hour.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Prompt found successfully',
    type: PromptDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Prompt not found - The specified ID does not exist for this tenant',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Unique prompt identifier (slug)',
    required: true,
  })
  @CacheKey('prompt')
  @CacheTTL(3600)
  @ThrottleRead()
  @AuditView('Prompt', { resourceIdParam: 'id', resourceNameField: 'name' })
  findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<PromptDto> {
    return this.promptService.findOne(id, projectId).then((prompt) => ({
      ...prompt,
      description: prompt.description || undefined,
    }));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Update prompt',
    description:
      "Updates an existing prompt's information. Accessible by global admins or tenant admins.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Prompt updated successfully',
    type: PromptDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Prompt not found - The specified ID does not exist for this tenant',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data - Check the request body format',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Prompt name already exists - The provided name is already in use',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Insufficient permissions to update prompts',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Unique prompt identifier to update (slug or UUID)',
    required: true,
  })
  @ThrottleCreation()
  @AuditUpdate('Prompt', { resourceIdParam: 'id', resourceNameField: 'name' })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updatePromptDto: UpdatePromptDto,
    @Req() req: any,
  ): Promise<PromptDto> {
    return this.promptService
      .update(id, updatePromptDto, projectId)
      .then((prompt) => ({
        ...prompt,
        description: prompt.description || undefined,
      }));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete prompt',
    description:
      'Permanently deletes a prompt. This is a destructive operation that requires admin privileges.',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Prompt successfully deleted',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Prompt not found - The specified ID does not exist for this tenant',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Insufficient permissions to delete prompts',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Unique prompt identifier to delete (slug or UUID)',
    required: true,
  })
  @ThrottleCreation()
  @AuditDelete('Prompt', { resourceIdParam: 'id' })
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<void> {
    return this.promptService.remove(
      id,
      projectId,
      req.user?.userId || req.user?.id,
      req.user?.tenantId,
    );
  }

  @Post('generate-structure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Genera estructura de prompt',
    description:
      'Analiza un prompt de usuario usando un LLM y sugiere una estructura basada en las entidades del proyecto.',
  })
  @ApiParam({
    name: 'projectId',
    type: String,
    description: 'ID del proyecto',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Estructura JSON sugerida para el prompt',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            structure: {
              type: 'object',
              description: 'Estructura sugerida para el prompt',
            },
            explanation: {
              type: 'string',
              description: 'Explicación de la estructura sugerida',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  @ThrottleLLM()
  async generateStructure(
    @Param('projectId') projectId: string,
    @Body() generatePromptStructureDto: GeneratePromptStructureDto,
    @Req() req: RequestWithUser,
  ): Promise<object> {
    this.logger.debug(
      `==> ENTERED generateStructure Controller Method - ProjectID: ${projectId}, TenantID: ${req.user?.tenantId}, Body: ${JSON.stringify(generatePromptStructureDto)}`,
    );
    const tenantId = req.user.tenantId;

    const project = await this.projectService.findOne(projectId, tenantId);
    if (!project) {
      this.logger.error(
        `Project not found for projectId: ${projectId} and tenantId: ${tenantId}`,
      );
      throw new NotFoundException(
        `Project with ID "${projectId}" not found for your tenant.`,
      );
    }

    const regions = await this.regionService.findAll(project.id);
    if (!regions || regions.length === 0) {
      this.logger.error(
        `No regions found for projectId: ${projectId} and tenantId: ${tenantId}`,
      );
      throw new NotFoundException(
        `No regions found for project "${projectId}".`,
      );
    }

    this.logger.log(
      `REQ ${req.method} ${req.url} projectId=${projectId} ${JSON.stringify(req.body)}`,
    );
    try {
      const structure = await this.promptService.generateStructure(
        projectId,
        generatePromptStructureDto.userPrompt,
        regions.map((r) => ({
          languageCode: r.languageCode,
          name: r.name,
        })),
      );
      this.logger.log(
        `RES ${HttpStatus.OK} ${req.method} ${req.url} ${JSON.stringify(structure)}`,
      );
      return structure;
    } catch (error) {
      this.logger.error(
        `Error generating structure for project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post(':id/load-structure')
  @ApiOperation({ summary: 'Load prompt structure' })
  @ApiParam({
    name: 'projectId',
    description: 'ID of the project',
    required: true,
    type: String
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the prompt',
    required: true,
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Prompt structure loaded successfully',
  })
  @ThrottleRead()
  async loadStructure(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<any> {
    const project = await this.projectService.findOne(id, req.user.tenantId);
    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    const regions = await this.regionService.findAll(project.id);
    if (!regions || regions.length === 0) {
      throw new NotFoundException(`No regions found for project "${id}"`);
    }

    return regions.map((r) => ({
      id: r.id,
      name: r.name,
      languageCode: r.languageCode,
      timeZone: r.timeZone,
    }));
  }

  @Post(':promptId/versions')
  @ApiOperation({
    summary: 'Crea una nueva versión de prompt',
    description: 'Crea una nueva versión de un prompt existente',
  })
  @ApiParam({
    name: 'projectId',
    type: String,
    description: 'ID del proyecto',
    required: true,
  })
  @ApiParam({
    name: 'promptId',
    type: String,
    description: 'ID (slug) del prompt',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Nueva versión de prompt creada exitosamente',
    type: CreatePromptVersionDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Proyecto o Prompt no encontrado' })
  @ThrottleCreation()
  async createVersion(
    @Param('projectId') projectId: string,
    @Param('promptId') promptIdSlug: string,
    @Body() createPromptVersionDto: CreatePromptVersionDto,
    @Req() req: any,
  ): Promise<PromptVersion> {
    this.logger.log(
      `REQ ${req.method} ${req.url} projectId=${projectId} promptId=${promptIdSlug} ${JSON.stringify(req.body)}`,
    );
    const tenantId = req.user.tenantId;
    await this.projectService.findOne(projectId, tenantId);

    const newVersion = await this.promptService.createVersion(
      promptIdSlug,
      createPromptVersionDto,
      projectId,
    );
    this.logger.log(
      `RES ${HttpStatus.CREATED} ${req.method} ${req.url} ${JSON.stringify(newVersion)}`,
    );
    return newVersion;
  }

  @Post(':id/backup')
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @SetMetadata(PROJECT_ID_PARAM_KEY, 'projectId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({
    summary: 'Create prompt backup',
    description: 'Creates a complete backup of a prompt without deleting it.',
  })
  @ApiParam({
    name: 'projectId',
    description: 'ID of the project the prompt belongs to',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique prompt identifier to backup',
  })
  @ApiBody({ type: CreatePromptBackupRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Backup created successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden Access to Project.' })
  @ApiResponse({ status: 404, description: 'Prompt not found.' })
  async createBackup(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() backupRequest: CreatePromptBackupRequestDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { userId } = req.user;

    const backupOptions = {
      deletedBy: userId,
      deletionReason: backupRequest.deletionReason || 'Manual backup',
      includeExecutionLogs: backupRequest.includeExecutionLogs ?? false,
      executionLogsLimit: backupRequest.executionLogsLimit ?? 50,
    };

    const result = await this.promptBackupService.createPromptBackup(
      id,
      projectId,
      backupOptions,
    );

    return {
      message: 'Backup created successfully',
      backupPath: result.backupPath,
      backupSize: JSON.stringify(result.backupData).length,
      statistics: result.backupData.statistics,
    };
  }

  @Get('backups/list')
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @SetMetadata(PROJECT_ID_PARAM_KEY, 'projectId')
  @ApiOperation({
    summary: 'List prompt backups',
    description: 'Lists all available prompt backups for the project.',
  })
  @ApiParam({
    name: 'projectId',
    description: 'ID of the project to list backups for',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available backups.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden Access to Project.' })
  async listBackups(@Param('projectId') projectId: string) {
    const backups = await this.promptBackupService.listBackups(projectId);
    return {
      backups,
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
    };
  }

  @Post(':promptId/versions/:versionTag/translations')
  @ApiOperation({ summary: 'Add or update a translation for a prompt version' })
  @ApiResponse({ status: 201, description: 'Translation added/updated successfully.' })
  @ApiResponse({ status: 404, description: 'Prompt or Version not found.' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ProjectGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @AuditCreate('PromptTranslation')
  async addOrUpdateTranslation(
    @Param('projectId') projectId: string,
    @Param('promptId') promptIdSlug: string,
    @Param('versionTag') versionTag: string,
    @Body() translationDto: CreateOrUpdatePromptTranslationDto,
  ): Promise<PromptTranslation> {
    this.logger.debug(
      `Attempting to add/update translation for prompt ${promptIdSlug}, version TAG ${versionTag}, project ${projectId}`,
    );

    const prompt = await this.promptService.findOne(promptIdSlug, projectId);
    if (!prompt) {
      throw new NotFoundException(`Prompt with slug "${promptIdSlug}" not found in project "${projectId}".`);
    }

    const versionToTranslate = prompt.versions.find(v => v.versionTag === versionTag);

    if (!versionToTranslate) {
      throw new NotFoundException(
        `Version with tag "${versionTag}" not found for prompt "${promptIdSlug}" in project "${projectId}".`,
      );
    }

    this.logger.debug(
      `Found version CUID ${versionToTranslate.id} for tag ${versionTag} of prompt ${promptIdSlug}. Proceeding with translation.`
    );

    return this.promptService.addOrUpdateTranslation(
      versionToTranslate.id,
      translationDto,
      projectId,
    );
  }

  @Post(':id/generate-structure')
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @SetMetadata(PROJECT_ID_PARAM_KEY, 'projectId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({
    summary: 'Generate prompt structure using AI',
    description:
      'Uses AI to analyze a basic prompt and suggest a complete structure with versions, translations, and assets.',
  })
  @ApiParam({
    name: 'projectId',
    description: 'ID of the project for context',
  })
  @ApiParam({
    name: 'id',
    description: 'Base prompt text or identifier',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userOriginalPrompt: {
          type: 'string',
          description: 'The basic prompt text to analyze and structure',
        },
        targetAiModel: {
          type: 'string',
          description: 'AI model to use for generation',
          default: 'gpt-4o',
        },
      },
      required: ['userOriginalPrompt'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'AI-generated structure suggestion.',
  })
  @ApiResponse({ status: 400, description: 'Invalid prompt text.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden Access to Project.' })
  async generateStructureAI(
    @Param('projectId') projectId: string,
    @Body('userOriginalPrompt') userOriginalPrompt: string,
    @Body('targetAiModel') targetAiModel: string = 'gpt-4o',
    @Request() req: AuthenticatedRequest,
  ) {
    const project = await this.promptService.findOne('dummy', projectId).catch(() => null);
    const projectRegions = [];

    return this.promptService.generateStructure(
      projectId,
      userOriginalPrompt,
      projectRegions,
      targetAiModel,
    );
  }

  @Post('load-structure')
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @SetMetadata(PROJECT_ID_PARAM_KEY, 'projectId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({
    summary: 'Load complete prompt structure',
    description:
      'Creates a complete prompt with all its components (versions, translations, assets) from a structured input.',
  })
  @ApiParam({
    name: 'projectId',
    description: 'ID of the project where the structure will be loaded',
  })
  @ApiBody({ type: LoadPromptStructureDto })
  @ApiResponse({
    status: 201,
    description: 'Prompt structure loaded successfully.',
  })
  @ApiResponse({ status: 400, description: 'Invalid structure data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden Access to Project.' })
  @ApiResponse({
    status: 409,
    description: 'Prompt or components already exist.',
  })
  loadStructureComplete(
    @Param('projectId') projectId: string,
    @Body() loadStructureDto: LoadPromptStructureDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Prompt> {
    const { tenantId } = req.user;
    return this.promptService.loadStructure(
      projectId,
      loadStructureDto,
      tenantId,
    );
  }
}
