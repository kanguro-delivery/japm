import {Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, UseGuards} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery, 
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse
} from '@nestjs/swagger';
import { RuleService } from './rule.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import {RolesGuard} from "../auth/guards/roles.guard";
import { Role } from '../auth/enums/role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { PromptConsumerGuard } from '../common/guards/prompt-consumer.guard';

@ApiTags('Rules')
@ApiBearerAuth()
@UseGuards(PromptConsumerGuard)
@Controller('rules')
export class RuleController {
  constructor(private readonly ruleService: RuleService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Create a new rule',
    description: 'Creates a new rule with the provided details.'
  })
  @ApiCreatedResponse({ 
    description: 'The rule has been successfully created.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Password Policy',
        content: 'Passwords must be at least 8 characters long',
        language: 'en-US',
        version: '1.0.0',
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
        message: ['title should not be empty'],
        error: 'Bad Request'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createRuleDto: CreateRuleDto) {
    return this.ruleService.create(createRuleDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all rules',
    description: 'Retrieves a list of all rules with optional filtering.'
  })
  @ApiQuery({ 
    name: 'language', 
    required: false, 
    description: 'Filter rules by language code (e.g., en-US, es-ES)' 
  })
  @ApiQuery({ 
    name: 'version', 
    required: false, 
    description: 'Filter rules by version (e.g., 1.0.0)' 
  })
  @ApiOkResponse({
    description: 'List of rules returned successfully',
    schema: {
      example: [{
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Password Policy',
        content: 'Passwords must be at least 8 characters long',
        language: 'en-US',
        version: '1.0.0',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }]
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Query('language') language?: string,
    @Query('version') version?: string,
  ) {
    return this.ruleService.findAll({ language, version });
  }

  @Get('by-title/:title')
  @ApiOperation({
    summary: 'Get a rule by title',
    description: 'Retrieves a single rule by its title.'
  })
  @ApiParam({ 
    name: 'title', 
    description: 'Title of the rule to retrieve',
    example: 'Password Policy'
  })
  @ApiOkResponse({
    description: 'The rule content was found and returned',
    schema: {
      example: [{
        content: 'Passwords must be at least 8 characters long'
      }]
    }
  })
  @ApiNotFoundResponse({ 
    description: 'Rule not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Rule with title "Password Policy" not found',
        error: 'Not Found'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findByTitle(@Param('title') title: string) {
    const rules = await this.ruleService.findByTitle(title);
    return rules.map(rule => ({ content: rule.content }));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a rule by ID',
    description: 'Retrieves a single rule by its unique identifier.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'UUID of the rule to retrieve',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiOkResponse({
    description: 'The rule was found and returned',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Password Policy',
        content: 'Passwords must be at least 8 characters long',
        language: 'en-US',
        version: '1.0.0',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'Rule not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Rule with ID 550e8400-e29b-41d4-a716-446655440000 not found',
        error: 'Not Found'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ruleService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Update a rule',
    description: 'Updates an existing rule with the provided data.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'UUID of the rule to update',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiOkResponse({
    description: 'The rule was updated successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Updated Password Policy',
        content: 'Passwords must be at least 12 characters long',
        language: 'en-US',
        version: '1.1.0',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z'
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'Rule not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Rule with ID 550e8400-e29b-41d4-a716-446655440000 not found',
        error: 'Not Found'
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Invalid input data',
    schema: {
      example: {
        statusCode: 400,
        message: ['title should be a string'],
        error: 'Bad Request'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRuleDto: UpdateRuleDto,
  ) {
    return this.ruleService.update(id, updateRuleDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Delete a rule',
    description: 'Deletes a rule by its unique identifier.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'UUID of the rule to delete',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiOkResponse({
    description: 'The rule was deleted successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Password Policy',
        content: 'Passwords must be at least 8 characters long',
        language: 'en-US',
        version: '1.0.0',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'Rule not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Rule with ID 550e8400-e29b-41d4-a716-446655440000 not found',
        error: 'Not Found'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ruleService.remove(id);
  }
}
