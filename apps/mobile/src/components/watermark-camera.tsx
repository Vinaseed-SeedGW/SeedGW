import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type HostInstance,
} from 'react-native';
import { Text, TextInput } from './text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { captureRef } from 'react-native-view-shot';
import {
  GEOCODE_FAILURE_TEXT,
  hasGeocodeKey,
  reverseGeocode,
  type GeocodeResult,
} from '../api/reverse-geocode';
import { distanceMeters, type GeoPoint } from '../sync/geo';
import { syncNow } from '../sync/sync-queue';
import {
  deleteDraftPhoto,
  insertPhoto,
  updatePhotoPlace,
  type PlaceKind,
  getTrackingSettings,
} from '../sync/track-db';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import { serverEnabled } from '../api/session';
import type { CustomerChoice } from '../api/customers';
import { checkInRadiusM, type DealerChoice } from '../api/dealers';
import { serverNow } from '../api/server-clock';
import { CustomerPicker } from './customer-picker';
import { DealerPicker } from './dealer-picker';
import { WatermarkStrip, type StripLocation } from './watermark-strip';
import {
  emptyNewDealerDraft,
  NewDealerForm,
  validateNewDealer,
  type NewDealerDraft,
} from './new-dealer-form';
import { APP_NAME } from '@seedgw/config/brand';

const LONG_EDGE_PX = 1600;
const JPEG_QUALITY = 0.7;

type Shot = {
  uri: string;
  width: number;
  height: number;
  at: number;
  location: StripLocation;
  mocked: boolean;
  address: string | null;
  addressLine: string;
};

const ADDRESS_REFRESH_M = 25;

function addressLine(result: GeocodeResult): string {
  return result.ok ? result.address : `Địa chỉ ${GEOCODE_FAILURE_TEXT[result.reason]}`;
}

/** Địa chỉ hiện trên khung ngắm, chỉ hỏi lại khi đã đi quá 25 m để đỡ tốn lượt gọi bản đồ. */
function useLiveAddress(point: GeoPoint | null, precise: boolean): string {
  const [line, setLine] = useState(() =>
    hasGeocodeKey() ? 'Đang tìm địa chỉ' : addressLine({ ok: false, reason: 'NO_KEY' }),
  );
  const lastAsked = useRef<GeoPoint | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const lat = point?.lat;
  const lng = point?.lng;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (lat === undefined || lng === undefined || !precise || inFlight.current) return;
    const here = { lat, lng };
    if (lastAsked.current && distanceMeters(lastAsked.current, here) < ADDRESS_REFRESH_M) return;
    lastAsked.current = here;
    inFlight.current = true;
    void reverseGeocode(here).then((result) => {
      inFlight.current = false;
      if (!result.ok) lastAsked.current = null;
      if (mounted.current) setLine(addressLine(result));
    });
  }, [lat, lng, precise]);

  return line;
}

/** Chụp để check-in như thường, hoặc để đề xuất đại lý mới tại cửa hàng (M10). */
export type CameraIntent = 'check-in' | 'new-dealer';

type Props = {
  intent?: CameraIntent;
  /** Đại lý chọn sẵn từ màn Đại lý gần tôi (M4). Không có thì chọn sau khi chụp như cũ. */
  presetDealer?: DealerChoice | null;
  onClose: () => void;
  /** Gọi sau khi ảnh đã in thông tin và lưu vào máy. */
  onSaved: (sizeBytes: number) => void;
};

export function WatermarkCamera({
  intent = 'check-in',
  presetDealer = null,
  onClose,
  onSaved,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [shot, setShot] = useState<Shot | null>(null);

  if (!permission) return <View style={styles.fill} />;
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.message}>
          {`${APP_NAME} cần quyền dùng máy ảnh để chụp ảnh check-in.`}
        </Text>
        <Button label="Cho phép dùng máy ảnh" onPress={requestPermission} />
        <Button label="Quay lại" onPress={onClose} variant="ghost" />
      </View>
    );
  }
  if (shot) {
    return (
      <Review
        shot={shot}
        intent={intent}
        presetDealer={presetDealer}
        onRetake={() => setShot(null)}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }
  return <Viewfinder onShot={setShot} onClose={onClose} />;
}

function useLiveLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    void (async () => {
      const result = await Location.requestForegroundPermissionsAsync();
      if (!result.granted) {
        setDenied(true);
        return;
      }
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1_000, distanceInterval: 0 },
        setLocation,
      );
      if (cancelled) sub.remove();
      else subscription = sub;
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);
  return { location, denied };
}

function useClock() {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function Viewfinder({ onShot, onClose }: { onShot: (shot: Shot) => void; onClose: () => void }) {
  const camera = useRef<CameraView>(null);
  const { width } = useWindowDimensions();
  const { location, denied } = useLiveLocation();
  const now = useClock();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripLocation: StripLocation | null = location
    ? {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
      }
    : null;
  const imprecise = (location?.coords.accuracy ?? Infinity) > getTrackingSettings().maxAccuracyM;
  const liveAddress = useLiveAddress(stripLocation, !imprecise);

  async function capture() {
    if (!camera.current || !location || !stripLocation) return;
    setBusy(true);
    setError(null);
    // Chốt giờ và vị trí đúng lúc bấm chụp, không lấy lúc xử lý xong. Giờ theo máy chủ (M2);
    // máy bị chỉnh giờ thì máy chủ vẫn gắn cờ lệch giờ nhờ header giờ máy gửi kèm.
    const at = serverNow();
    const frozen = { ...stripLocation };
    const mocked = location.mocked === true;
    // Hỏi địa chỉ song song lúc xử lý ảnh; đứng yên thì lấy lại kết quả vừa hiện trên khung ngắm.
    const geocoding = reverseGeocode(frozen);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 1 });
      const portrait = picture.height >= picture.width;
      const context = ImageManipulator.manipulate(picture.uri, {
        maxWidth: LONG_EDGE_PX,
        maxHeight: LONG_EDGE_PX,
      });
      context.resize(portrait ? { height: LONG_EDGE_PX } : { width: LONG_EDGE_PX });
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
      const geocoded = await geocoding;
      onShot({
        uri: saved.uri,
        width: saved.width,
        height: saved.height,
        at,
        location: frozen,
        mocked,
        address: geocoded.ok ? geocoded.address : null,
        addressLine: addressLine(geocoded),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không chụp được ảnh, thử lại.');
      setBusy(false);
    }
  }

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camera}
        style={styles.fill}
        facing="back"
        onCameraReady={() => setReady(true)}
      />
      <View style={styles.bottom}>
        {denied ? (
          <Banner
            tone="danger"
            text={`Chưa có quyền vị trí. Mở Cài đặt và cho phép ${APP_NAME} dùng vị trí.`}
          />
        ) : null}
        {!denied && imprecise ? (
          <Banner
            tone="warning"
            text={
              location
                ? `Đang chờ định vị chính xác, sai số ${Math.round(location.coords.accuracy ?? 0)} m`
                : 'Đang lấy vị trí'
            }
          />
        ) : null}
        {error ? <Banner tone="danger" text={error} /> : null}
        <WatermarkStrip at={now} location={stripLocation} address={liveAddress} width={width} />
        <View style={styles.controls}>
          <Button label="Đóng" onPress={onClose} variant="ghost" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chụp ảnh check-in"
            disabled={!ready || !location || busy}
            onPress={capture}
            style={({ pressed }) => [
              styles.shutter,
              (!ready || !location || busy) && styles.disabled,
              pressed && styles.pressed,
            ]}
          />
          <View style={styles.controlSpacer} />
        </View>
      </View>
    </View>
  );
}

