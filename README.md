# QrReaderSender

背面カメラでQRコードを連続読み取りし、重複を除いた値を指定URLへ送信するAndroidアプリです。React Native・Expo・TypeScriptとreact-native-vision-cameraを使用しています。

現在のアプリバージョンは **1.1.0** です。QRのテキスト出力は1.1.0で追加しました。

## 操作

```text
[START / STOP] [SEND] [RESET]
[送信先URL] [保存待ち時間 ▼]
読み取り数: 0
```

- **START / STOP**：カメラの開始・停止。
- **SEND**：QR値をカンマ区切りにしてURLエンコードし、`送信先URL?qr=値`へHTTP GETで送信。カメラを停止し、応答のステータスと本文を表示します。成功時のみ読み取りデータを消去します。
- URL欄が **`.` または `-` の1文字だけ** の場合、SENDはネットワーク送信を行わず、読み取ったQRをテキストファイルへ保存します。成功時のみ読み取りデータを消去します。
- **RESET**：確認後に読み取りデータを消去します。
- 読み取り件数と直近5件を表示します。同じQR値はSEND成功またはRESETまで追加しません。
- 送信先URLと保存待ち時間は変更時に端末へ保存し、次回起動時に復元します。読み取りデータ自体は永続保存しません。
- LAN内の送信先を使う場合、端末からそのURLへ接続できるネットワークに接続してください。

### QRテキスト出力

URL欄に `.` または `-` を入力してSENDすると、端末のローカル時刻で次のファイルを作成します。保存先は証跡画像と同じフォルダです。

```text
Download/QrReaderSender/YYYY_MMDD/QR_YYYY_MMDD_hhmmss_SSS.txt
```

内容はUTF-8で、読み取り順にQR値を1行ずつ記録し、最後にも改行を付けます。例えばQR値が `QR01`、`QR02`、`QR03` なら、ファイル内容は次のようになります。

```text
QR01
QR02
QR03
```

QR値に改行が含まれる場合は `\n` または `\r`、バックスラッシュは `\\` に置き換えて1行に収めます。保存に失敗した場合は読み取りデータを保持します。Android 9以前では、SEND時にストレージ権限を確認します。画像保存の設定にかかわらずテキスト出力を利用できます。

## 証跡画像の保存

画像保存の選択肢は **保存なし・タップして保存・50・75・100・250・500ms・1秒** です。**初期値は「保存なし」** です。内部設定値は「保存なし」が `-1`、「タップして保存」が `0` ですが、画面には番号ではなく名称を表示します。

「タップして保存」では、新しいQRを認識すると振動して読み取りを止め、**画面のどこかをタップするまで画像の撮影を待ちます**。タップ後にプレビュー画像を保存し、読み取りを再開します。待機中はSEND・RESET・STOP・設定変更はできません。50ms～1秒の指定時間では、認識後にその時間を待って保存します。

画像は**JPEG品質35/100**です。認識したフレームそのものではなく、プレビュー画面を保存します。端末のフレーム更新周期やタイマーの実行タイミングにより、どのタイミングの画像になるかは機種によります。旧版で保存設定が0だった場合は、新しい「保存なし」へ移行し、従来の50～500msは引き継ぎます。

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

このリポジトリは、独自の画像・テキスト保存モジュールを含む `android` フォルダを管理しています。通常のビルド前に `expo prebuild` を実行する必要はありません。**`android` をgitignoreへ追加したり、`expo prebuild --clean` で再生成したりすると、独自コードがビルドから失われます。**

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

PCと端末を同じWi-Fiへ接続し、表示されたQRコードから開発版を開きます。TypeScript・画面・待ち時間の変更は通常ホットリロードで反映できます。Kotlinなどネイティブ側のコードや依存関係を変更した場合は、開発版の再ビルド・再インストールが必要です。Expo Goでは独自のファイル保存モジュールを利用できません。

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

1. 初期値「保存なし」で画像を保存せずQRを読み取れること。旧版の0設定も「保存なし」に移行されること。
2. 「タップして保存」でQR認識後に保存を待ち、タップ後にJPEGが保存されること。待機中は次のQRを受け付けないこと。
3. 50・75・100・250・500ms・1秒の各待ち時間でJPEGが指定フォルダへ保存され、QRを含む画像になっていること。
4. 長いQR、日本語・絵文字、ファイル名に使えない文字、先頭12文字が同じ複数QRで名前を確認すること。
5. 同じQRの重複を防ぎ、RESET後は再度保存でき、既存画像も残ること。
6. URLと保存設定を変更して再起動し、設定が復元されること。
7. SENDの成功・失敗時のデータ保持と、画像保存失敗時のエラー表示を確認すること。
8. Android 9以前ではストレージ権限を拒否した場合も確認すること。
9. URL欄が `.` または `-` の場合はHTTP送信せず、QRを読み取り順に改行区切りでテキスト保存すること。保存失敗時は読み取りデータが残り、通常のURLでは従来どおりHTTP GET送信されること。

型チェック：

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

Android SDKを設定済みの場合、画像・テキストのファイル名とテキスト内容の単体テストは次で実行できます。

```powershell
cd android
.\gradlew.bat :app:testDebugUnitTest --tests com.wakutakea.QrReaderSender.EvidenceImageNamesTest
```

## ビルド設定の注意点

- ローカルAndroidビルドにはAndroid SDKが必要です。[最小SDKセットアップのメモ](minimal_android_sdk_setup.md)は参考資料ですが、記載のAPI 33ではなく実際の `android/build.gradle` の要求に合わせてください。現設定の標準値はcompile SDK 35、Build Tools 35.0.0、NDK 26.1.10909125です。
- LAN内のHTTP通信用に、AndroidManifest.xmlで `android:usesCleartextTraffic="true"` を設定しています。
- `android` フォルダがあるため、EASは `app.json` のネイティブ設定を自動同期しません。カメラ権限やQRスキャナー設定はAndroid側にも反映しています。
- Expo Doctorが依存バージョンの不一致を報告した場合は、`npx.cmd expo install --check` で確認してください。SDKやビルド環境の更新通知は、対象・最低バージョン・期限を確認してから対応し、独自のAndroidコードを維持して再試験します。（エージェントに環境構築・コードの修正をしてもらうことをお勧めします）
