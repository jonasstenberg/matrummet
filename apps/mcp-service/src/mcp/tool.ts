import { z } from "zod";

import {
  callRpc,
  callRpcAnon,
  deleteFrom,
  queryView,
  uploadImage,
  type ToolContext,
} from "../api/postgrest.js";

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  annotations?: ToolAnnotations;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

/** Optional `home_id` arg → X-Active-Home-Id header for household-scoped tools. */
const homeIdArg = z
  .string()
  .optional()
  .describe("Active household id (X-Active-Home-Id). Omit to use your default home.");

const VIEW_DEFAULT_LIMIT = 25;

const limitArg = z
  .number()
  .int()
  .min(1)
  .max(1000)
  .optional()
  .describe("Max rows to return (default 25, hard cap 1000). Use offset to page.");

const offsetArg = z.number().int().min(0).optional().describe("Pagination offset.");

/**
 * Build an RPC-backed tool. Friendly arg names map 1:1 to PostgREST `p_<name>`
 * params. For household tools, a `home_id` arg is added and routed to the
 * X-Active-Home-Id header (PostgREST falls back to the default home if omitted).
 * Non-household tools that genuinely take a body `p_home_id` (create_shopping_list,
 * get_home_info) simply declare `home_id` in their own inputSchema instead.
 */
export function rpcTool(opts: {
  name: string;
  title: string;
  description: string;
  rpc: string;
  inputSchema?: z.ZodRawShape;
  household?: boolean;
  /** Call as anon (no x-api-key) — for publicly-granted preview RPCs. */
  anon?: boolean;
  annotations?: ToolAnnotations;
}): ToolDef {
  const base: z.ZodRawShape = {
    ...(opts.inputSchema ?? {}),
    ...(opts.household ? { home_id: homeIdArg } : {}),
  };
  return {
    name: opts.name,
    title: opts.title,
    description: opts.description,
    inputSchema: base,
    annotations: opts.annotations,
    handler: async (args, ctx) => {
      const { home_id: homeIdRaw, ...rest } = args;
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) body[`p_${key}`] = value;
      }
      if (opts.anon) {
        return callRpcAnon(opts.rpc, body);
      }
      let homeId: string | undefined;
      if (opts.household) {
        homeId = typeof homeIdRaw === "string" ? homeIdRaw : undefined;
      } else if (homeIdRaw !== undefined) {
        // Body-param case (create_shopping_list / get_home_info).
        body.p_home_id = homeIdRaw;
      }
      return callRpc(ctx, opts.rpc, body, { homeId });
    },
  };
}

/** Build a PostgREST view-read tool with limit/offset/order/select + caps. */
export function viewTool(opts: {
  name: string;
  title: string;
  description: string;
  view: string;
  household?: boolean;
  defaultOrder?: string;
  inputSchema?: z.ZodRawShape;
  buildFilters?: (args: Record<string, unknown>) => Record<string, string>;
  annotations?: ToolAnnotations;
}): ToolDef {
  const base: z.ZodRawShape = {
    limit: limitArg,
    offset: offsetArg,
    order: z.string().optional().describe("PostgREST order, e.g. date_modified.desc"),
    select: z.string().optional().describe("PostgREST select list, e.g. id,name,categories"),
    ...(opts.inputSchema ?? {}),
    ...(opts.household ? { home_id: homeIdArg } : {}),
  };
  return {
    name: opts.name,
    title: opts.title,
    description: opts.description,
    inputSchema: base,
    annotations: { readOnlyHint: true, ...opts.annotations },
    handler: async (args, ctx) => {
      const params = new URLSearchParams();
      const limit =
        typeof args.limit === "number" ? Math.min(args.limit, 1000) : VIEW_DEFAULT_LIMIT;
      params.set("limit", String(limit));
      if (typeof args.offset === "number") params.set("offset", String(args.offset));
      const order = typeof args.order === "string" ? args.order : opts.defaultOrder;
      if (order) params.set("order", order);
      if (typeof args.select === "string") params.set("select", args.select);
      if (opts.buildFilters) {
        for (const [key, value] of Object.entries(opts.buildFilters(args))) {
          params.set(key, value);
        }
      }
      const homeId = opts.household && typeof args.home_id === "string" ? args.home_id : undefined;
      return queryView(ctx, opts.view, params, { homeId });
    },
  };
}

/** Re-export low-level callers for the few bespoke tools (upload, delete). */
export { callRpc, deleteFrom, uploadImage };
export type { ToolContext };