function Review({
  shot,
  intent,
  presetDealer,
  onRetake,
  onClose,
  onSaved,
}: {
  shot: Shot;
  intent: CameraIntent;
  presetDealer: DealerChoice | null;
  onRetake: () => void;
  onClose: () => void;
  onSaved: (sizeBytes: number) => void;
}) {
  const composite = useRef<HostInstance>(null);
  const { width } = useWindowDimensions();
  const height = Math.round((width * shot.height) / shot.width);
  const [state, setState] = useState<'composing' | 'saved' | 'failed'>('composing');
  const [sizeBytes, setSizeBytes] = useState(0);
  const [photoId, setPhotoId] = useState<number | null>(null);
  const [place, setPlace] = useState<PlaceDraft>({
    kind: 'DEALER',
    name: presetDealer?.name ?? '',
    note: '',
    dealer: presetDealer,
    customer: null,
    farReason: '',
  });
  const [newDealer, setNewDealer] = useState<NewDealerDraft>(() =>
    emptyNewDealerDraft(shot.address),
  );
  const dealerPoint =
    place.kind === 'DEALER' && place.dealer?.lat != null && place.dealer.lng != null
      ? { lat: place.dealer.lat, lng: place.dealer.lng }
      : null;
  const dealerDistanceM = dealerPoint
    ? Math.round(distanceMeters(shot.location, dealerPoint))
    : null;
  const radiusM = checkInRadiusM();
  const isFar = dealerDistanceM !== null && dealerDistanceM > radiusM;
  const started = useRef(false);

  async function compose() {
    // Ảnh có thể báo tải xong nhiều lần, chỉ in và lưu một lần.
    if (started.current) return;
    started.current = true;
    try {
      // Chụp lại khung ảnh kèm dải thông tin thành một JPEG duy nhất.
      const dataUri = await captureRef(composite, {
        format: 'jpg',
        quality: JPEG_QUALITY,
        result: 'data-uri',
      });
      const id = insertPhoto({
        takenAt: shot.at,
        ...shot.location,
        mocked: shot.mocked,
        dataUri,
        address: shot.address,
      });
      const bytes = Math.round(((dataUri.length - dataUri.indexOf(',') - 1) * 3) / 4);
      setPhotoId(id);
      setSizeBytes(bytes);
      setState('saved');
      onSaved(bytes);
    } catch {
      setState('failed');
    }
  }

  const [formError, setFormError] = useState<string | null>(null);

  // M10: lượt check-in loại Điểm khác mang theo đề xuất, gửi qua cùng hàng đợi nên mất mạng vẫn lưu được.
  function saveNewDealer() {
    if (photoId === null) return;
    const checked = validateNewDealer(newDealer);
    if (!checked.ok) {
      setFormError(checked.message);
      return;
    }
    const extra = newDealer.note.trim();
    updatePhotoPlace(photoId, {
      kind: 'OTHER',
      name: checked.data.name,
      note: extra ? `Đề xuất đại lý mới. ${extra}` : 'Đề xuất đại lý mới',
      dealerId: null,
      farReason: null,
      newDealer: JSON.stringify(checked.data),
    });
    void syncNow();
    onClose();
  }

  // Theo M2: phải có tên nơi check-in, ghi chú bắt buộc khi không ở đại lý.
  function saveCheckIn() {
    if (photoId === null) return;
    if (!place.name.trim()) {
      setFormError('Nhập tên nơi check-in.');
      return;
    }
    if (place.kind !== 'DEALER' && !place.note.trim()) {
      setFormError('Nhập ghi chú khi không check-in tại đại lý.');
      return;
    }
    // Check-in xa đại lý vẫn được lưu, chỉ bắt nhập lý do (IA, luồng Check-in bước 2).
    if (isFar && !place.farReason.trim()) {
      setFormError('Nhập lý do check-in xa đại lý.');
      return;
    }
    updatePhotoPlace(photoId, {
      kind: place.kind,
      name: place.name,
      note: place.note,
      dealerId: place.kind === 'DEALER' ? (place.dealer?.id ?? null) : null,
      customerId: place.kind === 'CUSTOMER' ? (place.customer?.id ?? null) : null,
      farReason: isFar ? place.farReason : null,
    });
    void syncNow();
    onClose();
  }

  function discard() {
    Alert.alert('Bỏ ảnh này?', 'Ảnh chưa lưu thành check-in sẽ bị xoá khỏi máy.', [
      { text: 'Giữ lại', style: 'cancel' },
      {
        text: 'Bỏ ảnh',
        style: 'destructive',
        onPress: () => {
          if (photoId !== null) deleteDraftPhoto(photoId);
          onRetake();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.fill, styles.reviewBackground]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <View ref={composite} collapsable={false} style={{ width, height }}>
          <Image
            source={{ uri: shot.uri }}
            style={{ width, height }}
            onLoad={() => void compose()}
            accessibilityIgnoresInvertColors
          />
          <View style={styles.compositeStrip}>
            <WatermarkStrip
              at={shot.at}
              location={shot.location}
              address={shot.addressLine}
              width={width}
            />
          </View>
        </View>
        <Text style={styles.reviewText}>
          {state === 'composing' ? 'Đang in thông tin lên ảnh' : null}
          {state === 'saved' ? `Đã lưu ảnh trên máy, ${Math.round(sizeBytes / 1024)} KB` : null}
          {state === 'failed' ? 'Không in được thông tin lên ảnh. Chụp lại.' : null}
        </Text>
        {shot.mocked ? (
          <Banner tone="danger" text="Vị trí đến từ ứng dụng giả lập, ảnh được gắn cờ." />
        ) : null}
        {state === 'saved' && intent === 'new-dealer' ? (
          <NewDealerForm value={newDealer} onChange={setNewDealer} />
        ) : null}
        {state === 'saved' && intent === 'check-in' ? (
          <PlaceForm
            value={place}
            onChange={setPlace}
            point={{ lat: shot.location.lat, lng: shot.location.lng }}
            far={isFar && dealerDistanceM !== null ? { distanceM: dealerDistanceM, radiusM } : null}
          />
        ) : null}
        {formError ? <Banner tone="danger" text={formError} /> : null}
      </ScrollView>
      <View style={styles.controls}>
        <Button label="Bỏ ảnh" onPress={discard} variant="ghost" />
        {intent === 'new-dealer' ? (
          <Button label="Gửi đề xuất" onPress={saveNewDealer} />
        ) : (
          <Button label="Lưu check-in" onPress={saveCheckIn} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

type PlaceDraft = {
  kind: PlaceKind;
  name: string;
  note: string;
  dealer: DealerChoice | null;
  customer: CustomerChoice | null;
  farReason: string;
};

const PLACE_KINDS: { kind: PlaceKind; label: string; nameLabel: string }[] = [
  { kind: 'DEALER', label: 'Đại lý', nameLabel: 'Tên đại lý' },
  { kind: 'CUSTOMER', label: 'Khách hàng', nameLabel: 'Tên khách hàng' },
  { kind: 'OTHER', label: 'Điểm khác', nameLabel: 'Tên điểm' },
];

/**
 * Đã đăng nhập máy chủ thì chọn đại lý từ danh mục (A7), không có trong danh sách thì gõ tên tay.
 * Bản thử chưa nối máy chủ chỉ gõ tên tay.
 */
function PlaceForm({
  value,
  onChange,
  point,
  far,
}: {
  value: PlaceDraft;
  onChange: (next: PlaceDraft) => void;
  point: { lat: number; lng: number };
  far: { distanceM: number; radiusM: number } | null;
}) {
  const current = PLACE_KINDS.find((item) => item.kind === value.kind) ?? PLACE_KINDS[0];
  const usePicker = value.kind === 'DEALER' && serverEnabled();
  const useCustomerPicker = value.kind === 'CUSTOMER' && serverEnabled();
  const selectedDealer = value.dealer;
  const selectedCustomer = value.customer;
  return (
    <View style={styles.form}>
      <Text style={styles.formLabel}>Nơi check-in</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {PLACE_KINDS.map((item) => {
          const selected = item.kind === value.kind;
          return (
            <Pressable
              key={item.kind}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() =>
                onChange({
                  ...value,
                  kind: item.kind,
                  // Đổi loại điểm thì bỏ đại lý đã chọn để không gửi nhầm.
                  ...(item.kind !== 'DEALER' && value.dealer ? { dealer: null, name: '' } : {}),
                  ...(item.kind !== 'CUSTOMER' && value.customer
                    ? { customer: null, name: '' }
                    : {}),
                })
              }
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.formLabel}>{current?.nameLabel}</Text>
      {usePicker ? (
        <DealerPicker
          point={point}
          selected={selectedDealer}
          onSelect={(dealer) => onChange({ ...value, dealer, name: dealer?.name ?? '' })}
        />
      ) : null}
      {useCustomerPicker ? (
        <CustomerPicker
          point={point}
          selected={selectedCustomer}
          onSelect={(customer) => onChange({ ...value, customer, name: customer?.name ?? '' })}
        />
      ) : null}
      {far ? (
        <>
          <Banner
            tone="warning"
            text={`Vị trí chụp cách đại lý khoảng ${far.distanceM} m, xa hơn bán kính ${far.radiusM} m. Check-in vẫn được lưu và gắn cờ.`}
          />
          <Text style={styles.formLabel}>Lý do check-in xa đại lý (bắt buộc)</Text>
          <TextInput
            value={value.farReason}
            onChangeText={(farReason) => onChange({ ...value, farReason })}
            accessibilityLabel="Lý do check-in xa đại lý"
            style={[styles.input, styles.inputMultiline]}
            multiline
          />
        </>
      ) : null}
      {(usePicker && selectedDealer) || (useCustomerPicker && selectedCustomer) ? null : (
        <>
          {usePicker ? (
            <Text style={styles.formLabel}>Không có trong danh sách thì gõ tên đại lý</Text>
          ) : null}
          {useCustomerPicker ? (
            <Text style={styles.formLabel}>Không có trong danh sách thì gõ tên khách hàng</Text>
          ) : null}
          <TextInput
            value={value.name}
            onChangeText={(name) => onChange({ ...value, name, dealer: null, customer: null })}
            accessibilityLabel={current?.nameLabel}
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </>
      )}
      <Text style={styles.formLabel}>
        {value.kind === 'DEALER' ? 'Ghi chú' : 'Ghi chú (bắt buộc)'}
      </Text>
      <TextInput
        value={value.note}
        onChangeText={(note) => onChange({ ...value, note })}
        accessibilityLabel="Ghi chú"
        style={[styles.input, styles.inputMultiline]}
        multiline
      />
    </View>
  );
}

function Banner({ tone, text }: { tone: 'warning' | 'danger'; text: string }) {
  return (
    <View style={[styles.banner, tone === 'warning' ? styles.bannerWarning : styles.bannerDanger]}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACE.xl, gap: SPACE.md },
  message: { fontSize: 16, textAlign: 'center', color: COLORS.text },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACE.lg,
    backgroundColor: COLORS.surface,
    gap: SPACE.md,
  },
  controlSpacer: { width: 88 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.brand,
    borderWidth: 4,
    borderColor: COLORS.brandSoft,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  banner: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  bannerWarning: { backgroundColor: COLORS.warningSoft },
  bannerDanger: { backgroundColor: COLORS.dangerSoft },
  bannerText: { color: COLORS.text, fontSize: 14 },
  reviewBackground: { backgroundColor: COLORS.surface },
  compositeStrip: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  form: { padding: SPACE.lg, gap: SPACE.sm },
  formLabel: { fontSize: 14, color: COLORS.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { fontSize: 15, color: COLORS.text },
  chipTextSelected: { color: COLORS.onBrand, fontWeight: FONT.bold },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
    fontSize: 16,
    color: COLORS.text,
  },
  inputMultiline: { minHeight: 80, paddingTop: SPACE.sm, textAlignVertical: 'top' },
  reviewText: {
    fontSize: 15,
    color: COLORS.text,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
  },
});
