import { MembershipRole } from "@prisma/client";
import { z } from "zod";

export const updateMembershipRoleSchema = z.object({
  role: z.nativeEnum(MembershipRole)
});

export type UpdateMembershipRoleInput = z.infer<typeof updateMembershipRoleSchema>;
