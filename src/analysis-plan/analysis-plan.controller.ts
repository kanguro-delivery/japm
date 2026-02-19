import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse
} from '@nestjs/swagger';
import { AnalysisPlanService } from './analysis-plan.service';
import { CreateAnalysisPlanDto } from './dto/create-analysis-plan.dto';
import { UpdateAnalysisPlanDto } from './dto/update-analysis-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/enums/role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common/decorators';

@ApiTags('Analysis Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TENANT_ADMIN)
@Controller('analysis-plans')
export class AnalysisPlanController {
  constructor(private readonly analysisPlanService: AnalysisPlanService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new analysis plan',
    description: 'Creates a new analysis plan with the provided details.'
  })
  @ApiCreatedResponse({
    description: 'The analysis plan has been successfully created.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Sentiment Analysis',
        structuredDataPrompt: 'Analyze the sentiment...',
        structuredDataSchema: {},
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    schema: {
      example: {
        statusCode: 400,
        message: ['name should not be empty'],
        error: 'Bad Request'
      }
    }
  })
  create(@Body() createAnalysisPlanDto: CreateAnalysisPlanDto) {
    return this.analysisPlanService.create(createAnalysisPlanDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all analysis plans',
    description: 'Retrieves a list of all analysis plans.'
  })
  @ApiOkResponse({
    description: 'List of analysis plans returned successfully',
    schema: {
      example: [{
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Sentiment Analysis',
        structuredDataPrompt: 'Analyze the sentiment...',
        structuredDataSchema: {},
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }]
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.analysisPlanService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an analysis plan by ID',
    description: 'Retrieves a single analysis plan by its unique identifier.'
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the analysis plan to retrieve',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiOkResponse({
    description: 'The analysis plan was found and returned',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Sentiment Analysis',
        structuredDataPrompt: 'Analyze the sentiment...',
        structuredDataSchema: {},
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Analysis plan not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Analysis plan with ID 550e8400-e29b-41d4-a716-446655440000 not found',
        error: 'Not Found'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.analysisPlanService.findOne(id);
  }

  @Get('by-name/:name')
  @ApiOperation({
    summary: 'Get an analysis plan by name',
    description: 'Retrieves a single analysis plan by its name.'
  })
  @ApiParam({
    name: 'name',
    description: 'Name of the analysis plan to retrieve',
    example: 'Sentiment Analysis'
  })
  @ApiOkResponse({
    description: 'The analysis plan was found and returned',
    schema: {
      example: {
        structuredDataPrompt: 'Analyze the sentiment...',
        structuredDataSchema: {}
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Analysis plan not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Analysis plan with name Sentiment Analysis not found',
        error: 'Not Found'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOneByName(@Param('name') name: string) {
    const plan = await this.analysisPlanService.findOneByName(name);
    const { id, name: _, createdAt, updatedAt, ...rest } = plan;
    return rest;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an analysis plan',
    description: 'Updates an existing analysis plan with the provided data.'
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the analysis plan to update',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiOkResponse({
    description: 'The analysis plan was updated successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Updated Sentiment Analysis',
        structuredDataPrompt: 'Updated analysis prompt...',
        structuredDataSchema: {},
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z'
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Analysis plan not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Analysis plan with ID 550e8400-e29b-41d4-a716-446655440000 not found',
        error: 'Not Found'
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    schema: {
      example: {
        statusCode: 400,
        message: ['name should be a string'],
        error: 'Bad Request'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() updateAnalysisPlanDto: UpdateAnalysisPlanDto,
  ) {
    return this.analysisPlanService.update(id, updateAnalysisPlanDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an analysis plan',
    description: 'Deletes an analysis plan by its unique identifier.'
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the analysis plan to delete',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiOkResponse({
    description: 'The analysis plan was deleted successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Sentiment Analysis',
        structuredDataPrompt: 'Analyze the sentiment...',
        structuredDataSchema: {},
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Analysis plan not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Analysis plan with ID 550e8400-e29b-41d4-a716-446655440000 not found',
        error: 'Not Found'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.analysisPlanService.remove(id);
  }
}
