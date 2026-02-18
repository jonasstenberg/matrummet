import { config } from "./config.js";
import { isMatrixConfigured, sendMatrixMessage } from "./matrix.js";
import type { EventRow } from "./types.js";

const notify = async (message: string): Promise<void> => {
  if (isMatrixConfigured(config.matrix)) {
    await sendMatrixMessage(config.matrix, message);
  }
};

const handleUserSignup = async (event: EventRow): Promise<void> => {
  const { name, email, provider } = event.payload as {
    name?: string;
    email?: string;
    provider?: string;
  };

  const via = provider ? ` (${provider})` : "";
  await notify(`New signup: ${name ?? "Unknown"} <${email ?? "?"}>${via}`);
};

const handleUserDeleted = async (event: EventRow): Promise<void> => {
  const { name, email } = event.payload as {
    name?: string;
    email?: string;
  };

  await notify(`Account deleted: ${name ?? "Unknown"} <${email ?? "?"}>`);
};

const handleCreditsPurchased = async (event: EventRow): Promise<void> => {
  const { user_email, amount, balance_after } = event.payload as {
    user_email?: string;
    amount?: number;
    balance_after?: number;
  };

  await notify(
    `Credits purchased: ${user_email ?? "?"} bought ${amount ?? "?"} credits (balance: ${balance_after ?? "?"})`
  );
};

const handlers = new Map<string, (event: EventRow) => Promise<void>>([
  ["user.signup", handleUserSignup],
  ["user.deleted", handleUserDeleted],
  ["credits.purchased", handleCreditsPurchased],
]);

export const dispatchEvent = async (event: EventRow): Promise<void> => {
  const handler = handlers.get(event.event_type);
  if (handler) {
    await handler(event);
  }
};
