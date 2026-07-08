import { GenesisForm } from "@/features/genesis/components/genesis-form";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Project Genesis
        </h1>
        <p className="text-muted-foreground">
          Capture the brief. Genesis turns it into brand assumptions,
          positioning, a strategic brief, a prototype direction, and a design
          prompt — wrapped in the Stage Contract.
        </p>
      </div>
      <GenesisForm />
    </div>
  );
}
