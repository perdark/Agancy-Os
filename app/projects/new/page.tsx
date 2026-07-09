import { GenesisForm } from "@/features/genesis/components/genesis-form";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Project Genesis
        </h1>
        <p className="text-muted-foreground">
          Capture the brief. Discovery decodes it — the client&rsquo;s vague
          words into likely meaning, the questions to ask them, and the
          assumptions to check — wrapped in the Stage Contract.
        </p>
      </div>
      <GenesisForm />
    </div>
  );
}
