// Metro trả về mã tài nguyên (số) khi import tệp font hoặc ảnh; expo-font và thẻ Image dùng mã này.
declare module '*.ttf' {
  const asset: number;
  export default asset;
}

declare module '*.png' {
  const asset: number;
  export default asset;
}
