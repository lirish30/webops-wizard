import { Module } from "@nestjs/common";

import { AuditCoreModule } from "../../common/audit/audit-core.module";
import { SecurityModule } from "../../common/security/security.module";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [SecurityModule, AuditCoreModule],
  controllers: [ReportsController]
})
export class ReportsModule {}
