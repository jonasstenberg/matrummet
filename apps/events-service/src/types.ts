export interface QueryResult<T> {
  rows: T[];
}

export interface DbPool {
  query: <T>(text: string, values?: unknown[]) => Promise<QueryResult<T>>;
}

export type EventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string | null;
  created_at: string;
  processed_at: string | null;
};

export type MatrixConfig = {
  homeserverUrl: string;
  accessToken: string;
  roomId: string;
};
