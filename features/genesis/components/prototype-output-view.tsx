import {
  buildClaudeDesignPackage,
  type PrototypeOutput,
} from "@/domain";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

/**
 * Renders the Prototype deliverables — the first-meeting kit. The centrepiece
 * is the paste-ready Claude Design prompt; everything above it is the
 * strategist's invisible work (assumptions, positioning, world facts) made
 * visible so the operator can correct it at the meeting.
 */
export function PrototypeOutputView({ output }: { output: PrototypeOutput }) {
  const { brandAssumptions, positioning, prototypeDirection, designPrompt } =
    output;
  const completePackage = buildClaudeDesignPackage(designPrompt);

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Claude Design package</CardTitle>
            <CopyButton
              text={completePackage}
              label="Copy complete package"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
            {completePackage}
          </pre>
        </CardContent>
      </Card>
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
