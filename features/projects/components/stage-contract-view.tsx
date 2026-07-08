import { STAGE_LABELS, type StageResult } from "@/domain";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QualityGateBadge } from "./quality-gate-badge";

/**
 * Renders the uniform Stage Contract for ANY stage. Because every stage returns
 * the same shape, this one component works for Discovery, Brand, … Development
 * without change. The stage-specific `output` is rendered separately by callers.
 */
export function StageContractView({ result }: { result: StageResult }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {STAGE_LABELS[result.stage]} — Stage Contract
        </CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Readiness {result.readiness}/100
          </span>
          <QualityGateBadge gate={result.qualityGate} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <Section title="Next step">
          <p className="font-medium">{result.nextStep.headline}</p>
          <p className="text-muted-foreground">{result.nextStep.detail}</p>
        </Section>

        {result.doubts.length > 0 && (
          <Section title="AI doubts">
            <ul className="space-y-1">
              {result.doubts.map((d) => (
                <li key={d.id} className="flex gap-2">
                  <span className="text-muted-foreground">[{d.severity}]</span>
                  <span>{d.concern}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {result.missingInformation.length > 0 && (
          <Section title="Missing information">
            <ul className="space-y-1">
              {result.missingInformation.map((m) => (
                <li key={m.id}>
                  <span className="font-medium">{m.label}</span> —{" "}
                  <span className="text-muted-foreground">{m.whyItMatters}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {result.recommendations.length > 0 && (
          <Section title="Recommendations">
            <ul className="space-y-1">
              {result.recommendations.map((r) => (
                <li key={r.id}>
                  <span className="text-muted-foreground">[{r.priority}]</span>{" "}
                  <span className="font-medium">{r.title}</span> — {r.detail}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {result.evidence.length > 0 && (
          <Section title="Evidence">
            <ul className="space-y-1">
              {result.evidence.map((e) => (
                <li key={e.id} className="text-muted-foreground">
                  {e.summary}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}
