import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Button,
  Alert,
  Text,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
  useCodeScanner,
} from 'react-native-vision-camera';

export default function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState('http://192.168.0.1:1880/send_data');
  const [qrCodes, setQrCodes] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const cameraRef = useRef(null);

  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ fps: 2 }]);
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (!isScanning) return;

      const newCodes: string[] = [];
      for (const code of codes) {
        if (code.value && !qrCodes.includes(code.value)) {
          newCodes.push(code.value);
        }
      }

      if (newCodes.length > 0) {
        setIsScanning(false);
        setQrCodes((prev) => {
          const combined = [...prev, ...newCodes];
          return [...new Set(combined)]; // 重複除去
        });
        setTimeout(() => setIsScanning(true), 300); // 自動で再開
      }
    },
  });

  const handleSend = async () => {
    if (qrCodes.length === 0 || isSending) return;

    setIsSending(true);
    setIsCameraActive(false); // 念のためSTOP
    const joinedCodes = qrCodes.join(',');

    try {
      const url = `${endpointUrl}?qr=${encodeURIComponent(joinedCodes)}`;
      const response = await fetch(url);
      const text = await response.text();
      Alert.alert('送信結果', `Status: ${response.status}\n\n${text}`);
      if (response.ok) {
        setQrCodes([]); // 成功時にリセット
      }
    } catch (error) {
      Alert.alert('送信エラー', `${error}`);
    } finally {
      setIsSending(false);
    }
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
        <Button
          title={isCameraActive ? 'STOP' : 'START'}
          onPress={() => setIsCameraActive(!isCameraActive)}
          disabled={isSending}
        />

        <TextInput
          style={styles.textInput}
          value={endpointUrl}
          onChangeText={setEndpointUrl}
          placeholder="送信先URL"
        />

        <Button
          title="SEND"
          onPress={handleSend}
          disabled={!isCameraActive || qrCodes.length === 0 || isSending}
        />

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
      </View>
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
  textInput: {
    marginTop: 10,
    width: '100%',
    height: 40,
    backgroundColor: 'white',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  qrInfo: {
    color: 'white',
    marginTop: 10,
  },
});
