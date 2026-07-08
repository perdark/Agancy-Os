import type { IdGenerator } from "@/domain";

/**
 * Infrastructure adapter: identity generation backed by the Web Crypto API.
 * The domain depends only on the {@link IdGenerator} port; this is where the
 * concrete source of ids lives.
 */
export const cryptoIdGenerator: IdGenerator = {
  next: () => crypto.randomUUID(),
};
