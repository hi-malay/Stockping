export const PLATFORMS = ["blinkit", "zepto", "instamart"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  blinkit: "Blinkit",
  zepto: "Zepto",
  instamart: "Instamart",
};

// A watch is one product URL. The platform comes from the link, so there is nothing
// to pick and nothing to keep in sync.
export function platformFromUrl(url: string): Platform | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (host.endsWith("blinkit.com")) return "blinkit";
  if (host.endsWith("zepto.com") || host.endsWith("zeptonow.com")) return "zepto";
  if (host.endsWith("instamart.in") || host.endsWith("swiggy.com")) return "instamart";
  return null;
}

export type Status = "in_stock" | "out_of_stock" | "error";

export type PlatformResult = {
  status: Status;
  price?: string;
  title?: string;
  error?: string;
};

export type StoredResult = PlatformResult & {
  checkedAt: string;
  notifiedAt?: string;
};

export type Watch = {
  id: string;
  url: string;
  platform: Platform;
  pincode: string;
  chatId: string;
  createdAt: string;
  result?: StoredResult;
};

export type CheckInput = { url: string; pincode: string };
