import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Region } from '@prisma/client';
import { AuditLoggerService } from '../common/services/audit-logger.service';

@Injectable()
export class RegionService {
  constructor(
    private prisma: PrismaService,
    private auditLogger: AuditLoggerService,
  ) {}

  async create(
    createRegionDto: CreateRegionDto,
    projectId: string,
    userId: string,
    tenantId: string,
  ): Promise<Region> {
    const { parentRegionId, languageCode, ...restData } = createRegionDto;

    let parentRegionConnect:
      | Prisma.RegionCreateNestedOneWithoutFrom_Region_parentRegionInput
      | undefined = undefined;
    if (parentRegionId) {
      // parentRegionId es el languageCode del padre desde el DTO
      const parent = await this.prisma.region.findUnique({
        where: {
          projectId_languageCode: { projectId, languageCode: parentRegionId },
        },
        select: { id: true }, // Obtener el CUID id del padre
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent Region with languageCode "${parentRegionId}" not found in project "${projectId}".`,
        );
      }
      parentRegionConnect = { connect: { id: parent.id } }; // Conectar usando el CUID id del padre
    }

    const data: Prisma.RegionCreateInput = {
      ...restData,
      languageCode, // Asegurar que languageCode se incluye en los datos a crear
      project: { connect: { id: projectId } },
      parentRegion: parentRegionConnect,
    };

    try {
      const region = await this.prisma.region.create({
        data,
        include: { culturalData: true, parentRegion: true },
      });

      this.auditLogger.logCreation(
        { userId, tenantId, projectId },
        'REGION',
        region.id,
        languageCode,
        { languageCode, parentRegionId, ...restData },
      );

      return region;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Verificar si el error es por la combinación de projectId y languageCode
          if (
            error.meta?.target &&
            Array.isArray(error.meta.target) &&
            (error.meta.target.includes('project') ||
              error.meta.target.includes('projectId')) &&
            error.meta.target.includes('languageCode')
          ) {
            throw new ConflictException(
              `Region with languageCode "${languageCode}" already exists in project "${projectId}".`,
            );
          }
          // Cualquier otro P2002 también debería ser un conflicto
          throw new ConflictException(
            `Region with languageCode "${languageCode}" already exists in project "${projectId}".`,
          );
        } else if (error.code === 'P2025') {
          throw new NotFoundException(
            `Data integrity error during region creation: ${error.message}`,
          );
        }
      }
      throw error;
    }
  }

  findAll(projectId: string): Promise<Region[]> {
    return this.prisma.region.findMany({
      where: { projectId },
      include: { culturalData: true, parentRegion: true },
    });
  }

  async findOne(languageCode: string, projectId: string): Promise<Region> {
    const region = await this.prisma.region.findUnique({
      // Usar el identificador único compuesto para la búsqueda
      where: { projectId_languageCode: { projectId, languageCode } },
      include: {
        culturalData: true,
        parentRegion: true,
      },
    });
    if (!region) {
      throw new NotFoundException(
        `Region with languageCode "${languageCode}" not found in project "${projectId}"`,
      );
    }
    return region;
  }

  async update(
    languageCode: string,
    updateRegionDto: UpdateRegionDto,
    projectId: string,
    userId: string,
    tenantId: string,
  ): Promise<Region> {
    const regionToUpdate = await this.findOne(languageCode, projectId);
    const {
      parentRegionId,
      tenantId: _omitTenantId,
      ...restData
    } = updateRegionDto as any; // Omitir tenantId si viene
    let parentRegionUpdate:
      | Prisma.RegionUpdateOneWithoutFrom_Region_parentRegionNestedInput
      | undefined = undefined;
    if (parentRegionId !== undefined) {
      if (parentRegionId === null) {
        parentRegionUpdate = { disconnect: true };
      } else {
        const parent = await this.prisma.region.findUnique({
          where: {
            projectId_languageCode: { projectId, languageCode: parentRegionId },
          },
          select: { id: true },
        });
        if (!parent) {
          throw new NotFoundException(
            `Parent Region with languageCode "${parentRegionId}" not found in project "${projectId}".`,
          );
        }
        parentRegionUpdate = { connect: { id: parent.id } };
      }
    }
    const data: Prisma.RegionUpdateInput = {
      ...restData,
      parentRegion: parentRegionUpdate,
    };
    try {
      const updatedRegion = await this.prisma.region.update({
        where: { id: regionToUpdate.id },
        data,
        include: { culturalData: true, parentRegion: true },
      });

      this.auditLogger.logUpdate(
        { userId, tenantId, projectId },
        'REGION',
        updatedRegion.id,
        languageCode,
        { ...regionToUpdate },
        { ...updatedRegion },
        Object.keys(restData),
      );

      return updatedRegion;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Como languageCode no es parte de UpdateRegionDto, no puede causar un P2002
          // sobre el constraint (projectId, languageCode) a través de un cambio directo.
          // Podría haber otros P2002 si otros campos en restData tienen constraints unique.
          throw new ConflictException(
            `Update failed due to a unique constraint violation.`,
          );
        } else if (error.code === 'P2025') {
          throw new NotFoundException(
            `Data integrity error during region update: ${error.message}.`,
          );
        }
      }
      throw error;
    }
  }

  async remove(
    languageCode: string,
    projectId: string,
    userId: string,
    tenantId: string,
  ): Promise<Region> {
    return this.prisma.$transaction(async (tx) => {
      // Encontrar la región por su projectId y languageCode para obtener su CUID id
      const regionFound = await tx.region.findUnique({
        where: { projectId_languageCode: { projectId, languageCode } },
        select: { id: true }, // Solo necesitamos el id para la eliminación
      });

      if (!regionFound) {
        throw new NotFoundException(
          `Region with languageCode "${languageCode}" not found in project "${projectId}"`,
        );
      }

      // Obtener los datos completos de la región para el log de auditoría
      const regionToDelete = await tx.region.findUnique({
        where: { id: regionFound.id },
        include: { culturalData: true, parentRegion: true },
      });

      // Eliminar CulturalData asociada usando el CUID id de la región
      // Nota: CulturalData.regionId ahora se refiere al CUID de Region
      await tx.culturalData.deleteMany({
        where: { regionId: regionFound.id },
      });

      // Eliminar la región usando su CUID id
      const deletedRegion = await tx.region.delete({
        where: { id: regionFound.id },
      });

      this.auditLogger.logDeletion(
        { userId, tenantId, projectId },
        'REGION',
        deletedRegion.id,
        languageCode,
        { ...regionToDelete },
      );

      return deletedRegion;
    });
  }
}
