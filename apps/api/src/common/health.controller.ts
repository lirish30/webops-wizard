import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { buildSuccessEnvelopeSchema } from "./api/openapi-schemas";

@Controller("health")
@ApiTags("health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Health check" })
  @ApiOkResponse({
    description: "API health status.",
    schema: buildSuccessEnvelopeSchema({
      type: "object",
      properties: {
        service: { type: "string", example: "api" },
        status: { type: "string", example: "ok" }
      },
      required: ["service", "status"]
    })
  })
  getHealth() {
    return {
      service: "api",
      status: "ok"
    };
  }
}
