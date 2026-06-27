// Minimal ambient declaration for Bun's built-in SQLite driver.
// We declare only the surface this service uses rather than pulling in the full
// `bun-types` package, which would clash with @types/node globals in this
// mixed Node/Bun monorepo.
declare module "bun:sqlite" {
  export interface Statement<Row = unknown> {
    get(...params: unknown[]): Row | null;
    all(...params: unknown[]): Row[];
    run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
  }

  export interface DatabaseOptions {
    create?: boolean;
    readonly?: boolean;
    readwrite?: boolean;
  }

  export class Database {
    constructor(filename?: string, options?: DatabaseOptions);
    query<Row = unknown>(sql: string): Statement<Row>;
    prepare<Row = unknown>(sql: string): Statement<Row>;
    exec(sql: string): void;
    run(sql: string, ...params: unknown[]): void;
    close(): void;
  }
}
