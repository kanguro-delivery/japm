import {
  Controller,
  Param,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Request,
  Post,
  Body,
  Logger,
  Query,
} from '@nestjs/common';
import { ServePromptService } from './serve-prompt.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectGuard } from '../common/guards/project.guard';
import { PromptConsumerGuard } from '../common/guards/prompt-consumer.guard';
import { ExecutePromptBodyDto } from './dto/execute-prompt-body.dto';
import { ExecutePromptQueryDto } from './dto/execute-prompt-query.dto';
import { PromptAsset } from '@prisma/client';

@ApiTags('Serve Prompt')
@ApiBearerAuth()
@UseGuards(PromptConsumerGuard)
@Controller('serve-prompt')
export class ServePromptController {
  private readonly logger = new Logger(ServePromptController.name);
  constructor(private readonly service: ServePromptService) { }

  @Post('execute/:projectId/:promptName/:versionTag/base')
  @UseGuards(ProjectGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary:
      'Assembles and prepares a specific prompt version (base language) for execution with provided variables',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({
    name: 'promptName',
    description: 'The unique name of the prompt within the project',
  })
  @ApiParam({
    name: 'versionTag',
    description:
      'Specific version tag (e.g., "v1.2.0") or "latest" to use the most recent version',
  })
  @ApiQuery({ type: ExecutePromptQueryDto })
  @ApiBody({
    type: ExecutePromptBodyDto,
    description: 'Input variables for the prompt',
  })
  @ApiResponse({
    status: 200,
    description: 'Processed prompt text ready for execution and metadata.',
    schema: {
      example: {
        processedPrompt: 'string',
        metadata: {},
        assets: 'PromptAsset[]',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Project, Prompt, or Version not found.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters or failed template rendering.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden Access to Project.' })
  async executePromptWithoutLanguage(
    @Param('projectId') projectId: string,
    @Param('promptName') promptName: string,
    @Param('versionTag') versionTag: string,
    @Body() body: ExecutePromptBodyDto,
    @Query() query: ExecutePromptQueryDto,
  ): Promise<{
    processedPrompt: string;
    metadata: any;
    assets?: PromptAsset[];
  }> {
    this.logger.log(
      `[ServePromptController] Request received for executePromptWithoutLanguage.`,
    );
    this.logger.debug(
      `[ServePromptController] Params: projectId=${projectId}, promptName=${promptName}, versionTag=${versionTag}, query=${JSON.stringify(
        query,
      )}`,
    );
    return this.service.executePromptVersion(
      { projectId, promptName, versionTag },
      body,
      query,
    );
  }

  @Post('execute/:projectId/:promptName/:versionTag/lang/:languageCode')
  @UseGuards(ProjectGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary:
      'Assembles and prepares a specific prompt version (specific language) for execution with provided variables',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({
    name: 'promptName',
    description: 'The unique name of the prompt within the project',
  })
  @ApiParam({
    name: 'versionTag',
    description:
      'Specific version tag (e.g., "v1.2.0") or "latest" to use the most recent version',
  })
  @ApiParam({
    name: 'languageCode',
    required: true,
    description: 'Language code for translation (e.g., "es")',
    type: String,
  })
  @ApiQuery({ type: ExecutePromptQueryDto })
  @ApiBody({
    type: ExecutePromptBodyDto,
    description: 'Input variables for the prompt',
  })
  @ApiResponse({
    status: 200,
    description: 'Processed prompt text ready for execution and metadata.',
    schema: {
      example: {
        processedPrompt: 'string',
        metadata: {},
        assets: 'PromptAsset[]',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Project, Prompt, or Version not found.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters or failed template rendering.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden Access to Project.' })
  async executePromptWithLanguage(
    @Param('projectId') projectId: string,
    @Param('promptName') promptName: string,
    @Param('versionTag') versionTag: string,
    @Param('languageCode') languageCode: string,
    @Body() body: ExecutePromptBodyDto,
    @Query() query: ExecutePromptQueryDto,
  ): Promise<{
    processedPrompt: string;
    metadata: any;
    assets?: PromptAsset[];
  }> {
    return this.service.executePromptVersion(
      { projectId, promptName, versionTag, languageCode },
      body,
      query,
    );
  }
}
