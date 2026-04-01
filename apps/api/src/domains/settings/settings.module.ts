import { Module } from "@nestjs/common";

import { AuditCoreModule } from "../../common/audit/audit-core.module";
import { SecurityModule } from "../../common/security/security.module";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [SecurityModule, AuditCoreModule],
  controllers: [SettingsController]
})
export class SettingsModule {}
