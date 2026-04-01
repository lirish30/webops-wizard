import { BadRequestException } from "@nestjs/common";
import type { ZodType } from "zod";
import { ZodError } from "zod";

export function parseWithSchema<T>(
  schema: Pick<ZodType<T>, "parse">,
  input: unknown,
  context: "request" | "query" = "request"
): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const fallback = context === "query" ? "Invalid query." : "Invalid request.";
      throw new BadRequestException(error.issues[0]?.message ?? fallback);
    }
    throw error;
  }
}
