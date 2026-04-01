import { Module } from "@nestjs/common";

import { AuditCoreModule } from "../../common/audit/audit-core.module";
import { SecurityModule } from "../../common/security/security.module";
import { AuthModule } from "../auth/auth.module";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

@Module({
  imports: [AuthModule, SecurityModule, AuditCoreModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService]
})
export class WorkspacesModule {}
