// Metro trả về mã tài nguyên (số) khi import tệp font, expo-font dùng mã này để nạp.
declare module '*.ttf' {
  const asset: number;
  export default asset;
}
