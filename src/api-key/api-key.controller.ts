import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import {
    CreateApiKeyDto,
    UpdateApiKeyDto,
    CreateApiKeyResponseDto,
} from './dto';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ApiKeys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeyController {
    constructor(private readonly apiKeyService: ApiKeyService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new API Key for the current user' })
    @ApiResponse({
        status: 201,
        description: 'API Key created successfully. The full key is returned only once.',
        type: CreateApiKeyResponseDto,
    })
    create(@Body() createApiKeyDto: CreateApiKeyDto, @GetUser() user: User) {
        return this.apiKeyService.create(createApiKeyDto, user);
    }

    @Get()
    @ApiOperation({ summary: 'List all API Keys for the current user' })
    findAll(@GetUser() user: User) {
        return this.apiKeyService.findAllForUser(user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific API Key for the current user' })
    findOne(@Param('id') id: string, @GetUser() user: User) {
        return this.apiKeyService.findOneForUser(id, user);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an API Key for the current user' })
    update(
        @Param('id') id: string,
        @Body() updateApiKeyDto: UpdateApiKeyDto,
        @GetUser() user: User,
    ) {
        return this.apiKeyService.update(id, updateApiKeyDto, user);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Revoke an API Key for the current user' })
    remove(@Param('id') id: string, @GetUser() user: User) {
        return this.apiKeyService.revoke(id, user);
    }
} 