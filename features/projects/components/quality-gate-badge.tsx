import { gateLabel, type QualityGate } from "@/domain";
import { Badge } from "@/components/ui/badge";

/** Renders a quality-gate verdict from the Stage Contract as a coloured badge. */
export function QualityGateBadge({ gate }: { gate: QualityGate }) {
  return <Badge variant={gate}>{gateLabel(gate)}</Badge>;
}
