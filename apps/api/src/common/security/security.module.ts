import { Module } from "@nestjs/common";

import { AuthModule } from "../../domains/auth/auth.module";
import { SessionAuthGuard, WorkspaceAccessGuard } from "./workspace-auth";

@Module({
  imports: [AuthModule],
  providers: [SessionAuthGuard, WorkspaceAccessGuard],
  exports: [SessionAuthGuard, WorkspaceAccessGuard]
})
export class SecurityModule {}

