import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { PageIntelligenceController } from "./page-intelligence.controller";
import { PagesService } from "./pages.service";

@Module({
  imports: [SecurityModule],
  controllers: [PageIntelligenceController],
  providers: [PagesService]
})
export class PageIntelligenceModule {}
