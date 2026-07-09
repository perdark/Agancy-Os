import type { DiscoveryOutput, SignalConfidence } from "@/domain";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Renders the Discovery deliverables — the decoded brief. This is the
 * stage-specific `output` renderer that complements the uniform Stage Contract
 * view. Its centrepiece is the decoded-signals table: vague client words →
 * likely meaning → confidence.
 */
export function GenesisOutputView({ output }: { output: DiscoveryOutput }) {
  return (
    <div className="grid gap-4">
      <Block title="Interpreted brief">
        <p>{output.interpretedBrief}</p>
      </Block>

      <Block title="Decoded signals">
        {output.decodedSignals.length === 0 ? (
          <p className="text-muted-foreground">No signals decoded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 pe-4 font-medium">Client said</th>
                  <th className="py-1 pe-4 font-medium">Likely means</th>
                  <th className="py-1 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {output.decodedSignals.map((signal, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="py-2 pe-4 font-medium">
                      “{signal.clientSaid}”
                    </td>
                    <td className="py-2 pe-4 text-muted-foreground">
                      {signal.likelyMeans}
                    </td>
                    <td className="py-2">
                      <Confidence level={signal.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block title="Questions to ask the client">
        {output.openQuestions.length === 0 ? (
          <p className="text-muted-foreground">No open questions.</p>
        ) : (
          <ul className="space-y-2">
            {output.openQuestions.map((q, i) => (
              <li key={i}>
                <p className="font-medium">{q.question}</p>
                <p className="text-muted-foreground">{q.whyItMatters}</p>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Assumptions">
        {output.assumptions.length === 0 ? (
          <p className="text-muted-foreground">None stated.</p>
        ) : (
          <ul className="list-disc space-y-1 ps-5">
            {output.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

function Confidence({ level }: { level: SignalConfidence }) {
  const label = { low: "Low", medium: "Medium", high: "High" }[level];
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      {label}
    </span>
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
