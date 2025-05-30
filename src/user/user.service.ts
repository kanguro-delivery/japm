import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma, User } from '@prisma/client';
import { AuditLoggerService } from '../common/services/audit-logger.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) { }

  async create(
    createUserDto: CreateUserDto,
    tenantId: string,
    adminUserId: string,
  ): Promise<User> {
    const { password, tenantId: dtoTenantId, ...rest } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          ...rest,
          password: hashedPassword,
          tenant: { connect: { id: tenantId } },
        },
      });

      this.auditLogger.logCreation(
        { userId: adminUserId, tenantId },
        'USER',
        user.id,
        user.email,
        { email: user.email, name: user.name, role: user.role },
      );

      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (
          error.meta?.target &&
          Array.isArray(error.meta.target) &&
          error.meta.target.includes('email')
        ) {
          throw new ConflictException('Email already exists');
        }
        throw new ConflictException(
          'User creation failed due to unique constraint violation.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        console.error(
          `Foreign key constraint failed creating user. Invalid tenantId '${tenantId}'?`,
          error.meta,
        );
        throw new NotFoundException('Referenced tenant not found.');
      }
      console.error('Error creating user:', error);
      throw error;
    }
  }

  findAll(tenantId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        tenantId: tenantId
      }
    });
  }

  async findOneById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    adminUserId: string,
    tenantId: string,
  ): Promise<User> {
    const existingUser = await this.findOneById(id);
    const { password, ...dataToUpdate } = updateUserDto;

    let hashedPassword: string | undefined = undefined;
    if (password) {
      console.warn('Password update requested for user', id);
      hashedPassword = await bcrypt.hash(password, 10);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          ...dataToUpdate,
          ...(hashedPassword && { password: hashedPassword }),
        },
      });

      this.auditLogger.logUpdate(
        { userId: adminUserId, tenantId },
        'USER',
        id,
        updatedUser.email,
        {
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
        },
        {
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
        },
        Object.keys(dataToUpdate),
      );

      return updatedUser;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID "${id}" not found`);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      console.error(`Error updating user ${id}:`, error);
      throw error;
    }
  }

  async remove(
    id: string,
    adminUserId: string,
    tenantId: string,
  ): Promise<User> {
    const existingUser = await this.findOneById(id);
    try {
      const deletedUser = await this.prisma.user.delete({
        where: { id },
      });

      this.auditLogger.logDeletion(
        { userId: adminUserId, tenantId },
        'USER',
        id,
        existingUser.email,
        {
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
        },
      );

      return deletedUser;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID "${id}" not found`);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          `Cannot delete user ${id} as they are still referenced.`,
        );
      }
      console.error(`Error deleting user ${id}:`, error);
      throw error;
    }
  }
}
