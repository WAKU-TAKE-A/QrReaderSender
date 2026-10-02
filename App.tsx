import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Button,
  Alert,
  Text,
  TextInput,
  ActivityIndicator,
  FlatList,
  Vibration,
  Pressable,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
  useCodeScanner,
} from 'react-native-vision-camera';

const STORAGE_KEY = 'endpointUrl';
const IMAGE_DELAY_STORAGE_KEY = 'imageCaptureDelayMsV2';
const LEGACY_IMAGE_DELAY_STORAGE_KEY = 'imageCaptureDelayMs';
const IMAGE_CAPTURE_DELAYS = [-1, 0, 50, 75, 100, 250, 500, 1000] as const;
type ImageCaptureDelay = typeof IMAGE_CAPTURE_DELAYS[number];
const imageCaptureDelayLabel = (delay: ImageCaptureDelay): string => {
  if (delay === -1) return '保存なし';
  if (delay === 0) return 'タップして保存';
  if (delay === 1000) return '1 秒';
  return `${delay} ms`;
};
const evidenceImages = NativeModules.EvidenceImages as {
  saveSnapshot(path: string, codes: string[], timestamp: number): Promise<void>;
  saveQrText(codes: string[], timestamp: number): Promise<string>;
} | undefined;

export default function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState('http://192.168.0.1:1880/send_data');
  const [qrCodes, setQrCodes] = useState<string[]>([]);
  const [imageCaptureDelay, setImageCaptureDelay] = useState<ImageCaptureDelay>(-1);
  const [isDelayPickerOpen, setIsDelayPickerOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isAwaitingTap, setIsAwaitingTap] = useState(false);
  const [isChangingSetting, setIsChangingSetting] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const scannedCodes = useRef(new Set<string>());
  const scanBusy = useRef(false);
  const pendingCaptureTap = useRef<(() => void) | null>(null);
  const cameraActive = useRef(false);

  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ fps: 10 }]);
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.multiGet([
          STORAGE_KEY, IMAGE_DELAY_STORAGE_KEY, LEGACY_IMAGE_DELAY_STORAGE_KEY,
        ]);
        if (stored[0][1] !== null) setEndpointUrl(stored[0][1]);
        const savedDelay = stored[1][1];
        const oldDelay = stored[2][1];
        const delay = savedDelay !== null ? Number(savedDelay) : Number(oldDelay);
        // In the old selector 0 meant no image. Preserve that meaning on upgrade.
        const migratedDelay = savedDelay === null && (oldDelay === null || delay === 0) ? -1 : delay;
        setImageCaptureDelay(IMAGE_CAPTURE_DELAYS.find((value) => value === migratedDelay) ?? -1);
      } catch (error) {
        Alert.alert('設定読み込みエラー', String(error));
      } finally {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    AsyncStorage.multiSet([
      [STORAGE_KEY, endpointUrl],
      [IMAGE_DELAY_STORAGE_KEY, String(imageCaptureDelay)],
    ]).catch((error) => Alert.alert('設定保存エラー', String(error)));
  }, [endpointUrl, imageCaptureDelay, settingsLoaded]);

  const ensureDownloadPermission = async () => {
    if (Platform.OS !== 'android' || !evidenceImages) {
      Alert.alert('ファイル保存', 'ファイル保存に対応したAndroidビルドが必要です。');
      return false;
    }
    if (Number(Platform.Version) >= 29) return true;
    const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
    if (await PermissionsAndroid.check(permission)) return true;
    const result = await PermissionsAndroid.request(permission);
    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
    Alert.alert('ファイル保存', 'ダウンロードフォルダへの保存にはストレージ権限が必要です。');
    return false;
  };

  const selectImageCaptureDelay = async (delay: ImageCaptureDelay) => {
    if (isChangingSetting) return;
    setIsChangingSetting(true);
    try {
      if (delay === -1 || await ensureDownloadPermission()) setImageCaptureDelay(delay);
    } catch (error) {
      Alert.alert('画像保存設定エラー', String(error));
    } finally {
      setIsChangingSetting(false);
      setIsDelayPickerOpen(false);
    }
  };

  const toggleCamera = async () => {
    if (scanBusy.current) return;
    setIsChangingSetting(true);
    try {
      if (!cameraActive.current && imageCaptureDelay >= 0 && !await ensureDownloadPermission()) return;
      cameraActive.current = !cameraActive.current;
      setIsCameraActive(cameraActive.current);
    } catch (error) {
      Alert.alert('カメラ開始エラー', String(error));
    } finally {
      setIsChangingSetting(false);
    }
  };

  const clearCodes = () => {
    scannedCodes.current.clear();
    setQrCodes([]);
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: async (codes) => {
      if (!cameraActive.current || scanBusy.current || isDelayPickerOpen) return;
      const newCodes = [...new Set(codes.map((code) => code.value).filter(
        (value): value is string => !!value && !scannedCodes.current.has(value)
      ))];
      if (newCodes.length === 0) return;
      const timestamp = Date.now();
      scanBusy.current = true;
      newCodes.forEach((code) => scannedCodes.current.add(code));
      setQrCodes((prev) => [...prev, ...newCodes]);
      try {
        if (imageCaptureDelay >= 0) {
          if (imageCaptureDelay === 0) {
            Vibration.vibrate(100);
            await new Promise<void>((resolve) => {
              pendingCaptureTap.current = resolve;
              setIsAwaitingTap(true);
            });
            setIsAwaitingTap(false);
            setIsSavingImage(true);
          } else {
            setIsSavingImage(true);
            // Allow the camera preview to catch up with the QR recognition callback.
            await new Promise<void>((resolve) => setTimeout(resolve, imageCaptureDelay));
          }
          if (!cameraRef.current || !evidenceImages) throw new Error('画像保存を開始できません。');
          const snapshot = await cameraRef.current.takeSnapshot({ quality: 35 });
          await evidenceImages.saveSnapshot(snapshot.path, newCodes, timestamp);
        }
        if (imageCaptureDelay !== 0) Vibration.vibrate(100);
      } catch (error) {
        // Keep the read data, but stop scanning so a missing image is visible.
        cameraActive.current = false;
        setIsCameraActive(false);
        Alert.alert('画像保存エラー', `QRデータは保持していますが、画像を保存できなかった可能性があります。\n${String(error)}`);
      } finally {
        pendingCaptureTap.current = null;
        setIsAwaitingTap(false);
        setIsSavingImage(false);
        scanBusy.current = false;
      }
    },
  });

  const handleSend = async () => {
    if (qrCodes.length === 0 || isSending || scanBusy.current) return;

    setIsSending(true);
    cameraActive.current = false;
    setIsCameraActive(false);
    const joinedCodes = qrCodes.join(',');

    try {
      if (endpointUrl === '.' || endpointUrl === '-') {
        if (!await ensureDownloadPermission()) return;
        const fileName = await evidenceImages!.saveQrText(qrCodes, Date.now());
        clearCodes();
        Alert.alert('テキスト保存完了', `ダウンロード/${fileName}`);
        return;
      }
      const url = `${endpointUrl}?qr=${encodeURIComponent(joinedCodes)}`;
      const response = await fetch(url);
      const text = await response.text();
      Alert.alert('送信結果', `Status: ${response.status}\n\n${text}`);
      if (response.ok) {
        clearCodes();
      }
    } catch (error) {
      Alert.alert('送信エラー', `${error}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    if (scanBusy.current || isSending) return;
    scanBusy.current = true;
    setIsChangingSetting(true);
    const finishReset = () => {
      scanBusy.current = false;
      setIsChangingSetting(false);
    };
    Alert.alert(
      'Confirm',
      'Are you sure you want to delete scanned data?',
      [
        {
          text: 'No',
          style: 'cancel',
          onPress: finishReset,
        },
        {
          text: 'Yes',
          onPress: () => {
            clearCodes();
            finishReset();
          },
        },
      ],
      { cancelable: true, onDismiss: finishReset }
    );
  };

  if (device == null) return <Text>Loading camera...</Text>;
  if (!hasPermission) return <Text>No camera permission</Text>;

  return (
    <View style={styles.container}>
      {isCameraActive && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          ref={cameraRef}
          photo={true}
          video={false}
          format={format}
          codeScanner={codeScanner}
        />
      )}

      <View style={styles.buttonContainer}>
        <View style={styles.row}>
          <Button
            title={isCameraActive ? 'STOP' : 'START'}
            onPress={toggleCamera}
            disabled={!settingsLoaded || isSending || isSavingImage || isAwaitingTap || isChangingSetting}
          />
          <View style={{ width: 10 }} />
          <Button
            title="SEND"
            onPress={handleSend}
            disabled={qrCodes.length === 0 || isSending || isSavingImage || isAwaitingTap || isChangingSetting}
          />
          <View style={{ width: 10 }} />
          <Button
            title="RESET"
            onPress={handleReset}
            color="red"
            disabled={isSending || isSavingImage || isAwaitingTap || isChangingSetting}
          />
        </View>

        <View style={styles.settingsRow}>
          <TextInput
            style={styles.textInput}
            value={endpointUrl}
            onChangeText={setEndpointUrl}
            placeholder="送信先URL"
            editable={settingsLoaded && !isSending && !isAwaitingTap && !isSavingImage}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            style={styles.delayPicker}
            accessibilityRole="combobox"
            accessibilityLabel="画像保存のウエイト時間"
            accessibilityValue={{ text: imageCaptureDelayLabel(imageCaptureDelay) }}
            accessibilityState={{ expanded: isDelayPickerOpen, disabled: !settingsLoaded || isSavingImage || isAwaitingTap || isChangingSetting || isSending }}
            disabled={!settingsLoaded || isSavingImage || isAwaitingTap || isChangingSetting || isSending}
            onPress={() => {
              if (!scanBusy.current) setIsDelayPickerOpen(true);
            }}
          >
            <Text style={styles.delayValue} numberOfLines={1}>
              {imageCaptureDelay === 0 ? 'タップ保存' : imageCaptureDelayLabel(imageCaptureDelay)}
            </Text>
            <Text style={styles.delayArrow}>▼</Text>
          </Pressable>
        </View>

        <Modal
          visible={isDelayPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!isChangingSetting) setIsDelayPickerOpen(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="選択を閉じる"
              disabled={isChangingSetting}
              onPress={() => setIsDelayPickerOpen(false)}
            />
            <View style={styles.delayOptions} accessibilityViewIsModal>
              <Text style={styles.delayTitle}>画像保存のウエイト時間</Text>
              {IMAGE_CAPTURE_DELAYS.map((delay) => (
                <Pressable
                  key={delay}
                  style={styles.delayOption}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: imageCaptureDelay === delay, disabled: isChangingSetting }}
                  disabled={isChangingSetting}
                  onPress={() => selectImageCaptureDelay(delay)}
                >
                  <Text style={styles.delayOptionText}>
                    {imageCaptureDelay === delay ? '●' : '○'}  {imageCaptureDelayLabel(delay)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>

        {isSavingImage && <Text style={styles.qrInfo}>画像保存中...</Text>}

        {isSending && (
          <ActivityIndicator size="small" color="#00ffcc" style={{ marginTop: 10 }} />
        )}

        <Text style={styles.qrInfo}>
          読み取り数: {qrCodes.length}
          {qrCodes.length > 0 && (() => {
            const last = qrCodes[qrCodes.length - 1];
            const preview = last.length > 20 ? last.slice(0, 20) + "..." : last;
            return ` (${preview})`;
          })()}
        </Text>

        {qrCodes.length > 0 && (
          <FlatList
            style={{ marginTop: 10, maxHeight: 200 }}
            data={qrCodes
              .map((code, index) => ({ code, index }))
              .slice(-5)
              .reverse()}
            renderItem={({ item }) => (
              <Text style={{ color: 'white' }}>
                {item.index + 1}: {item.code}
              </Text>
            )}
            keyExtractor={(item) => item.index.toString()}
          />
        )}
      </View>

      {isAwaitingTap && (
        <Pressable
          style={styles.tapToCaptureOverlay}
          accessibilityRole="button"
          accessibilityLabel="画面をタップして画像を保存"
          onPress={() => {
            const continueCapture = pendingCaptureTap.current;
            pendingCaptureTap.current = null;
            continueCapture?.();
          }}
        >
          <Text style={styles.tapToCaptureText}>QRを読み取りました。画面をタップして画像を保存</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: '90%',
    alignItems: 'center',
  },
  settingsRow: {
    marginTop: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 7,
    minWidth: 0,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  qrInfo: {
    color: 'white',
    marginTop: 10,
  },
  row: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  delayPicker: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    backgroundColor: 'white',
    borderRadius: 5,
    paddingHorizontal: 6,
  },
  delayValue: { color: 'black', flexShrink: 1, fontSize: 12 },
  delayArrow: { color: 'black', fontSize: 10, marginLeft: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  delayOptions: {
    width: '80%',
    maxWidth: 360,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  delayTitle: { color: 'black', fontSize: 18, marginBottom: 8 },
  delayOption: { minHeight: 48, justifyContent: 'center' },
  delayOptionText: { color: 'black', fontSize: 16 },
  tapToCaptureOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  tapToCaptureText: {
    color: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 12,
    textAlign: 'center',
    fontSize: 16,
  },
});
