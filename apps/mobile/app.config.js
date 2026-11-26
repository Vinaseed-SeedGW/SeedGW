// Cấu hình chính nằm ở app.json. Tệp này thêm:
// - Hai bản app cài song song (26/11/2026): APP_VARIANT=test là "SeedGW Thử", mã gói vn.vinaseed.seedgw.test,
//   kênh thu-nghiem, trỏ máy chủ thử; APP_VARIANT=production là SeedGW, mã gói vn.vinaseed.seedgw, kênh
//   production, trỏ máy chủ thật. Không đặt thì là bản Test, để chạy thử trên máy dev không lẫn với bản thật.
// - Tệp Firebase (google-services.json) cho thông báo đẩy Android khi build trên EAS (M7): tệp lưu ở biến môi
//   trường dạng tệp GOOGLE_SERVICES_JSON của từng môi trường EAS, không đưa vào git.
const VARIANT = process.env.APP_VARIANT === 'production' ? 'production' : 'test';
const IS_TEST = VARIANT === 'test';
const TEST_ID_SUFFIX = '.test';

module.exports = ({ config }) => ({
  ...config,
  name: IS_TEST ? 'SeedGW Thử' : config.name,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_TEST
      ? `${config.ios.bundleIdentifier}${TEST_ID_SUFFIX}`
      : config.ios.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: IS_TEST ? `${config.android.package}${TEST_ID_SUFFIX}` : config.android.package,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  extra: {
    ...config.extra,
    appVariant: VARIANT,
  },
});
