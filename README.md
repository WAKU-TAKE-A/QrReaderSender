# QrReaderSender

QrReaderSender is a React Native application that uses the react-native-vision-camera library to scan QR codes with the device’s back camera.

It collects unique QR code values and sends them to a user-defined HTTP endpoint.

The app features real-time scanning, duplicate prevention, and a simple UI for starting/stopping the camera and managing scanned data.

## Installation

To run this project locally, follow the steps below.

### 1. Clone the repository:

```bash
git clone https://github.com/WAKU-TAKE-A/QrReaderSender.git
cd QrReaderSender
```

### 2. Install dependencies:

Make sure you have Node.js installed. Then, install the dependencies using:

```bash
# Install JS dependencies
yarn install

# Install native dependencies required by Expo
npx expo install --check
```

### 3. Configure the build settings:

```bash
npx expo prebuild
eas build:configure
```

### 4. Build and run the development version:

```bash
eas build --profile development --platform android
```

Once the build completes, install the generated APK on your Android device.

If you stop the development server (e.g., by pressing Ctrl+C), you can restart it anytime with:​

```bash
npx expo start
```

This will launch the development server again, allowing you to continue development.

### 5. Build the production version (for release):

Once your app is ready for production, build the release APK with:

```bash
eas build --profile production --platform android --clear-cache
```

### 6. Convert the AAB file to an APK file:

If the build completes successfully, an AAB file will be generated on the server.  

To install the app directly on a device, you can convert the AAB to an APK.  

I recommend using the Android app "[AAB to APK Converter Installer](https://play.google.com/store/apps/details?id=com.recklet.aabconverter)" for this.

---

### 📦 Android SDK Notes

This project requires the Android SDK. If you prefer a minimal installation with the smallest possible footprint,  
please refer to [minimal_android_sdk_setup.md](./minimal_android_sdk_setup.md) for setup instructions.

Note: `choco install android-sdk` installs an outdated version (26.1.1).  
It is highly recommended to use the official SDK command-line tools instead.

### 📦 Allowing HTTP Traffic on Local Network (AndroidManifest.xml)

HTTP communication over a local network is assumed.  

The attribute `android:usesCleartextTraffic="true"` is set in `android/app/src/main/AndroidManifest.xml` accordingly.  

If HTTPS is used instead, this attribute can be removed.
