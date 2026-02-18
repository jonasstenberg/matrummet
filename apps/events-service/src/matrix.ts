import type { MatrixConfig } from "./types.js";

export const sendMatrixMessage = async (
  config: MatrixConfig,
  message: string
): Promise<void> => {
  const txnId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = `${config.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(config.roomId)}/send/m.room.message/${txnId}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify({
      msgtype: "m.text",
      body: message,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Matrix API error ${response.status}: ${body}`);
  }
};

export const isMatrixConfigured = (config: MatrixConfig): boolean =>
  Boolean(config.homeserverUrl && config.accessToken && config.roomId);
