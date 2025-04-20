# 🧩 Minimal Android SDK Installation (Windows)

This guide explains how to install a **minimal Android SDK setup** for use with Expo or React Native CLI, without installing Android Studio. It focuses on a small footprint, using command-line tools only.

---

## ✅ Required Components

| Package                         | Purpose                                  |
|----------------------------------|------------------------------------------|
| `cmdline-tools`                 | Contains `sdkmanager`, `avdmanager`, etc. |
| `platform-tools`               | Contains `adb` and core device tools     |
| `platforms;android-33`         | Target Android platform API              |
| `emulator` (optional)          | Required for running an Android emulator |
| `system-images;...` (optional) | Required for emulator image              |

---

## 🚀 Installation Steps

### 1. Create installation folder

```bash
mkdir C:\Android\minimal-sdk
cd C:\Android\minimal-sdk
```

---

### 2. Download `cmdline-tools`

1. Visit the [official Android Studio download page](https://developer.android.com/studio#command-tools)
2. Download **Command line tools only > Windows**
3. Extract it to:

```
C:\Android\minimal-sdk\
└── cmdline-tools\
    └── latest\
        ├── bin\
        └── lib\
```

> 💡 Rename the folder to `latest` (required by modern tools like Expo).

---

### 3. Install packages with `sdkmanager`

#### ✅ Basic setup:

```bash
cd C:\Android\minimal-sdk\cmdline-tools\latest\bin

sdkmanager --sdk_root=C:\Android\minimal-sdk ^
  "platform-tools" ^
  "platforms;android-33"
```

#### ✅ Emulator (optional):

```bash
sdkmanager --sdk_root=C:\Android\minimal-sdk ^
  "emulator" ^
  "system-images;android-33;google_apis;x86_64"
```

---

### 4. Set environment variables

#### Required:

```
ANDROID_SDK_ROOT=C:\Android\minimal-sdk
```

#### Add to `PATH`:

```
C:\Android\minimal-sdk\platform-tools
C:\Android\minimal-sdk\cmdline-tools\latest\bin
C:\Android\minimal-sdk\emulator
```

---

## ✅ Supported Use Cases

| Use Case                  | Required Packages         | Supported |
|---------------------------|---------------------------|-----------|
| `expo run:android`        | `platform-tools`, `adb`   | ✅ Yes     |
| React Native CLI          | `platforms`, `adb`        | ✅ Yes     |
| Android Emulator          | `emulator` (optional)     | ✅ Optional|
| USB Device Debugging      | `adb`                     | ✅ Yes     |

---

## ✨ Extras

- PowerShell script automation (optional)
- Mac/Linux versions also possible
