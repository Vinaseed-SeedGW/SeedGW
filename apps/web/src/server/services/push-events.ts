import 'server-only';
import { FEATURES } from '@seedgw/contracts/features';
import { SUPPORT_STATUS_LABEL, type SupportStatus } from '@seedgw/contracts/support';
import { db } from '@seedgw/db/client';
import { notifyUsers } from '@/server/integrations/push-queue';

// Thông báo đẩy theo việc nghiệp vụ (M7). Gọi sau khi giao dịch đã ghi xong; không chờ, lỗi chỉ ghi log.

function fireAndForget(task: Promise<void>): void {
  void task.catch((error: unknown) => console.error('Không tạo được thông báo đẩy', error));
}

/**
 * Phiếu Tuyến đổi trạng thái: chờ duyệt thì báo người duyệt đang được giao, duyệt xong hoặc trả lại thì
 * báo người gửi. Không báo cho chính người vừa thao tác (ví dụ Lãnh đạo tự duyệt tuyến của mình).
 */
export function notifyApprovalChange(requestId: string, actorId: string): void {
  fireAndForget(
    (async () => {
      const request = await db.approvalRequest.findUnique({
        where: { id: requestId },
        select: {
          code: true,
          kind: true,
          status: true,
          periodLabel: true,
          submissionCount: true,
          submittedById: true,
          currentApproverId: true,
          submittedBy: { select: { fullName: true } },
        },
      });
      if (!request) return;
      if (request.kind === 'SALES_TARGET' && !FEATURES.salesTargets) return;
      const what = request.kind === 'ROUTE_PLAN' ? 'tuyến' : 'chỉ tiêu';
      const round = `${request.code}:${request.submissionCount}`;
      if (
        (request.status === 'PENDING_MANAGER' || request.status === 'PENDING_LEADER') &&
        request.currentApproverId &&
        request.currentApproverId !== actorId
      ) {
        await notifyUsers([
          {
            userId: request.currentApproverId,
            kind: 'APPROVAL_PENDING',
            title: 'Phiếu chờ bạn duyệt',
            body: `${request.submittedBy.fullName} gửi ${what} ${request.periodLabel.toLowerCase()}`,
            target: { screen: 'approvals' },
            key: `approval-pending:${round}:${request.status}`,
          },
        ]);
      }
      if (request.kind !== 'ROUTE_PLAN' || request.submittedById === actorId) return;
      if (request.status === 'APPROVED') {
        await notifyUsers([
          {
            userId: request.submittedById,
            kind: 'ROUTE_APPROVED',
            title: 'Tuyến đã được duyệt',
            body: `Tuyến ${request.periodLabel.toLowerCase()} đã được duyệt`,
            target: { screen: 'routes' },
            key: `route-approved:${round}`,
          },
        ]);
      } else if (request.status === 'RETURNED') {
        await notifyUsers([
          {
            userId: request.submittedById,
            kind: 'ROUTE_RETURNED',
            title: 'Tuyến bị trả lại',
            body: `Tuyến ${request.periodLabel.toLowerCase()} bị trả lại, mở app xem lý do`,
            target: { screen: 'routes' },
            key: `route-returned:${round}`,
          },
        ]);
      }
    })(),
  );
}

/** Quản trị trả lời yêu cầu hỗ trợ: báo người gửi, không kèm nội dung trả lời. */
export function notifySupportReply(requesterId: string, code: string, messageId: string): void {
  fireAndForget(
    notifyUsers([
      {
        userId: requesterId,
        kind: 'SUPPORT_REPLY',
        title: 'Hỗ trợ',
        body: `Quản trị đã trả lời yêu cầu ${code}`,
        target: { screen: 'support', code },
        key: `support-reply:${messageId}`,
      },
    ]),
  );
}

export function notifySupportStatus(
  requesterId: string,
  code: string,
  status: SupportStatus,
  at: Date,
): void {
  fireAndForget(
    notifyUsers([
      {
        userId: requesterId,
        kind: 'SUPPORT_STATUS',
        title: 'Hỗ trợ',
        body: `Yêu cầu ${code} chuyển sang ${SUPPORT_STATUS_LABEL[status]}`,
        target: { screen: 'support', code },
        key: `support-status:${code}:${status}:${at.getTime()}`,
      },
    ]),
  );
}

export function notifyLocationReview(
  proposerId: string,
  proposalId: string,
  dealerName: string,
  approved: boolean,
): void {
  fireAndForget(
    notifyUsers([
      {
        userId: proposerId,
        kind: approved ? 'LOCATION_APPROVED' : 'LOCATION_REJECTED',
        title: approved ? 'Toạ độ đã được duyệt' : 'Toạ độ bị từ chối',
        body: `Toạ độ ${dealerName} ${approved ? 'đã được duyệt' : 'bị từ chối'}`,
        target: { screen: 'nearby' },
        key: `location-review:${proposalId}`,
      },
    ]),
  );
}

const PROPOSAL_RESULT_TEXT = {
  APPROVED: 'đã được duyệt',
  REJECTED: 'bị từ chối',
  DUPLICATE: 'trùng một đại lý có sẵn',
} as const;

/** M10: báo người đề xuất kết quả duyệt đại lý mới. Trên web mở trang Đại lý đề xuất. */
export function notifyDealerProposalReview(
  proposerId: string,
  proposalId: string,
  dealerName: string,
  result: keyof typeof PROPOSAL_RESULT_TEXT,
): void {
  fireAndForget(
    notifyUsers([
      {
        userId: proposerId,
        kind: 'DEALER_PROPOSAL_REVIEWED',
        title: 'Đề xuất đại lý mới',
        body: `Đề xuất ${dealerName} ${PROPOSAL_RESULT_TEXT[result]}`,
        target: { screen: 'dealer-proposals' },
        key: `dealer-proposal-review:${proposalId}`,
      },
    ]),
  );
}

/** 25/11/2026: báo Quản lý hoặc Lãnh đạo đơn vị có đề xuất đại lý mới chờ duyệt. Bấm mở mục Cần duyệt. */
export function notifyDealerProposalPending(
  approverId: string,
  proposalId: string,
  dealerName: string,
  proposerName: string,
): void {
  fireAndForget(
    notifyUsers([
      {
        userId: approverId,
        kind: 'DEALER_PROPOSAL_PENDING',
        title: 'Đại lý mới chờ duyệt',
        body: `${proposerName} đề xuất đại lý ${dealerName}`,
        target: { screen: 'approvals' },
        key: `dealer-proposal-pending:${proposalId}:${approverId}`,
      },
    ]),
  );
}
