export interface ApiErrorDetail {
  prisma?: {
    code: string;
    model?: string;
    target?: string[];
  };
  /** Set when `code === "system_shelf_missing"`. */
  kindKey?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly detail?: ApiErrorDetail,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
