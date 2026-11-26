import { FormPage } from '@seedgw/ui/form-page';
import { getDealerCreateFormData } from '@/server/queries/dealer-proposals';
import { DealerCreateFormAssign, DealerCreateFormOwnUnit } from './dealer-create-form';

/** Trang Thêm đại lý dùng chung cho Kinh doanh và Quản trị (26/11/2026). Trang gọi kiểm quyền trước. */
export async function DealerCreatePage({ basePath }: { basePath: string }) {
  const data = await getDealerCreateFormData();
  return (
    <FormPage title="Thêm đại lý" backHref={basePath} backLabel="Về danh sách đại lý">
      {data.mode === 'ASSIGN' ? (
        <DealerCreateFormAssign
          basePath={basePath}
          mapTiles={data.mapTiles}
          orgUnits={data.orgUnits}
          users={data.users}
          provinceUnits={data.provinceUnits}
        />
      ) : data.mode === 'DIRECT' ? (
        <DealerCreateFormOwnUnit
          basePath={basePath}
          mapTiles={data.mapTiles}
          note="Đại lý được tạo ngay trong đơn vị của bạn, bạn là người phụ trách, chưa có mã FAST. Trùng số điện thoại hoặc mã số thuế với đại lý có sẵn thì không tạo mới mà mở đại lý đó."
          submitLabel="Thêm đại lý"
        />
      ) : (
        <DealerCreateFormOwnUnit
          basePath={basePath}
          mapTiles={data.mapTiles}
          note={
            data.approverName
              ? `Đại lý được tạo sau khi ${data.approverName} duyệt. Theo dõi kết quả ở trang Đại lý đề xuất.`
              : 'Đơn vị của bạn chưa có người duyệt, Quản trị hệ thống sẽ duyệt thay. Theo dõi kết quả ở trang Đại lý đề xuất.'
          }
          submitLabel="Gửi đề xuất"
        />
      )}
    </FormPage>
  );
}
