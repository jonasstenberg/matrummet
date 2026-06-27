import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Capture PostgREST calls without loading the real module (which pulls bun:sqlite).
const h = vi.hoisted(() => {
  const rpcCalls: { fn: string; body: Record<string, unknown>; homeId?: string }[] = [];
  const viewCalls: { view: string; params: string; homeId?: string }[] = [];
  return { rpcCalls, viewCalls };
});

vi.mock("../api/postgrest.js", () => ({
  callRpc: (
    _ctx: unknown,
    fn: string,
    body: Record<string, unknown>,
    opts?: { homeId?: string },
  ) => {
    h.rpcCalls.push({ fn, body, homeId: opts?.homeId });
    return Promise.resolve({ ok: true });
  },
  callRpcAnon: (fn: string, body: Record<string, unknown>) => {
    h.rpcCalls.push({ fn, body });
    return Promise.resolve({ anon: true });
  },
  queryView: (
    _ctx: unknown,
    view: string,
    params: URLSearchParams,
    opts?: { homeId?: string },
  ) => {
    h.viewCalls.push({ view, params: params.toString(), homeId: opts?.homeId });
    return Promise.resolve([]);
  },
  deleteFrom: () => Promise.resolve({}),
  uploadImage: () => Promise.resolve({ filename: "x" }),
}));

const { rpcTool, viewTool } = await import("./tool.js");

const ctx = { email: "u@example.com", role: "user" };

beforeEach(() => {
  h.rpcCalls.length = 0;
  h.viewCalls.length = 0;
});

describe("rpcTool argument mapping", () => {
  it("prefixes args with p_ and drops undefined", async () => {
    const tool = rpcTool({
      name: "insert_recipe",
      title: "x",
      description: "d",
      rpc: "insert_recipe",
      inputSchema: { name: z.string(), cuisine: z.string().optional() },
    });
    await tool.handler({ name: "Pasta", cuisine: undefined }, ctx);
    expect(h.rpcCalls[0]).toEqual({ fn: "insert_recipe", body: { p_name: "Pasta" }, homeId: undefined });
  });

  it("routes home_id to the X-Active-Home-Id header for household tools", async () => {
    const tool = rpcTool({
      name: "add_to_pantry",
      title: "x",
      description: "d",
      rpc: "add_to_pantry",
      household: true,
      inputSchema: { food_id: z.string() },
    });
    await tool.handler({ food_id: "f1", home_id: "home-1" }, ctx);
    expect(h.rpcCalls[0]).toEqual({ fn: "add_to_pantry", body: { p_food_id: "f1" }, homeId: "home-1" });
  });

  it("maps home_id to a body p_home_id for non-household tools", async () => {
    const tool = rpcTool({
      name: "create_shopping_list",
      title: "x",
      description: "d",
      rpc: "create_shopping_list",
      inputSchema: { name: z.string(), home_id: z.string().optional() },
    });
    await tool.handler({ name: "List", home_id: "home-9" }, ctx);
    expect(h.rpcCalls[0].body).toEqual({ p_name: "List", p_home_id: "home-9" });
    expect(h.rpcCalls[0].homeId).toBeUndefined();
  });

  it("uses the anon caller when anon:true", async () => {
    const tool = rpcTool({
      name: "get_shared_recipe",
      title: "x",
      description: "d",
      rpc: "get_shared_recipe",
      anon: true,
      inputSchema: { token: z.string() },
    });
    await tool.handler({ token: "tok" }, ctx);
    expect(h.rpcCalls[0]).toEqual({ fn: "get_shared_recipe", body: { p_token: "tok" } });
  });
});

describe("viewTool", () => {
  it("caps limit at 1000 and applies default order + filters", async () => {
    const tool = viewTool({
      name: "list_user_recipes",
      title: "x",
      description: "d",
      view: "user_recipes",
      defaultOrder: "date_modified.desc",
      inputSchema: { name_contains: z.string().optional() },
      buildFilters: (args): Record<string, string> => {
        const term = typeof args.name_contains === "string" ? args.name_contains : "";
        return term ? { name: `ilike.*${term}*` } : {};
      },
    });
    await tool.handler({ limit: 5000, name_contains: "pasta" }, ctx);
    const params = new URLSearchParams(h.viewCalls[0].params);
    expect(params.get("limit")).toBe("1000");
    expect(params.get("order")).toBe("date_modified.desc");
    expect(params.get("name")).toBe("ilike.*pasta*");
  });
});
