import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    Query,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { DeploymentService } from './deployment.service';
import { CreateDeploymentDto, DeploymentResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { DeploymentStatus } from '@prisma/client';

@ApiTags('Deployments')
@ApiBearerAuth()
@Controller('api/projects/:projectId/deployments')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class DeploymentController {
    constructor(private readonly deploymentService: DeploymentService) { }

    @Post()
    @ApiOperation({
        summary: 'Crear un nuevo deployment',
        description: 'Crea un nuevo deployment con los items especificados para un entorno',
    })
    @ApiParam({
        name: 'projectId',
        description: 'ID del proyecto',
        example: 'codegen-examples',
    })
    @ApiResponse({
        status: 201,
        description: 'Deployment creado exitosamente',
        type: DeploymentResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Datos de entrada inválidos',
    })
    @ApiResponse({
        status: 404,
        description: 'Proyecto o entorno no encontrado',
    })
    @Roles(Role.ADMIN, Role.TENANT_ADMIN)
    async createDeployment(
        @Param('projectId') projectId: string,
        @Body() createDeploymentDto: CreateDeploymentDto,
        @GetUser() user: User,
    ): Promise<DeploymentResponseDto> {
        return this.deploymentService.createDeployment(
            projectId,
            createDeploymentDto,
            user.id,
        );
    }

    @Get()
    @ApiOperation({
        summary: 'Listar deployments',
        description: 'Obtiene la lista de deployments de un proyecto con filtros opcionales',
    })
    @ApiParam({
        name: 'projectId',
        description: 'ID del proyecto',
        example: 'codegen-examples',
    })
    @ApiQuery({
        name: 'environmentId',
        description: 'Filtrar por ID de entorno',
        required: false,
        example: 'clx1234567890abcdef',
    })
    @ApiQuery({
        name: 'status',
        description: 'Filtrar por estado del deployment',
        required: false,
        enum: DeploymentStatus,
        example: 'PENDING',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de deployments',
        type: [DeploymentResponseDto],
    })
    @Roles(Role.ADMIN, Role.TENANT_ADMIN, Role.USER)
    async findAllDeployments(
        @Param('projectId') projectId: string,
        @Query('environmentId') environmentId?: string,
        @Query('status') status?: DeploymentStatus,
    ): Promise<DeploymentResponseDto[]> {
        return this.deploymentService.findAllDeployments(
            projectId,
            environmentId,
            status,
        );
    }

    @Get(':deploymentId')
    @ApiOperation({
        summary: 'Obtener deployment por ID',
        description: 'Obtiene los detalles completos de un deployment específico',
    })
    @ApiParam({
        name: 'projectId',
        description: 'ID del proyecto',
        example: 'codegen-examples',
    })
    @ApiParam({
        name: 'deploymentId',
        description: 'ID del deployment',
        example: 'clx1234567890abcdef',
    })
    @ApiResponse({
        status: 200,
        description: 'Detalles del deployment',
        type: DeploymentResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Deployment no encontrado',
    })
    @Roles(Role.ADMIN, Role.TENANT_ADMIN, Role.USER)
    async findDeploymentById(
        @Param('projectId') projectId: string,
        @Param('deploymentId') deploymentId: string,
    ): Promise<DeploymentResponseDto> {
        return this.deploymentService.findDeploymentById(projectId, deploymentId);
    }

    @Put(':deploymentId/approve')
    @ApiOperation({
        summary: 'Aprobar deployment',
        description: 'Aprueba un deployment pendiente para su ejecución',
    })
    @ApiParam({
        name: 'projectId',
        description: 'ID del proyecto',
        example: 'codegen-examples',
    })
    @ApiParam({
        name: 'deploymentId',
        description: 'ID del deployment',
        example: 'clx1234567890abcdef',
    })
    @ApiResponse({
        status: 200,
        description: 'Deployment aprobado exitosamente',
        type: DeploymentResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Deployment no está en estado pendiente',
    })
    @ApiResponse({
        status: 403,
        description: 'No se puede aprobar el propio deployment',
    })
    @ApiResponse({
        status: 404,
        description: 'Deployment no encontrado',
    })
    @Roles(Role.ADMIN, Role.TENANT_ADMIN)
    async approveDeployment(
        @Param('projectId') projectId: string,
        @Param('deploymentId') deploymentId: string,
        @GetUser() user: User,
    ): Promise<DeploymentResponseDto> {
        return this.deploymentService.approveDeployment(
            projectId,
            deploymentId,
            user.id,
        );
    }

    @Post(':deploymentId/deploy')
    @ApiOperation({
        summary: 'Ejecutar deployment',
        description: 'Ejecuta un deployment aprobado en el entorno especificado',
    })
    @ApiParam({
        name: 'projectId',
        description: 'ID del proyecto',
        example: 'codegen-examples',
    })
    @ApiParam({
        name: 'deploymentId',
        description: 'ID del deployment',
        example: 'clx1234567890abcdef',
    })
    @ApiResponse({
        status: 200,
        description: 'Deployment ejecutado exitosamente',
        type: DeploymentResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Deployment no está aprobado',
    })
    @ApiResponse({
        status: 404,
        description: 'Deployment no encontrado',
    })
    @Roles(Role.ADMIN, Role.TENANT_ADMIN)
    async deployDeployment(
        @Param('projectId') projectId: string,
        @Param('deploymentId') deploymentId: string,
        @GetUser() user: User,
    ): Promise<DeploymentResponseDto> {
        return this.deploymentService.deployDeployment(
            projectId,
            deploymentId,
            user.id,
        );
    }

    @Post(':deploymentId/rollback')
    @ApiOperation({
        summary: 'Hacer rollback de deployment',
        description: 'Hace rollback de un deployment a una versión anterior',
    })
    @ApiParam({
        name: 'projectId',
        description: 'ID del proyecto',
        example: 'codegen-examples',
    })
    @ApiParam({
        name: 'deploymentId',
        description: 'ID del deployment',
        example: 'clx1234567890abcdef',
    })
    @ApiResponse({
        status: 200,
        description: 'Rollback ejecutado exitosamente',
        type: DeploymentResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Deployment no encontrado',
    })
    @Roles(Role.ADMIN, Role.TENANT_ADMIN)
    async rollbackDeployment(
        @Param('projectId') projectId: string,
        @Param('deploymentId') deploymentId: string,
        @Body('rollbackToDeploymentId') rollbackToDeploymentId: string,
        @GetUser() user: User,
    ): Promise<DeploymentResponseDto> {
        return this.deploymentService.rollbackDeployment(
            projectId,
            deploymentId,
            rollbackToDeploymentId,
            user.id,
        );
    }
} 