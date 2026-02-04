import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

@Injectable()
export class RuleService {
  constructor(private prisma: PrismaService) {}

  async create(createRuleDto: CreateRuleDto) {
    return this.prisma.rule.create({
      data: {
        ...createRuleDto,
      },
    });
  }

  async findAll(filters?: { language?: string; version?: string }) {
    return this.prisma.rule.findMany({
      where: {
        ...(filters?.language && { language: filters.language }),
        ...(filters?.version && { version: filters.version }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.rule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(`Rule with ID ${id} not found`);
    }

    return rule;
  }

  async findByTitle(title: string) {
    const rule = await this.prisma.rule.findFirst({
      where: { title },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!rule) {
      throw new NotFoundException(`Rule with title "${title}" not found`);
    }

    return rule;
  }

  async update(id: string, updateRuleDto: UpdateRuleDto) {
    await this.findOne(id); // Check if rule exists

    return this.prisma.rule.update({
      where: { id },
      data: {
        ...updateRuleDto,
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if rule exists

    return this.prisma.rule.delete({
      where: { id },
    });
  }
}
