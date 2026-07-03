import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { formatWorksheet } from './format-excel';

interface ModuleConfig {
  name: string;      // Tên in hoa, ví dụ: DIEU_PHOI
  moduleKey: string; // Tên in thường, ví dụ: dieu_phoi
  defaultUrl: string;// Đường dẫn tương đối
  description: string;
}

const targetModules: ModuleConfig[] = [
  { name: 'DIEU_PHOI', moduleKey: 'dieu_phoi', defaultUrl: '/vaccination/distribution', description: '9.1.1 Điều phối tiêm chủng' },
  { name: 'DANH_GIA_BAN_DAU', moduleKey: 'danh_gia_ban_dau', defaultUrl: '/vaccination/initial-assessment', description: '9.1.2 Đánh giá ban đầu' },
  { name: 'KHAM_SANG_LOC', moduleKey: 'kham_sang_loc', defaultUrl: '/vaccination/screening', description: '9.1.3 Khám sàng lọc' },
  { name: 'DS_CHO_TIEM', moduleKey: 'ds_cho_tiem', defaultUrl: '/vaccination/waiting-list', description: '9.2.1 DS chờ tại phòng tiêm' },
  { name: 'GOI_LICH_MUI', moduleKey: 'goi_lich_mui', defaultUrl: '/vaccination/package-schedule', description: '9.2.2 Gói và lịch mũi của KH' },
  { name: 'XAC_NHAN_TIEM', moduleKey: 'xac_nhan_tiem', defaultUrl: '/vaccination/confirmation', description: '9.2.3 Xác nhận tiêm' },
  { name: 'THEO_DOI_SAU_TIEM', moduleKey: 'theo_doi_sau_tiem', defaultUrl: '/vaccination/post-monitoring', description: '9.3.1 Theo dõi sau tiêm' },
  { name: 'DAY_CONG_QG', moduleKey: 'day_cong_qg', defaultUrl: '/vaccination/national-gateway', description: '9.3.2 Đẩy Cổng tiêm chủng QG' },
  { name: 'NHAC_HEN_GUI_TIN', moduleKey: 'nhac_hen_gui_tin', defaultUrl: '/vaccination/reminder-sms', description: '9.3.3 Nhắc hẹn và gửi tin' },
  { name: 'SO_THEO_DOI', moduleKey: 'so_theo_doi', defaultUrl: '/vaccination/log-book', description: '9.3.4 Sổ theo dõi tiêm chủng' },
  { name: 'BAO_CAO_TIEM_CHUNG', moduleKey: 'bao_cao_tiem_chung', defaultUrl: '/vaccination/report', description: '9.3.5 Báo cáo tiêm chủng' },
  { name: 'THEO_DOI_GOI_KH', moduleKey: 'theo_doi_goi_kh', defaultUrl: '/vaccination/package-customer-monitoring', description: '9.3.6 Theo dõi gói và KH' },
  { name: 'BIEN_BAN_SU_CO', moduleKey: 'bien_ban_su_co', defaultUrl: '/vaccination/incident-report', description: '9.3.7 Biên bản sự cố y khoa' }
];

/**
 * Tạo mới file Master_test_suite.xlsx hoàn toàn từ đầu với template mặc định và 13 module Tiêm chủng
 */
export async function generateMasterSuite(): Promise<void> {
  const targetDir = path.resolve(__dirname, '../data');
  const targetPath = path.resolve(targetDir, 'Master_test_suite.xlsx');

  // Đảm bảo thư mục data tồn tại
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`[MasterSuiteGenerator] Bắt đầu tạo mới file Master_test_suite.xlsx từ đầu...`);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Antigravity';
  workbook.created = new Date();

  // Array để lưu tất cả các worksheet nhằm định dạng header đồng bộ ở cuối
  const allSheets: ExcelJS.Worksheet[] = [];

  // 1. Tạo sheet PAGE
  const pageSheet = workbook.addWorksheet('PAGE');
  pageSheet.columns = [
    { header: 'page', key: 'page', width: 25 },
    { header: 'url', key: 'url', width: 45 }
  ];
  allSheets.push(pageSheet);

  // Thêm URL mặc định cho login và 13 trang tiêm chủng
  pageSheet.addRow({ page: 'login', url: '/login' });
  targetModules.forEach(mod => {
    pageSheet.addRow({ page: mod.moduleKey, url: mod.defaultUrl });
  });

  // 2. Tạo sheet ACTION_LIST và dữ liệu mặc định
  const actionListSheet = workbook.addWorksheet('ACTION_LIST');
  actionListSheet.columns = [
    { header: 'actions', key: 'actions', width: 20 },
    { header: 'description', key: 'description', width: 85 }
  ];
  allSheets.push(actionListSheet);

  const defaultActions = [
    { actions: 'navigate', description: 'navigate to URL' },
    { actions: 'go_back', description: 'Quay lại trang trước' },
    { actions: 'go_forward', description: 'Tiến tới trang tiếp theo' },
    { actions: 'refresh', description: 'Reload trang hiện tại' },
    { actions: 'check_status', description: 'Kiểm tra trạng thái element theo expect (visible, exists, text, value, enabled, checked…)' },
    { actions: 'click', description: 'Click vào element' },
    { actions: 'double_click', description: 'Double click vào element' },
    { actions: 'right_click', description: 'Click chuột phải vào element' },
    { actions: 'hover', description: 'Di chuột lên element' },
    { actions: 'press_key', description: 'Nhấn phím (Enter, Tab, Esc…)' },
    { actions: 'input', description: 'Nhập text vào field' },
    { actions: 'clear', description: 'Xóa text trong field' },
    { actions: 'upload_file', description: 'Upload file qua input type=file' },
    { actions: 'scroll_to', description: 'Scroll tới element' },
    { actions: 'select', description: 'Chọn tùy chọn trong dropdown' },
    { actions: 'check', description: 'Check checkbox' },
    { actions: 'uncheck', description: 'Uncheck checkbox' },
    { actions: 'capture', description: 'Chụp màn hình' }
  ];

  defaultActions.forEach(action => actionListSheet.addRow(action));

  // 3. Tạo sheet PRECONDITION
  const preconditionSheet = workbook.addWorksheet('PRECONDITION');
  preconditionSheet.columns = [
    { header: 'is_run', key: 'is_run', width: 12 },
    { header: 'tc_id', key: 'tc_id', width: 25 },
    { header: 'summary', key: 'summary', width: 30 },
    { header: 'step', key: 'step', width: 10 },
    { header: 'action', key: 'action', width: 18 },
    { header: 'target', key: 'target', width: 25 },
    { header: 'value', key: 'value', width: 25 },
    { header: 'expected', key: 'expected', width: 25 }
  ];
  allSheets.push(preconditionSheet);


  // 5. Áp dụng định dạng đồng bộ cho mọi sheet
  for (const sheet of allSheets) {
    formatWorksheet(sheet);
  }

  // 6. Ghi file kết quả
  console.log(`[MasterSuiteGenerator] Đang ghi file kết quả: ${targetPath}`);
  await workbook.xlsx.writeFile(targetPath);
  console.log(`[MasterSuiteGenerator] Hoàn thành! File đã được tạo mới tại ${targetPath}`);
}

// Cho phép chạy trực tiếp từ dòng lệnh
if (require.main === module) {
  generateMasterSuite()
    .then(() => console.log('[MasterSuiteGenerator] Hoàn tất quá trình tạo file.'))
    .catch((err) => console.error('[MasterSuiteGenerator] Đã xảy ra lỗi:', err));
}
