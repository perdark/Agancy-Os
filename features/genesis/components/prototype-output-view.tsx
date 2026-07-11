import { type PrototypeOutput } from "@/domain";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Renders the Prototype deliverables — the strategist's invisible work
 * (assumptions, positioning, world facts) made visible so the operator can
 * correct it at the meeting. The paste-ready package itself is NOT repeated
 * here: the handoff card at the top of the project screen is the one
 * dominant copy action (guide Step 5), and candidate cards keep per-version
 * copies.
 */
export function PrototypeOutputView({ output }: { output: PrototypeOutput }) {
  const { brandAssumptions, positioning, prototypeDirection } = output;

  return (
    <div className="grid gap-4">
      <Block title="Brand assumptions">
        <Item
          label="Personality"
          value={brandAssumptions.personality.join(" · ") || "—"}
        />
        <Item
          label="Values"
          value={brandAssumptions.values.join(" · ") || "—"}
        />
        <Item label="Tone of voice" value={brandAssumptions.toneOfVoice} />
        <Item
          label="Visual direction"
          value={brandAssumptions.visualDirection}
        />
      </Block>

      <Block title="Positioning">
        <p className="font-medium">{positioning.statement}</p>
        <Item label="Target segment" value={positioning.targetSegment} />
        <Item
          label="Differentiators"
          value={positioning.differentiators.join(" · ") || "—"}
        />
        <Item
          label="Competitive context"
          value={positioning.competitiveContext}
        />
      </Block>

      <Block title="Prototype direction">
        <p>{prototypeDirection.concept}</p>
        <List label="Key screens" items={prototypeDirection.keyScreens} />
        <List
          label="Experience principles"
          items={prototypeDirection.experiencePrinciples}
        />
        <List
          label="World facts — every screen must surface one"
          items={prototypeDirection.worldFacts}
        />
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

function Item({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}:</span> {value}
    </p>
  );
}

function List({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="mt-1 list-disc space-y-1 ps-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
