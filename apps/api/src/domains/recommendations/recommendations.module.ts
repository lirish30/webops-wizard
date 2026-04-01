import { Module } from "@nestjs/common";

import { AuditCoreModule } from "../../common/audit/audit-core.module";
import { SecurityModule } from "../../common/security/security.module";
import { RecommendationsController } from "./recommendations.controller";

@Module({
  imports: [SecurityModule, AuditCoreModule],
  controllers: [RecommendationsController]
})
export class RecommendationsModule {}
