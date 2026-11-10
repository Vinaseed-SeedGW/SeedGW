import { stepDetailLines, type StepView } from '@dms/contracts/workflows';

export function WorkflowStepsReadOnly({ steps }: { steps: readonly StepView[] }) {
  return (
    <ol className="grid gap-2.5">
      {steps.map((step, index) => (
        <li key={index} className="rounded-md border border-border bg-surface p-3">
          <p className="font-bold">
            Bước {index + 1}: {step.input.name}
          </p>
          <ul className="mt-1 text-sm text-text-muted">
            {stepDetailLines(step).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
