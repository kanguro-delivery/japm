import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnalysisPlanDto } from './dto/create-analysis-plan.dto';
import { UpdateAnalysisPlanDto } from './dto/update-analysis-plan.dto';

@Injectable()
export class AnalysisPlanService {
  constructor(private prisma: PrismaService) {}

  async create(createAnalysisPlanDto: CreateAnalysisPlanDto) {
    return this.prisma.analysisPlan.create({
      data: {
        ...createAnalysisPlanDto,
      },
    });
  }

  async findAll() {
    return this.prisma.analysisPlan.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const analysisPlan = await this.prisma.analysisPlan.findUnique({
      where: { id },
    });

    if (!analysisPlan) {
      throw new NotFoundException(`Analysis Plan with ID ${id} not found`);
    }

    return analysisPlan;
  }

  async findOneByName(name: string) {
    const analysisPlan = await this.prisma.analysisPlan.findFirst({
      where: { name },
    });

    if (!analysisPlan) {
      throw new NotFoundException(`Analysis Plan with name ${name} not found`);
    }

    return analysisPlan;
  }

  async update(id: string, updateAnalysisPlanDto: UpdateAnalysisPlanDto) {
    try {
      return await this.prisma.analysisPlan.update({
        where: { id },
        data: updateAnalysisPlanDto,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Analysis Plan with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.analysisPlan.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Analysis Plan with ID ${id} not found`);
      }
      throw error;
    }
  }
}
