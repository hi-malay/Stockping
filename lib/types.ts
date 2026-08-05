export const PLATFORMS = ["blinkit", "zepto", "instamart"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  blinkit: "Blinkit",
  zepto: "Zepto",
  instamart: "Instamart",
};

export type Status = "in_stock" | "out_of_stock" | "error";

export type PlatformResult = {
  status: Status;
  price?: string;
  title?: string;
  url?: string;
  error?: string;
};

export type StoredResult = PlatformResult & {
  checkedAt: string;
  notifiedAt?: string;
};

export type Watch = {
  id: string;
  label: string;
  chatId: string;
  pincode: string;
  query?: string;
  urls?: Partial<Record<Platform, string>>;
  platforms: Platform[];
  createdAt: string;
  results: Partial<Record<Platform, StoredResult>>;
};

export type CheckInput = {
  pincode: string;
  url?: string;
  query?: string;
};
