import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Request,
  UnauthorizedException,
  Query,
  BadRequestException,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { User } from '@prisma/client'; // Import User type from Prisma
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { Logger } from '@nestjs/common'; // Import Logger

interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: Role;
  };
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TENANT_ADMIN)
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) { }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Create new user',
    description:
      'Creates a new user in the system. For tenant_admins, can optionally specify a tenantId to create the user in that tenant.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
    type: CreateUserDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data - Check the request body format',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Admin or tenant admin role required',
  })
  create(@Request() req: RequestWithUser, @Body() createUserDto: CreateUserDto): Promise<User> {
    const user = req.user;
    if (!user) {
      this.logger.error('User not found in request for user creation');
      throw new UnauthorizedException('User not authenticated');
    }

    // Si el usuario es tenant_admin y especifica un tenantId
    if (user.role === Role.TENANT_ADMIN && createUserDto.tenantId) {
      // Si es default-tenant, lo permitimos directamente
      if (createUserDto.tenantId === 'default-tenant') {
        return this.userService.create(createUserDto, createUserDto.tenantId, user.id);
      }

      // Para el resto de IDs, validamos que sea un UUID válido
      try {
        new ParseUUIDPipe().transform(createUserDto.tenantId, {
          type: 'param',
          data: 'tenantId',
        });
        return this.userService.create(createUserDto, createUserDto.tenantId, user.id);
      } catch {
        throw new BadRequestException(
          'Invalid tenant ID format. Must be a valid UUID or "default-tenant"',
        );
      }
    }

    // Para cualquier otro caso, usamos el tenantId del usuario autenticado
    const tenantId = user.tenantId;
    if (!tenantId) {
      this.logger.error(
        'Tenant ID not found in authenticated admin user request for user creation',
      );
      throw new UnauthorizedException('Admin user tenant information is missing');
    }
    return this.userService.create(createUserDto, tenantId, user.id);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieves a list of users. For tenant_admins, can optionally specify a tenantId to list users from that tenant.',
  })
  @ApiQuery({ type: ListUsersDto })
  @ApiResponse({
    status: 200,
    description: 'List of users retrieved successfully',
    type: [CreateUserDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required or invalid tenant access',
  })
  findAll(
    @Request() req: RequestWithUser,
    @Query() query: ListUsersDto,
  ): Promise<User[]> {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userTenantId = user.tenantId;
    if (!userTenantId) {
      this.logger.error(
        'Tenant ID not found in authenticated user request for user listing',
      );
      throw new UnauthorizedException('User tenant information is missing');
    }

    // Si el usuario es tenant_admin y especificó un tenantId, usamos ese
    if (user.role === Role.TENANT_ADMIN && query.tenantId) {
      // Validación especial para el tenant por defecto
      if (query.tenantId === 'default-tenant') {
        return this.userService.findAll(query.tenantId);
      }

      // Para el resto de IDs, validamos que sea un UUID válido
      try {
        new ParseUUIDPipe().transform(query.tenantId, {
          type: 'param',
          data: 'tenantId',
        });
      } catch {
        throw new BadRequestException(
          'Invalid tenant ID format. Must be a valid UUID or "default-tenant"',
        );
      }
      return this.userService.findAll(query.tenantId);
    }

    // Para cualquier otro caso, usamos el tenantId del usuario autenticado
    return this.userService.findAll(userTenantId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description:
      'Retrieves a specific user by their unique ID. Requires admin privileges.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique user identifier (CUID)',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'User found successfully',
    type: CreateUserDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found - The specified ID does not exist',
  })
  findOne(@Param('id') id: string): Promise<User> {
    return this.userService.findOneById(id);
  }

  @Patch(':id')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: true,
    }),
  )
  @ApiOperation({
    summary: 'Update user',
    description:
      "Updates an existing user's information. Requires admin privileges.",
  })
  @ApiParam({
    name: 'id',
    description: 'Unique user identifier to update (CUID)',
    type: String,
    required: true,
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'User data to update',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: CreateUserDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data - Check the request body format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found - The specified ID does not exist',
  })
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    this.logger.debug(
      `[update] Received PATCH for userId: ${id}. Body: ${JSON.stringify(updateUserDto, null, 2)}`,
    );
    const tenantId = req.user?.tenantId;
    const adminUserId = req.user?.id;

    if (!tenantId || !adminUserId) {
      this.logger.error(
        'Tenant ID or Admin User ID not found in authenticated admin user request for user update',
      );
      throw new UnauthorizedException(
        'Admin user information is missing',
      );
    }
    return this.userService.update(id, updateUserDto, adminUserId, tenantId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete user',
    description:
      'Permanently deletes a user from the system. Requires admin privileges.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique user identifier to delete (CUID)',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    type: CreateUserDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found - The specified ID does not exist',
  })
  remove(@Request() req, @Param('id') id: string): Promise<User> {
    const tenantId = req.user?.tenantId;
    const adminUserId = req.user?.id;

    if (!tenantId || !adminUserId) {
      this.logger.error(
        'Tenant ID or Admin User ID not found in authenticated admin user request for user deletion',
      );
      throw new UnauthorizedException(
        'Admin user information is missing',
      );
    }
    return this.userService.remove(id, adminUserId, tenantId);
  }
}
