declare module "pg" {
  export class Client {
    constructor(options: { connectionString: string });
    connect(): Promise<void>;
    end(): Promise<void>;
    query<T = unknown>(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number | null }>;
  }
}
