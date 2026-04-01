import { Module } from "@nestjs/common";

import { AuditCoreModule } from "../../common/audit/audit-core.module";
import { SecurityModule } from "../../common/security/security.module";
import { IntegrationsController } from "./integrations.controller";

@Module({
  imports: [SecurityModule, AuditCoreModule],
  controllers: [IntegrationsController]
})
export class IntegrationsModule {}
