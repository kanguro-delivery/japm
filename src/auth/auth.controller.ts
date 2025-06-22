import {
  Controller,
  Request,
  Post,
  UseGuards,
  Get,
  Body,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import {
  ThrottleAuth,
  ThrottleRead,
} from '../common/decorators/throttle.decorator';
import { AuthenticatedRequest } from '../common/types/request.types';
import { Public } from './decorators/public.decorator';

// DTO for Login response
class LoginResponse {
  @ApiProperty({
    description: 'JWT access token for authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;
}

// DTO for Register/Profile response (without password)
class UserProfileResponse {
  @ApiProperty({
    description: 'Unique user identifier',
    example: 'clg123xyz',
  })
  id: string;

  @ApiProperty({
    description: "User's email address",
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: "User's full name",
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-03-20T10:30:00Z',
  })
  createdAt: Date;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register new user',
    description:
      'Creates a new user account in the system. This endpoint is publicly accessible.',
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: UserProfileResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data - Check the request body format',
  })
  @ApiResponse({
    status: 409,
    description:
      'Email already exists - The provided email is already registered',
  })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.CREATED)
  @ThrottleAuth()
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<Omit<User, 'password'>> {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticates a user and returns a JWT token for subsequent API calls',
  })
  @ApiBody({
    type: LoginDto,
    description: 'User credentials for authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful - Returns JWT token',
    type: LoginResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials - Email or password is incorrect',
  })
  @HttpCode(HttpStatus.OK)
  @ThrottleAuth()
  login(@Request() req: { user: User }): { access_token: string } {
    return this.authService.login(req.user);
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get user profile',
    description:
      'Retrieves the profile information of the currently authenticated user',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserProfileResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ThrottleRead()
  getProfile(
    @Request() req: AuthenticatedRequest,
  ): Promise<Omit<User, 'password'>> {
    return this.authService.getProfile(req.user.id);
  }

  @Public()
  @Get('initial_setup_check')
  @ApiOperation({
    summary: 'Check if initial setup is needed',
    description: 'Returns true if a user with the specified email exists, false otherwise',
  })
  @ApiResponse({
    status: 200,
    description: 'Initial setup check result',
    schema: {
      type: 'object',
      properties: {
        exists: {
          type: 'boolean',
          description: 'Whether the user exists or not',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user if it exists',
          nullable: true,
        },
      },
    },
  })
  async initialSetupCheck(): Promise<{
    exists: boolean;
    userId: string | null;
  }> {
    const email = 'test@example.com';
    const user = await this.authService.findOneByEmail(email);
    return {
      exists: !!user,
      userId: user?.id || null,
    };
  }
}
