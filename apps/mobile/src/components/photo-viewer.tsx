import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, View } from 'react-native';
import { freshAccessToken } from '../api/client';
import { API_URL } from '../api/session';
import { getPhotoDataUri } from '../sync/track-db';
import { COLORS, SPACE } from '../theme';
import { Button } from './button';
import { Text } from './text';

/** Ảnh cần xem: ưu tiên ảnh còn trên máy (xem được lúc mất mạng), không có thì tải từ máy chủ. */
export type PhotoTarget = { localPhotoId: number | null; clientId: string | null } | null;

type Source = { uri: string; headers?: Record<string, string> };

export function PhotoViewer({ target, onClose }: { target: PhotoTarget; onClose: () => void }) {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSource(null);
    setError(null);
    if (!target) return;
    const local = target.localPhotoId === null ? null : getPhotoDataUri(target.localPhotoId);
    if (local) {
      setSource({ uri: local });
      return;
    }
    if (!target.clientId) {
      setError('Ảnh không còn trên máy.');
      return;
    }
    const clientId = target.clientId;
    let cancelled = false;
    void freshAccessToken().then((token) => {
      if (cancelled) return;
      if (!token) {
        setError('Cần đăng nhập để xem ảnh trên máy chủ.');
        return;
      }
      setSource({
        uri: `${API_URL}/api/mobile/check-ins/${clientId}/photo`,
        headers: { authorization: `Bearer ${token}` },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  return (
    <Modal visible={target !== null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        {source ? (
          <Image
            source={source}
            style={styles.image}
            resizeMode="contain"
            onError={() => setError('Không tải được ảnh. Kiểm tra mạng rồi thử lại.')}
            accessibilityIgnoresInvertColors
          />
        ) : error ? null : (
          <ActivityIndicator style={styles.image} color={COLORS.onBrand} />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Button label="Đóng" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: COLORS.text, justifyContent: 'center' },
  image: { flex: 1 },
  error: { color: COLORS.onBrand, fontSize: 15, padding: SPACE.lg, textAlign: 'center' },
  actions: { padding: SPACE.lg, backgroundColor: COLORS.surface },
});
