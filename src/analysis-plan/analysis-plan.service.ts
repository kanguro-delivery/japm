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

  async update(id: string, updateAnalysisPlanDto: UpdateAnalysisPlanDto) {
    await this.findOne(id); // Check if analysis plan exists

    return this.prisma.analysisPlan.update({
      where: { id },
      data: {
        ...updateAnalysisPlanDto,
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if analysis plan exists

    return this.prisma.analysisPlan.delete({
      where: { id },
    });
  }
}
