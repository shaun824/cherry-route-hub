import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { accountDeletionSchema, deleteVerifiedAccount } from "./account-deletion";

describe("self-account deletion", () => {
  it("requires the exact DELETE confirmation", () => {
    assert.equal(accountDeletionSchema.safeParse({ confirmation: "DELETE" }).success, true);
    for (const confirmation of ["", "delete", "DELETE "]) {
      assert.equal(accountDeletionSchema.safeParse({ confirmation }).success, false);
    }
  });
  it("targets only the verified user and cleans personal data before deleting auth", async () => {
    const calls: unknown[] = [];
    const client = {
      rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { error: null }; },
      auth: { admin: { deleteUser: async (id: string) => { calls.push(["auth", id]); return { error: null }; } } },
    };
    assert.deepEqual(await deleteVerifiedAccount(client, "verified-rider"), { ok: true });
    assert.deepEqual(calls, [["prepare_account_deletion", { _user_id: "verified-rider" }], ["auth", "verified-rider"]]);
  });
  it("does not delete auth when cleanup fails", async () => {
    let deleted = false;
    const client = {
      rpc: async () => ({ error: new Error("database failure") }),
      auth: { admin: { deleteUser: async () => { deleted = true; return { error: null }; } } },
    };
    await assert.rejects(deleteVerifiedAccount(client, "verified-rider"));
    assert.equal(deleted, false);
  });
  it("does not report success when auth deletion fails", async () => {
    const client = {
      rpc: async () => ({ error: null }),
      auth: { admin: { deleteUser: async () => ({ error: new Error("auth failure") }) } },
    };
    await assert.rejects(deleteVerifiedAccount(client, "verified-rider"));
  });
});