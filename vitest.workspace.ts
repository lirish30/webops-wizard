import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/config",
  "packages/types",
  "apps/api",
  "apps/worker"
]);
