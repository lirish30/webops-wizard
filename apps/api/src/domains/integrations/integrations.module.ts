import { Module } from "@nestjs/common";

import { AuditCoreModule } from "../../common/audit/audit-core.module";
import { SecurityModule } from "../../common/security/security.module";
import { BackgroundJobsModule } from "../background-jobs/background-jobs.module";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";

@Module({
  imports: [SecurityModule, AuditCoreModule, BackgroundJobsModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService]
})
export class IntegrationsModule {}
