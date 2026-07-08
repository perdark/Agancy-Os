import type { GenesisOutput } from "@/domain";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Renders the five Genesis deliverables. This is the stage-specific `output`
 * renderer that complements the uniform Stage Contract view. In Version 1 the
 * content is placeholder text produced by the placeholder generator.
 */
export function GenesisOutputView({ output }: { output: GenesisOutput }) {
  return (
    <div className="grid gap-4">
      <Block title="Brand assumptions">
        <p>{output.brandAssumptions.toneOfVoice}</p>
        <p className="text-muted-foreground">
          {output.brandAssumptions.visualDirection}
        </p>
        <TagList items={output.brandAssumptions.values} />
      </Block>

      <Block title="Positioning">
        <p>{output.positioning.statement}</p>
        <p className="text-muted-foreground">
          Target: {output.positioning.targetSegment}
        </p>
        <p className="text-muted-foreground">
          {output.positioning.competitiveContext}
        </p>
        <TagList items={output.positioning.differentiators} />
      </Block>

      <Block title="Strategic brief">
        <p>{output.strategicBrief.summary}</p>
        <TagList items={output.strategicBrief.objectives} />
      </Block>

      <Block title="Prototype direction">
        <p>{output.prototypeDirection.concept}</p>
        <TagList items={output.prototypeDirection.keyScreens} />
      </Block>

      <Block title="Claude design prompt">
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
          {output.designPrompt.prompt}
        </pre>
        <TagList items={output.designPrompt.constraints} />
      </Block>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
    </Card>
  );
}

function TagList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 pt-1">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
