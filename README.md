# QrReaderSender

背面カメラでQRコードを連続読み取りし、重複を除いた値を指定URLへ送信するAndroidアプリです。React Native・Expo・TypeScriptとreact-native-vision-cameraを使用しています。

## 操作

```text
[START / STOP] [SEND] [RESET]
[送信先URL（約70%）] [保存待ち時間（約30%）▼]
読み取り数: 0
```

- **START / STOP**：カメラの開始・停止。
- **SEND**：QR値をカンマ区切りにしてURLエンコードし、`送信先URL?qr=値`へHTTP GETで送信。カメラを停止し、応答のステータスと本文を表示します。成功時のみ読み取りデータを消去します。
- **RESET**：確認後に読み取りデータを消去します。
- 読み取り件数と直近5件を表示します。同じQR値はSEND成功またはRESETまで追加しません。
- 送信先URLと保存待ち時間は変更時に端末へ保存し、次回起動時に復元します。読み取りデータ自体は永続保存しません。
- LAN内の送信先を使う場合、端末からそのURLへ接続できるネットワークに接続してください。

## 証跡画像の保存

待ち時間の選択肢は **0・50・75・100・250・500ms** です。**初期値は0で、0では画像を保存しません。** 以前の画像保存チェックボックスの設定は引き継がず、新しい待ち時間の設定がない場合は0になります。

0以外では、新しいQRを認識してから指定時間待ち、カメラプレビューを**JPEG品質35/100**で保存します。認識したフレームそのものではなく、画像サイズもプレビューに依存します。端末のフレーム更新周期やタイマーの実行タイミングにより、指定時間後でも同じフレームになる場合があります。

保存先とファイル名は次のとおりです。日時は端末のローカル時刻で、ファイル名にはQR認識時刻を使用します。

```text
Download/QrReaderSender/YYYY_MMDD/[QR先頭最大12文字]_YYYY_MMDD_hhmmss_SSS.jpg

例：Download/QrReaderSender/2026_0913/ABC123_2026_0913_143025_007.jpg
```

- 時刻は24時間表記、`SSS`はミリ秒3桁です。
- QR部分はUnicodeコードポイント単位で最大12文字。制御文字と `\ / : * ? " < > |` は `_` に置換し、前後の空白・末尾のピリオドを除去します。空になる場合は `QR` を使います。
- 一度に複数の新しいQRを認識した場合、同じ画像を各QRのファイル名で保存します。同一バッチ内で名前が重複する場合、ミリ秒を順に増やします。
- 待機・画像保存中は新たな読み取りを受け付けません。正常な読み取り・保存後に振動します。
- 保存に失敗するとカメラを停止し、エラーを表示します。QRデータは保持します。複数QRの一部画像だけ保存されている場合もあります。
- SEND・RESET・アプリ再起動では保存済み画像を削除しません。
- Android 10以降はMediaStore Downloadsで保存します。Android 9以前では、保存を有効にするときや保存有効状態でSTARTするときにストレージ権限を確認します。

## セットアップ（Windows PowerShell）

```powershell
git clone https://github.com/WAKU-TAKE-A/QrReaderSender.git
cd QrReaderSender
npx.cmd --yes yarn@1.22.22 install --frozen-lockfile
npx.cmd eas-cli login
```

Node.jsと、EASプロジェクトにアクセスできるExpoアカウントが必要です。EASのクラウドビルドにはPC側のAndroid SDKは不要です。

このリポジトリは、独自の画像保存モジュールを含む `android` フォルダを管理しています。通常のビルド前に `expo prebuild` を実行する必要はありません。**`android` をgitignoreへ追加したり、`expo prebuild --clean` で再生成したりすると、独自コードがビルドから失われます。**

## ビルドと実機での使用

| プロファイル | 用途 | Android出力 | 開発サーバー |
|---|---|---|---|
| development | 開発・待ち時間や画面の調整 | APK | 通常必要 |
| preview | PCから独立した実機試験 | APK | 不要 |
| production | 本番配布 | APK（明示設定） | 不要 |

### development：ホットリロードで調整

```powershell
npx.cmd eas-cli build --profile development --platform android
```

完了後のリンクからAPKを端末へインストールし、PCで次を実行します。

```powershell
npx.cmd expo start --dev-client
```

PCと端末を同じWi-Fiへ接続し、表示されたQRコードから開発版を開きます。TypeScript・画面・待ち時間の変更は通常ホットリロードで反映できます。Kotlinなどネイティブ側のコードや依存関係を変更した場合は、開発版の再ビルド・再インストールが必要です。Expo Goでは独自の画像保存モジュールを利用できません。

### preview：単独動作の確認

```powershell
npx.cmd eas-cli build --profile preview --platform android
```

### production：本番APK

```powershell
npx.cmd eas-cli build --profile production --platform android
```

preview・productionとも、完了後のリンクからAPKをダウンロードしてインストールします。**AABからAPKへの変換は不要です。** 現在の設定では、コードを変更したら再ビルド・再インストールして反映します。

各プロファイルのアプリIDは共通のため、別アプリとして共存する構成ではありません。同じ署名であれば上書き更新できます。署名の違いなどでアンインストールが必要になった場合は、先に送信先URLを控え、未送信データを送信してください。アンインストールでアプリの設定は消去されます。

## 確認項目

1. 初期値0で画像を保存せずQRを読み取れること。
2. 各待ち時間でJPEGが指定フォルダへ保存され、QRを含む画像になっていること。
3. 長いQR、日本語・絵文字、ファイル名に使えない文字、先頭12文字が同じ複数QRで名前を確認すること。
4. 同じQRの重複を防ぎ、RESET後は再度保存でき、既存画像も残ること。
5. URLと待ち時間を変更して再起動し、設定が復元されること。
6. SENDの成功・失敗時のデータ保持と、画像保存失敗時のエラー表示を確認すること。
7. Android 9以前ではストレージ権限を拒否した場合も確認すること。

型チェック：

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

Android SDKを設定済みの場合、ファイル名の単体テストは次で実行できます。

```powershell
cd android
.\gradlew.bat :app:testDebugUnitTest --tests com.wakutakea.QrReaderSender.EvidenceImageNamesTest
```

## ビルド設定の注意点

- ローカルAndroidビルドにはAndroid SDKが必要です。[最小SDKセットアップのメモ](minimal_android_sdk_setup.md)は参考資料ですが、記載のAPI 33ではなく実際の `android/build.gradle` の要求に合わせてください。現設定の標準値はcompile SDK 35、Build Tools 35.0.0、NDK 26.1.10909125です。
- LAN内のHTTP通信用に、AndroidManifest.xmlで `android:usesCleartextTraffic="true"` を設定しています。
- `android` フォルダがあるため、EASは `app.json` のネイティブ設定を自動同期しません。カメラ権限やQRスキャナー設定はAndroid側にも反映しています。
- Expo Doctorが依存バージョンの不一致を報告した場合は、`npx.cmd expo install --check` で確認してください。SDKやビルド環境の更新通知は、対象・最低バージョン・期限を確認してから対応し、独自のAndroidコードを維持して再試験します。
