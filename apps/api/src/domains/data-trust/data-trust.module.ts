import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { DataTrustController } from "./data-trust.controller";

@Module({
  imports: [SecurityModule],
  controllers: [DataTrustController]
})
export class DataTrustModule {}
