import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { PageIntelligenceController } from "./page-intelligence.controller";

@Module({
  imports: [SecurityModule],
  controllers: [PageIntelligenceController]
})
export class PageIntelligenceModule {}
