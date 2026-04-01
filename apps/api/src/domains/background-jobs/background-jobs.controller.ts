import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";

import {
  buildSuccessEnvelopeSchema,
  COOKIE_AUTH_SCHEME
} from "../../common/api/openapi-schemas";
import { parseWithSchema } from "../../common/api/validation";
import {
  CurrentWorkspace,
  RequireWorkspaceCapabilities,
  SessionAuthGuard,
  WorkspaceAccessGuard,
  type WorkspaceAccess
} from "../../common/security/workspace-auth";
import {
  enqueueBackgroundJobSchema,
  listWorkflowJobsQuerySchema
} from "./background-jobs.dto";
import {
  BackgroundJobsService,
  isWorkflowQueueName
} from "./background-jobs.service";

@Controller("jobs")
@UseGuards(SessionAuthGuard, WorkspaceAccessGuard)
@ApiTags("jobs")
@ApiCookieAuth(COOKIE_AUTH_SCHEME)
export class BackgroundJobsController {
  constructor(private readonly backgroundJobsService: BackgroundJobsService) {}

  @Post()
  @RequireWorkspaceCapabilities("integration.manage")
  @ApiOperation({ summary: "Enqueue background workflow job" })
  @ApiOkResponse({
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        deduplicated: { type: "boolean" },
        job: { type: "object", additionalProperties: true }
      }
    })
  })
  async enqueueJob(@Body() body: unknown, @CurrentWorkspace() workspace: WorkspaceAccess) {
    const input = parseWithSchema(enqueueBackgroundJobSchema, body);

    return this.backgroundJobsService.enqueueForWorkspace({
      workspaceId: workspace.workspaceId,
      userId: workspace.userId,
      body: input
    });
  }

  @Get(":workflow")
  @RequireWorkspaceCapabilities("integration.read")
  @ApiOperation({ summary: "List recent jobs for a workflow queue" })
  async listQueueJobs(@Param("workflow") workflow: string, @Query() query: unknown) {
    if (!isWorkflowQueueName(workflow)) {
      throw new NotFoundException("Unknown workflow queue.");
    }

    const parsedQuery = parseWithSchema(listWorkflowJobsQuerySchema, query);
    return this.backgroundJobsService.listJobs(workflow, parsedQuery);
  }

  @Get(":workflow/:jobId")
  @RequireWorkspaceCapabilities("integration.read")
  @ApiOperation({ summary: "Get workflow job status" })
  async getJobStatus(@Param("workflow") workflow: string, @Param("jobId") jobId: string) {
    if (!isWorkflowQueueName(workflow)) {
      throw new NotFoundException("Unknown workflow queue.");
    }

    const status = await this.backgroundJobsService.getJobStatus(workflow, jobId);

    if (!status) {
      throw new NotFoundException("Job not found in workflow queue.");
    }

    return status;
  }
}
