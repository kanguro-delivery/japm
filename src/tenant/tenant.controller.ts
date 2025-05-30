import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Req,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto, TenantDto } from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { Request } from 'express';
import { User } from '@prisma/client';

interface RequestWithUser extends Request {
  user?: User;
}

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Create new tenant',
    description:
      'Creates a new tenant in the system. This operation requires admin or tenant admin privileges.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tenant successfully created',
    type: TenantDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data - Check the request body format',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Tenant name already exists - The provided name is already in use',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Admin or tenant admin role required',
  })
  create(
    @Body() createTenantDto: CreateTenantDto,
    @Req() req: RequestWithUser,
  ): Promise<TenantDto> {
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.tenantService.create(createTenantDto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Get all tenants',
    description:
      'Retrieves a list of all tenants in the system. This operation requires admin or tenant admin privileges.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of tenants retrieved successfully',
    type: [TenantDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Admin or tenant admin role required',
  })
  findAll(): Promise<TenantDto[]> {
    return this.tenantService.findAll();
  }

  @Get(':tenantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Get tenant by ID',
    description:
      'Retrieves a specific tenant by their unique ID. Accessible by admins or tenant admins.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tenant found successfully',
    type: TenantDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tenant not found - The specified ID does not exist',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Admin or tenant admin role required',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Unique tenant identifier (UUID or "default-tenant")',
    required: true,
  })
  async findOne(
    @Param('tenantId') tenantId: string,
    @Req() req: RequestWithUser,
  ): Promise<TenantDto> {
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Validación especial para el tenant por defecto
    if (tenantId === 'default-tenant') {
      return this.tenantService.findOne(tenantId);
    }

    // Para el resto de IDs, validamos que sea un UUID válido
    try {
      new ParseUUIDPipe().transform(tenantId, {
        type: 'param',
        data: 'tenantId',
      });
    } catch {
      throw new BadRequestException(
        'Invalid tenant ID format. Must be a valid UUID or "default-tenant"',
      );
    }

    return this.tenantService.findOne(tenantId);
  }

  @Patch(':tenantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Update tenant',
    description:
      "Updates an existing tenant's information. Accessible by global admins or tenant admins.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tenant updated successfully',
    type: TenantDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tenant not found - The specified ID does not exist',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data - Check the request body format',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Tenant name already exists - The provided name is already in use',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Admin or tenant admin role required',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    format: 'uuid',
    description: 'Unique tenant identifier to update (UUID)',
    required: true,
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @Req() req: RequestWithUser,
  ): Promise<TenantDto> {
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.tenantService.update(tenantId, updateTenantDto, req.user.id);
  }

  @Delete(':tenantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Delete tenant',
    description:
      'Permanently deletes a tenant from the system. Accessible by global admins or tenant admins.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tenant deleted successfully',
    type: TenantDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Tenant not found - The specified ID does not exist',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Admin or tenant admin role required',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    format: 'uuid',
    description: 'Unique tenant identifier to delete (UUID)',
    required: true,
  })
  async remove(
    @Param('tenantId') tenantId: string,
    @Req() req: RequestWithUser,
  ): Promise<TenantDto> {
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.tenantService.remove(tenantId, req.user.id);
  }
}
