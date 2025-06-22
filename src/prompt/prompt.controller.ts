import { Controller, Post, Put, Delete, Body, Param, Req, UseGuards, UnauthorizedException, Get, NotFoundException, Patch } from '@nestjs/common';
import { PromptService } from './prompt.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectGuard } from '../common/guards/project.guard';
import { AuthenticatedRequest } from '../common/types/request.types';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { GeneratePromptStructureDto } from './dto/generate-prompt-structure.dto';
import { RegionService } from '../region/region.service';

@ApiTags('Prompts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectGuard)
@Controller('projects/:projectId/prompts')
export class PromptController {
  constructor(
    private readonly promptService: PromptService,
    private readonly regionService: RegionService
  ) { }

  @Get()
  @ApiOperation({ summary: 'Get all prompts for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'List of prompts' })
  async findAll(@Param('projectId') projectId: string, @Req() req: AuthenticatedRequest) {
    if (!req.user) {
      throw new UnauthorizedException('No autenticado');
    }
    return this.promptService.findAll(projectId, req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific prompt by ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'Prompt ID' })
  @ApiResponse({ status: 200, description: 'Prompt found successfully' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  async findOne(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    const prompt = await this.promptService.findOne(id, projectId, req.user.tenantId);
    if (!prompt) {
      throw new NotFoundException(`Prompt with ID ${id} not found`);
    }
    return prompt;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new prompt' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Prompt created successfully' })
  async create(@Body() createPromptDto: CreatePromptDto, @Param('projectId') projectId: string, @Req() req: AuthenticatedRequest) {
    if (!req.user) {
      throw new UnauthorizedException('No autenticado');
    }
    return this.promptService.create(
      createPromptDto,
      projectId,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a prompt (full update)' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'Prompt ID' })
  @ApiResponse({ status: 200, description: 'Prompt updated successfully' })
  async update(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Body() updatePromptDto: UpdatePromptDto,
    @Req() req: AuthenticatedRequest
  ) {
    if (!req.user) {
      throw new UnauthorizedException('No autenticado');
    }
    return this.promptService.update(
      id,
      updatePromptDto,
      projectId,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a prompt (partial update)' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'Prompt ID' })
  @ApiResponse({ status: 200, description: 'Prompt updated successfully' })
  async partialUpdate(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Body() updatePromptDto: UpdatePromptDto,
    @Req() req: AuthenticatedRequest
  ) {
    if (!req.user) {
      throw new UnauthorizedException('No autenticado');
    }
    return this.promptService.update(
      id,
      updatePromptDto,
      projectId,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a prompt' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'Prompt ID' })
  @ApiResponse({ status: 200, description: 'Prompt deleted successfully' })
  async remove(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest
  ) {
    if (!req.user) {
      throw new UnauthorizedException('No autenticado');
    }
    await this.promptService.remove(
      id,
      projectId,
      req.user.id,
      req.user.tenantId
    );
  }

  @Post('generate-structure')
  @ApiOperation({ summary: 'Generate a prompt structure from user input' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Prompt structure generated successfully' })
  async generateStructure(
    @Param('projectId') projectId: string,
    @Body() generateDto: GeneratePromptStructureDto,
    @Req() req: AuthenticatedRequest
  ) {
    if (!req.user) {
      throw new UnauthorizedException('No autenticado');
    }

    // Obtener las regiones del proyecto
    const regions = await this.regionService.findAll(projectId);
    const projectRegions = regions.map(region => ({
      languageCode: region.languageCode,
      name: region.name
    }));

    return this.promptService.generateStructure(
      projectId,
      generateDto.userPrompt,
      projectRegions
    );
  }
}
