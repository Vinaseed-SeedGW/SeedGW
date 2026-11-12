// Thu khoa API dia chi (Vietmap, Goong) tren vai toa do noi thanh Ha Noi.
// Khoa doc tu .env, khong bao gio in ra man hinh.
// Chay: pnpm map:thu

const POINTS = [
  { label: 'Ho Guom', lat: 21.0288, lng: 105.8522 },
  { label: 'Pho co, Hang Dao', lat: 21.0335, lng: 105.851 },
  { label: 'Quang truong Ba Dinh', lat: 21.0368, lng: 105.8346 },
  { label: 'Kim Lien, Dong Da', lat: 21.0062, lng: 105.8378 },
  { label: 'Ho Tay, duong Thanh Nien', lat: 21.0465, lng: 105.839 },
];

const PROVIDERS = [
  {
    name: 'Vietmap',
    envName: 'VIETMAP_API_KEY',
    url: (key, { lat, lng }) =>
      `https://maps.vietmap.vn/api/reverse/v4?apikey=${encodeURIComponent(key)}&lat=${lat}&lng=${lng}&display_type=1`,
    pickAddress: (body) => (Array.isArray(body) ? body[0]?.display : undefined),
  },
  {
    name: 'Goong',
    envName: 'GOONG_API_KEY',
    url: (key, { lat, lng }) =>
      `https://rsapi.goong.io/Geocode?latlng=${lat},${lng}&api_key=${encodeURIComponent(key)}`,
    pickAddress: (body) => body?.results?.[0]?.formatted_address,
  },
];

const STATUS_HINT = {
  401: 'khoa sai hoac chua kich hoat',
  403: 'khoa bi chan (kiem tra gioi han IP, ten mien trong trang quan ly khoa)',
  404: 'sai duong dan API, bao lai cho Claude',
  423: 'het luot hoac khoa chua bat API dia chi',
  429: 'goi qua nhanh, doi mot chut roi chay lai',
};

let tested = 0;
for (const provider of PROVIDERS) {
  const key = process.env[provider.envName]?.trim();
  if (!key) continue;
  tested += 1;
  console.log(`\n${provider.name} (${provider.envName})`);
  for (const point of POINTS) {
    const startedAt = Date.now();
    try {
      const response = await fetch(provider.url(key, point), {
        signal: AbortSignal.timeout(10_000),
      });
      const ms = Date.now() - startedAt;
      if (!response.ok) {
        const hint = STATUS_HINT[response.status] ?? 'loi khac';
        console.log(`  ${point.label}: HTTP ${response.status}, ${hint}`);
        continue;
      }
      const address = provider.pickAddress(await response.json());
      console.log(`  ${point.label} (${ms} ms): ${address ?? 'khong co dia chi'}`);
    } catch (error) {
      console.log(`  ${point.label}: khong goi duoc (${error.name})`);
    }
  }
}

if (tested === 0) {
  console.log(
    'Chua thay khoa. Mo file .env o thu muc goc, them dong VIETMAP_API_KEY=... hoac GOONG_API_KEY=... roi chay lai.',
  );
  process.exitCode = 1;
}
