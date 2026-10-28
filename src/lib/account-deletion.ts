import { z } from "zod";

export const accountDeletionSchema = z.object({ confirmation: z.literal("DELETE") });

type DeletionClient = {
  rpc: (name: "prepare_account_deletion", args: { _user_id: string }) => PromiseLike<{ error: unknown }>;
  auth: { admin: { deleteUser: (id: string) => PromiseLike<{ error: unknown }> } };
};

// The caller supplies the verified identity, never a client-selected target.
export async function deleteVerifiedAccount(client: DeletionClient, userId: string) {
  const prepared = await client.rpc("prepare_account_deletion", { _user_id: userId });
  if (prepared.error) throw new Error("Account deletion could not be completed. Please try again.");
  const deleted = await client.auth.admin.deleteUser(userId);
  if (deleted.error) throw new Error("Your sign-in account could not be deleted. Please try again.");
  return { ok: true as const };
}