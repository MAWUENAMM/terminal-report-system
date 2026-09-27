import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Execute the deployed handler with controlled Auth/database adapters. These tests
// verify access gates before any service-role mutation, without real credentials.
const source = readFileSync(
  new URL("../supabase/functions/school-admin/index.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(
  source.replace(/^import .*createClient.*;\n/m, ""),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  },
).outputText;
function fixture(
  options: {
    active?: boolean;
    deleted?: boolean;
    operator?: boolean;
    invalidToken?: boolean;
    rpcError?: boolean;
    profileActive?: boolean;
    mustChange?: boolean;
  } = {},
) {
  let handler!: (request: Request) => Promise<Response>;
  const mutations: string[] = [];
  const rpcCalls: {
    name: string;
    args: Record<string, unknown>;
    authorization: string;
  }[] = [];
  const profile = {
    id: "profile",
    auth_user_id: "user",
    school_id: "school",
    full_name: "Test",
    role: "ADMIN",
    active: options.profileActive !== false,
    must_change_password: !!options.mustChange,
  };
  const service = {
    auth: {
      getUser: async () =>
        options.invalidToken
          ? { data: {}, error: { message: "Invalid token" } }
          : { data: { user: { id: "user" } }, error: null },
      admin: {
        createUser: async () => {
          mutations.push("createUser");
          return { data: { user: { id: "new-user" } }, error: null };
        },
        deleteUser: async () => {
          mutations.push("deleteUser");
          return { error: null };
        },
      },
    },
    from(table: string) {
      const data =
        table === "school_users"
          ? profile
          : table === "platform_operators"
            ? options.operator
              ? { auth_user_id: "user" }
              : null
            : table === "schools"
              ? {
                  active: options.active !== false,
                  deleted_at: options.deleted ? "2026-09-27" : null,
                }
              : undefined;
      assert.notEqual(data, undefined, `Unexpected table access: ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data, error: null }),
        maybeSingle: async () => ({ data, error: null }),
      };
      return query;
    },
  };
  const createClient = (
    _url: string,
    key: string,
    config: { global?: { headers: { Authorization: string } } },
  ) => {
    if (key === "server-key") return service;
    assert.equal(key, "public-key");
    return {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({
          name,
          args,
          authorization: config.global!.headers.Authorization,
        });
        return options.rpcError
          ? { data: null, error: { message: "Provisioning rejected" } }
          : { data: "created-school", error: null };
      },
    };
  };
  const Deno = {
    env: {
      get: (name: string) =>
        ({
          SUPABASE_URL: "https://example.invalid",
          SUPABASE_SERVICE_ROLE_KEY: "server-key",
          SUPABASE_ANON_KEY: "public-key",
        })[name],
    },
    serve: (fn: typeof handler) => {
      handler = fn;
    },
  };
  new Function("Deno", "createClient", compiled)(Deno, createClient);
  async function call(action: string, body = {}, authenticated = true) {
    return handler(
      new Request("https://example.invalid/school-admin", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authenticated ? { Authorization: "Bearer fixture-token" } : {}),
        },
        body: JSON.stringify({ action, ...body }),
      }),
    );
  }
  return { call, mutations, rpcCalls };
}

test("school management rejects missing, invalid and inactive identities", async () => {
  assert.equal((await fixture().call("create_school", {}, false)).status, 401);
  assert.equal(
    (await fixture({ invalidToken: true }).call("create_school")).status,
    401,
  );
  assert.equal(
    (
      await fixture({ operator: true, profileActive: false }).call(
        "create_school",
      )
    ).status,
    403,
  );
  assert.equal(
    (await fixture({ operator: true, mustChange: true }).call("create_school"))
      .status,
    403,
  );
});
test("school administrators cannot create platform workspaces", async () => {
  const f = fixture();
  assert.equal((await f.call("create_school")).status, 403);
  assert.deepEqual(f.mutations, []);
});
test("suspended and deleted schools cannot use service-role staff operations", async () => {
  for (const state of [
    { active: false },
    { deleted: true },
    { active: false, operator: true },
  ]) {
    for (const action of [
      "create_staff",
      "update_staff",
      "reset_staff_password",
    ]) {
      const f = fixture(state);
      assert.equal((await f.call(action)).status, 403);
      assert.deepEqual(f.mutations, []);
    }
  }
});
test("platform provisioning keeps operator JWT and works when their tenant is suspended", async () => {
  const f = fixture({ active: false, operator: true });
  const response = await f.call("create_school", {
    admin_email: "admin@example.invalid",
    admin_name: "School Admin",
    details: {
      name: "Test school",
      academic_year: "2026/2027",
      current_term: 1,
      active: false,
    },
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.schoolId, "created-school");
  assert.equal(result.email, "admin@example.invalid");
  assert.ok(result.temporaryPassword.length >= 20);
  assert.equal(f.rpcCalls[0].authorization, "Bearer fixture-token");
  assert.equal(f.rpcCalls[0].name, "platform_create_school");
  assert.equal(f.rpcCalls[0].args.identity_id, "new-user");
  assert.deepEqual(f.mutations, ["createUser"]);
});
test("failed provisioning removes the new Auth identity", async () => {
  const f = fixture({ operator: true, rpcError: true });
  const response = await f.call("create_school", {
    admin_email: "admin@example.invalid",
    admin_name: "School Admin",
    details: {},
  });
  assert.equal(response.status, 400);
  assert.deepEqual(f.mutations, ["createUser", "deleteUser"]);
  assert.equal((await response.json()).error, "Provisioning rejected");
});
