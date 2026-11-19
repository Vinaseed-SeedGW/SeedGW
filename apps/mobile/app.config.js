// Cấu hình chính nằm ở app.json. Tệp này chỉ thêm tệp Firebase (google-services.json) cho thông báo đẩy
// Android khi build trên EAS (M7): tệp lưu ở biến môi trường dạng tệp GOOGLE_SERVICES_JSON, không đưa vào git.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
});
