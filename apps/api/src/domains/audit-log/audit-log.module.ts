import { Module } from "@nestjs/common";

import { AuditCoreModule } from "../../common/audit/audit-core.module";
import { SecurityModule } from "../../common/security/security.module";
import { AuditLogController } from "./audit-log.controller";

@Module({
  imports: [SecurityModule, AuditCoreModule],
  controllers: [AuditLogController]
})
export class AuditLogModule {}

