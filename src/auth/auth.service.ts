import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from '../user/user.service'; // Adjust path
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy'; // Import payload interface

const DEFAULT_TENANT_ID = 'default-tenant-id'; // Reemplaza por el id real si lo tienes

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) { }

  // Used by LocalStrategy
  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userService.findOneByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      // Return the full user object here (LocalStrategy will remove the password)
      return user;
    }
    return null;
  }

  // Used by AuthController /login after LocalAuthGuard
  login(user: Omit<User, 'password'>): { access_token: string } {
    // user here is the object returned by LocalStrategy.validate (without password)
    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      tenantId: user.tenantId,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  // Used by AuthController /register
  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    try {
      const newUser = await this.userService.create(
        registerDto,
        DEFAULT_TENANT_ID,
        'system' // Registro público, sin admin real
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = newUser;
      return result;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error during user registration:', error);
      }
      throw new Error('Failed to register user.');
    }
  }

  // Method to get profile (used by /profile endpoint)
  async getProfile(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.userService.findOneById(userId);
    if (!user) {
      // This shouldn't happen if the token is valid and JwtStrategy verifies existence
      throw new NotFoundException('User not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  // Method to find user by email (used by initial setup check)
  async findOneByEmail(email: string): Promise<User | null> {
    return this.userService.findOneByEmail(email);
  }
}
