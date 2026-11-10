'use client';

import { useState } from 'react';
import {
  newApprovalStep,
  type ApprovalStepInput,
  type WorkflowDetail,
  type WorkflowFormOptions,
} from '@dms/contracts/workflows';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import { Form } from '@dms/ui/form';
import { WorkflowEditor } from '@/features/workflows/components/workflow-editor';
import { WorkflowPreviewPanel } from '@/features/workflows/components/workflow-preview';
import { WorkflowSourceNote } from '@/features/workflows/components/workflow-source-note';
import { WorkflowStepsReadOnly } from '@/features/workflows/components/workflow-steps-read-only';
import { inheritWorkflowAction } from '@/server/actions/workflows';

const SECONDARY_BUTTON_CLASS =
  'h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft';

type OwnEditorProps = {
  detail: WorkflowDetail;
  version: number;
  initialSteps: ApprovalStepInput[];
  options: WorkflowFormOptions;
};

function OwnWorkflowEditor({ detail, version, initialSteps, options }: OwnEditorProps) {
  const [isConfirming, setConfirming] = useState(false);

  return (
    <WorkflowEditor.Root
      orgUnitId={detail.unit.id}
      expectedVersion={version}
      initialSteps={initialSteps}
      options={options}
    >
      <WorkflowEditor.Form>
        <WorkflowEditor.Steps />
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Lưu thành phiên bản mới</Form.Submit>
          {detail.unit.isRoot ? null : (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setConfirming(true)}
            >
              Chuyển về kế thừa
            </button>
          )}
        </Form.Actions>
        <p className="mt-2 text-sm text-text-muted">
          Đơn đang chạy giữ phiên bản cũ, đơn gửi duyệt sau khi lưu dùng phiên bản mới.
        </p>
      </WorkflowEditor.Form>
      <WorkflowEditor.Preview />
      {isConfirming ? (
        <ConfirmDialog
          title="Chuyển về kế thừa"
          confirmLabel="Chuyển về kế thừa"
          tone="primary"
          successMessage="Đơn vị đã chuyển về kế thừa"
          onConfirm={() =>
            inheritWorkflowAction({ orgUnitId: detail.unit.id, expectedVersion: version })
          }
          onClose={() => setConfirming(false)}
        >
          <b>{detail.unit.name}</b> sẽ dùng quy trình của đơn vị cấp trên. Các phiên bản riêng vẫn
          được giữ trong lịch sử.
        </ConfirmDialog>
      ) : null}
    </WorkflowEditor.Root>
  );
}

type CreatingEditorProps = {
  detail: WorkflowDetail;
  initialSteps: ApprovalStepInput[];
  options: WorkflowFormOptions;
  onCancel: () => void;
};

function NewWorkflowEditor({ detail, initialSteps, options, onCancel }: CreatingEditorProps) {
  return (
    <WorkflowEditor.Root
      orgUnitId={detail.unit.id}
      expectedVersion={null}
      initialSteps={initialSteps}
      options={options}
    >
      <WorkflowEditor.Form>
        <WorkflowEditor.Steps />
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Lưu quy trình riêng</Form.Submit>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onCancel}>
            Huỷ
          </button>
        </Form.Actions>
      </WorkflowEditor.Form>
      <WorkflowEditor.Preview />
    </WorkflowEditor.Root>
  );
}

type WorkflowManagerProps = { detail: WorkflowDetail; options: WorkflowFormOptions };

export function WorkflowManager({ detail, options }: WorkflowManagerProps) {
  const [isCreating, setCreating] = useState(false);
  const inheritedSteps = detail.inherited?.steps ?? [];

  if (detail.own) {
    return (
      <>
        <WorkflowSourceNote own={detail.own} inherited={null} />
        <div className="mt-3">
          <OwnWorkflowEditor
            detail={detail}
            version={detail.own.version}
            initialSteps={detail.own.steps.map((step) => step.input)}
            options={options}
          />
        </div>
      </>
    );
  }

  if (isCreating) {
    return (
      <NewWorkflowEditor
        detail={detail}
        initialSteps={
          inheritedSteps.length > 0 ? inheritedSteps.map((step) => step.input) : [newApprovalStep()]
        }
        options={options}
        onCancel={() => setCreating(false)}
      />
    );
  }

  return (
    <>
      <WorkflowSourceNote own={null} inherited={detail.inherited} />
      {inheritedSteps.length > 0 ? (
        <div className="mt-3">
          <WorkflowStepsReadOnly steps={inheritedSteps} />
        </div>
      ) : null}
      <button
        type="button"
        className="mt-3 h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
        onClick={() => setCreating(true)}
      >
        Tạo quy trình riêng
      </button>
      <WorkflowPreviewPanel options={options} defaultOrgUnitId={detail.unit.id} />
    </>
  );
}
