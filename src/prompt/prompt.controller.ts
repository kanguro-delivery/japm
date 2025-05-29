import { Controller, Post, Put, Delete, Body, Param, Req, UseGuards, UnauthorizedException, Get, NotFoundException } from '@nestjs/common';
import { PromptService } from './prompt.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectGuard } from '../common/guards/project.guard';
import { AuthenticatedRequest } from '../common/types/request.types';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Prompts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectGuard)
@Controller('projects/:projectId/prompts')
export class PromptController {
  constructor(private readonly promptService: PromptService) { }

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
      throw new UnauthorizedException('No autenticado');
    }
    const prompt = await this.promptService.findOne(id, projectId, req.user.tenantId);
    if (!prompt) {
      throw new NotFoundException(`Prompt con ID ${id} no encontrado`);
    }
    return prompt;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new prompt' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Prompt created successfully' })
  async create(@Body() createDto: CreatePromptDto, @Param('projectId') projectId: string, @Req() req: AuthenticatedRequest) {
    if (!req.user) {
      throw new UnauthorizedException('No autenticado');
    }
    return this.promptService.create(
      createDto,
      projectId,
      req.user.tenantId,
      req.user.userId
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a prompt' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'Prompt ID' })
  @ApiResponse({ status: 200, description: 'Prompt updated successfully' })
  async update(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Body() updateDto: UpdatePromptDto,
    @Req() req: AuthenticatedRequest
  ) {
    if (!req.user) {
      throw new UnauthorizedException('No autenticado');
    }
    return this.promptService.update(
      id,
      updateDto,
      projectId,
      req.user.tenantId,
      req.user.userId
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
      req.user.userId,
      req.user.tenantId
    );
  }
}
