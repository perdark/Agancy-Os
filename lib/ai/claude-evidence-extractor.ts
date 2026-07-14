import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import {
  FACT_CATEGORIES,
  type EvidenceExtractionRequest,
  type EvidenceExtractor,
  type EvidenceExtractorResult,
} from "@/domain";
import { evidenceExtractionPrompt } from "@/prompts";
import { hashPrompt } from "./prompt-hash";

/**
 * The extraction model. Pinned separately from the generators so the reader
 * of evidence can be moved independently of what writes the kit.
 */
const EXTRACTOR_MODEL = "claude-sonnet-5";

export class EvidenceExtractionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EvidenceExtractionError";
  }
}

const extractionSchema = z.object({
  facts: z.array(
    z.object({
      category: z.enum(FACT_CATEGORIES),
      statement: z.string(),
      provenance: z.enum(["verified", "hypothesis"]),
      citations: z.array(
        z.object({
          /** 1-based document number, exactly as attached and listed. */
          document: z.number().int().min(1),
          detail: z.string(),
        }),
      ),
      basis: z.string().optional(),
    }),
  ),
});

/** Evidence the vision path can actually read. */
const READABLE_MIME = (mimeType: string): boolean =>
  mimeType.startsWith("image/") || mimeType === "application/pdf";

/**
 * ClaudeEvidenceExtractor — the API (vision) transport of the extraction
 * port. Attaches the actual evidence bytes (images as image parts, PDFs as
 * file parts) after the versioned prompt and maps document-number citations
 * back to document indices; the domain sanitizer does the rest.
 */
export class ClaudeEvidenceExtractor implements EvidenceExtractor {
  async extract(
    request: EvidenceExtractionRequest,
  ): Promise<EvidenceExtractorResult | null> {
    const readable = request.documents.filter((doc) =>
      READABLE_MIME(doc.mimeType),
    );
    if (readable.length === 0) return null;

    const rendered = evidenceExtractionPrompt.render({
      brief: request.brief,
      documents: readable.map((doc) => ({
        label: doc.label,
        mimeType: doc.mimeType,
      })),
    });

    try {
      const { object, response } = await generateObject({
        model: anthropic(EXTRACTOR_MODEL),
        schema: extractionSchema,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: rendered },
              ...readable.map((doc) =>
                doc.mimeType === "application/pdf"
                  ? {
                      type: "file" as const,
                      data: doc.bytes,
                      mediaType: doc.mimeType,
                    }
                  : {
                      type: "image" as const,
                      image: doc.bytes,
                      mediaType: doc.mimeType,
                    },
              ),
            ],
          },
        ],
      });

      return {
        facts: object.facts.map((fact) => ({
          category: fact.category,
          statement: fact.statement,
          provenance: fact.provenance,
          basis: fact.basis,
          // The prompt numbers documents 1..N in attachment order, and
          // `readable` IS that order — but the caller cites into the
          // original documents array, so map through the readable list.
          citations: fact.citations.flatMap((citation) => {
            const document = readable[citation.document - 1];
            return document
              ? [
                  {
                    documentIndex: request.documents.indexOf(document),
                    detail: citation.detail,
                  },
                ]
              : [];
          }),
        })),
        model: response?.modelId ?? EXTRACTOR_MODEL,
        promptId: evidenceExtractionPrompt.id,
        promptVersion: evidenceExtractionPrompt.version,
        promptHash: hashPrompt(rendered),
      };
    } catch (cause) {
      throw new EvidenceExtractionError(
        "The AI could not read the evidence. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }
  }
}

/**
 * NullEvidenceExtractor — bound when the active backend has no vision path
 * (the local CLI one-shot and the placeholder). Returning null keeps the
 * extraction honest: only the operator's brief facts get recorded, and the
 * stored extraction says the evidence was not machine-read.
 */
export class NullEvidenceExtractor implements EvidenceExtractor {
  async extract(): Promise<EvidenceExtractorResult | null> {
    return null;
  }
}
