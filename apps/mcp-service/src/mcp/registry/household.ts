import { z } from "zod";

import { rpcTool, type ToolDef } from "../tool.js";

export const householdTools: ToolDef[] = [
  rpcTool({
    name: "get_user_homes",
    title: "List households",
    description: "List households you belong to.",
    rpc: "get_user_homes",
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "create_home",
    title: "Create household",
    description: "Create a household. Returns the household id.",
    rpc: "create_home",
    inputSchema: { name: z.string().describe("Household name") },
  }),
  rpcTool({
    name: "get_home_info",
    title: "Get household info",
    description: "Household details + member list. Omit home_id for your current household.",
    rpc: "get_home_info",
    annotations: { readOnlyHint: true },
    inputSchema: {
      // Body param p_home_id (null = current home).
      home_id: z.string().optional().describe("Household id; omit for current"),
    },
  }),
  rpcTool({
    name: "update_home_name",
    title: "Rename household",
    description: "Rename your active household.",
    rpc: "update_home_name",
    household: true,
    inputSchema: { name: z.string().describe("New household name") },
  }),
  rpcTool({
    name: "invite_to_home",
    title: "Invite to household",
    description: "Invite someone to your household by email. Returns the invitation id.",
    rpc: "invite_to_home",
    household: true,
    inputSchema: { email: z.string().describe("Invitee email") },
  }),
  rpcTool({
    name: "generate_join_code",
    title: "Generate join code",
    description: "Generate a join code for your household.",
    rpc: "generate_join_code",
    household: true,
    inputSchema: {
      expires_hours: z.number().int().optional().describe("Hours until expiry"),
    },
  }),
  rpcTool({
    name: "join_home_by_code",
    title: "Join household by code",
    description: "Join a household using a join code.",
    rpc: "join_home_by_code",
    inputSchema: { code: z.string().describe("Join code") },
  }),
  rpcTool({
    name: "leave_home",
    title: "Leave household",
    description: "Leave your active household.",
    rpc: "leave_home",
    household: true,
    annotations: { destructiveHint: true },
  }),
  rpcTool({
    name: "remove_home_member",
    title: "Remove household member",
    description: "Remove a member from your household by email.",
    rpc: "remove_home_member",
    household: true,
    annotations: { destructiveHint: true },
    inputSchema: { member_email: z.string().describe("Member email to remove") },
  }),
  rpcTool({
    name: "get_pending_invitations",
    title: "Pending invitations",
    description: "List household invitations sent to you.",
    rpc: "get_pending_invitations",
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "accept_invitation",
    title: "Accept invitation",
    description: "Accept a household invitation by token. Returns the household id.",
    rpc: "accept_invitation",
    inputSchema: { token: z.string().describe("Invitation token") },
  }),
  rpcTool({
    name: "decline_invitation",
    title: "Decline invitation",
    description: "Decline a household invitation by token.",
    rpc: "decline_invitation",
    inputSchema: { token: z.string().describe("Invitation token") },
  }),
  rpcTool({
    name: "disable_join_code",
    title: "Disable join code",
    description: "Disable your household's current join code.",
    rpc: "disable_join_code",
    household: true,
  }),
];
