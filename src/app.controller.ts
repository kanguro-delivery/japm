import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from './auth/enums/role.enum';
import { RolesGuard } from './auth/guards/roles.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Authentication and Roles')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get('admin-check')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Check admin access',
    description: 'Endpoint to verify if the user has admin role',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin access granted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Admin role required',
  })
  adminCheck() {
    return { message: 'Admin access granted!' };
  }

  @Get('tenant-admin-check')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.TENANT_ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Check tenant admin access',
    description: 'Endpoint to verify if the user has tenant admin role',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant admin access granted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Tenant admin role required',
  })
  tenantAdminCheck() {
    return { message: 'Tenant admin access granted!' };
  }

  @Get('user-check')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.USER)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Check user access',
    description: 'Endpoint to verify if the user has basic user role',
  })
  @ApiResponse({ status: 200, description: 'User access granted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Access denied - User role required',
  })
  userCheck() {
    return { message: 'User access granted!' };
  }

  @Get('any-authenticated-check')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Check authentication',
    description:
      'Endpoint to verify if the user is authenticated (without requiring specific role)',
  })
  @ApiResponse({
    status: 200,
    description: 'Access granted - User authenticated',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  anyAuthenticatedCheck() {
    return {
      message: 'Authenticated access granted (no specific role required)!',
    };
  }
}
