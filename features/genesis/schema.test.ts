import { describe, expect, it } from "vitest";
import {
  GENESIS_INPUT_LIMITS,
  genesisInputSchema,
  genesisUploadBatchSchema,
} from "./schema";

const validInput = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "hospitality",
  country: "Iraq",
  audience: "students and college staff",
  priceLevel: "mid" as const,
  notes: "Near a college",
  assets: [
    {
      label: "Lotus logo",
      uri: "https://example.com/lotus-logo.png",
      mimeType: "image/png",
    },
  ],
};

describe("genesisInputSchema", () => {
  it("trims and NFC-normalizes every free-text field", () => {
    const parsed = genesisInputSchema.parse({
      ...validInput,
      businessName: "  Cafe\u0301  ",
      businessType: "  cafe  ",
      market: "  hospitality  ",
      country: "  Iraq  ",
      audience: "  students  ",
      notes: "  near a college  ",
      assets: [
        {
          label: "  Lotus logo  ",
          uri: "  https://example.com/lotus-logo.png  ",
          mimeType: "  image/png  ",
        },
        {
          label: "Menu",
          uri: "https://example.com/menu.png",
          mimeType: "   ",
        },
      ],
    });

    expect(parsed).toMatchObject({
      businessName: "Café",
      businessType: "cafe",
      market: "hospitality",
      country: "Iraq",
      audience: "students",
      notes: "near a college",
      assets: [
        {
          label: "Lotus logo",
          uri: "https://example.com/lotus-logo.png",
          mimeType: "image/png",
        },
        {
          label: "Menu",
          uri: "https://example.com/menu.png",
          mimeType: undefined,
        },
      ],
    });
  });

  it.each([
    "businessName",
    "businessType",
    "market",
    "country",
    "audience",
  ] as const)("rejects whitespace-only %s", (field) => {
    expect(
      genesisInputSchema.safeParse({ ...validInput, [field]: " \n\t " }).success,
    ).toBe(false);
  });

  it.each([
    ["businessName", GENESIS_INPUT_LIMITS.businessName],
    ["businessType", GENESIS_INPUT_LIMITS.businessType],
    ["market", GENESIS_INPUT_LIMITS.market],
    ["country", GENESIS_INPUT_LIMITS.country],
    ["audience", GENESIS_INPUT_LIMITS.audience],
    ["notes", GENESIS_INPUT_LIMITS.notes],
  ] as const)("bounds %s", (field, limit) => {
    expect(
      genesisInputSchema.safeParse({
        ...validInput,
        [field]: "x".repeat(limit + 1),
      }).success,
    ).toBe(false);
  });

  it("bounds asset count and every asset string", () => {
    const asset = validInput.assets[0];

    expect(
      genesisInputSchema.safeParse({
        ...validInput,
        assets: Array.from(
          { length: GENESIS_INPUT_LIMITS.assets + 1 },
          () => asset,
        ),
      }).success,
    ).toBe(false);
    expect(
      genesisInputSchema.safeParse({
        ...validInput,
        assets: [
          { ...asset, label: "x".repeat(GENESIS_INPUT_LIMITS.assetLabel + 1) },
        ],
      }).success,
    ).toBe(false);
    expect(
      genesisInputSchema.safeParse({
        ...validInput,
        assets: [
          {
            ...asset,
            uri: `https://example.com/${"x".repeat(GENESIS_INPUT_LIMITS.assetUri)}`,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      genesisInputSchema.safeParse({
        ...validInput,
        assets: [
          {
            ...asset,
            mimeType: "x".repeat(GENESIS_INPUT_LIMITS.assetMimeType + 1),
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects blank asset labels and malformed asset URLs", () => {
    const asset = validInput.assets[0];
    expect(
      genesisInputSchema.safeParse({
        ...validInput,
        assets: [{ ...asset, label: "   " }],
      }).success,
    ).toBe(false);
    expect(
      genesisInputSchema.safeParse({
        ...validInput,
        assets: [{ ...asset, uri: "not a URL" }],
      }).success,
    ).toBe(false);
    expect(
      genesisInputSchema.safeParse({
        ...validInput,
        assets: [{ ...asset, uri: "file:///tmp/private-logo.png" }],
      }).success,
    ).toBe(false);
  });

  it("bounds individual uploads, batch count, and total bytes", () => {
    const file = {
      name: "lotus-logo.png",
      mimeType: "image/png",
      sizeBytes: 1024,
    };

    expect(genesisUploadBatchSchema.safeParse([file]).success).toBe(true);
    expect(
      genesisUploadBatchSchema.safeParse([
        { ...file, sizeBytes: GENESIS_INPUT_LIMITS.assetFileBytes + 1 },
      ]).success,
    ).toBe(false);
    expect(
      genesisUploadBatchSchema.safeParse(
        Array.from({ length: GENESIS_INPUT_LIMITS.assets + 1 }, () => file),
      ).success,
    ).toBe(false);
    expect(
      genesisUploadBatchSchema.safeParse(
        Array.from({ length: 6 }, () => ({
          ...file,
          sizeBytes: GENESIS_INPUT_LIMITS.assetFileBytes,
        })),
      ).success,
    ).toBe(false);
  });
});
