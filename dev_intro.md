# 開発作品詳細ページ 入力テンプレート

## 1. 基本情報

### タイトル
BeEngineer 春の無料体験講座 LINE申込フォーム

### Slug
beengineer-line-application

### 一覧カード説明
LINEから無料体験講座へ申し込み、申込内容の確認メッセージ送信とGoogleスプレッドシートへの自動保存まで行えるWebアプリケーションです。

### 使用技術
HTML5
CSS3
JavaScript
LIFF SDK
LINE Messaging API
Google Apps Script
Googleスプレッドシート
GitHub Pages
GitHub Actions
JSON

### カード / メイン画像
画像は後から設定

### 詳細ページ上部にもこの画像を表示する
表示する

### ギャラリー画像
画像は後から設定

- 申込フォームの入力画面
- LINEへ届く申込確認カード
- Googleスプレッドシートの申込一覧

---

## 2. 詳細ページ本文

### プロジェクト概要
BeEngineerが実施する2027年度春の無料体験講座への申し込みを、LINE上で完結させるために開発した申込システムです。利用者はLINE公式アカウントのリッチメニューからフォームを開き、新学年、校舎、講座、氏名、学校名を順番に入力できます。申込完了後は、内容を整理したLINEメッセージを送信し、担当者が確認するGoogleスプレッドシートへ自動保存します。

### 開発目的
LINEから迷わず無料体験講座へ申し込める導線を作るため
校舎ごとに異なる講座を正確に案内するため
申込者と運営担当者の双方が申込内容を確認できるようにするため
申込情報の転記作業をなくし、Googleスプレッドシートへ自動集約するため
スマートフォンで操作しやすく、安心して個人情報を入力できる画面を作るため

### 使用技術: プログラミング言語
JavaScript
Google Apps Script

### 使用技術: フロントエンド
HTML5
CSS3
Vanilla JavaScript
LIFF SDK

### 使用技術: バックエンド / 外部サービス
Google Apps Script
Googleスプレッドシート
LINE Messaging API
LINE公式アカウント
GitHub Pages
GitHub Actions

### 主な機能
個人情報の利用目的を示す同意画面
新学年、校舎、講座、氏名、学校名を順番に入力するステップフォーム
校舎ごとの講座一覧と複数講座選択
開催日時順の自動並び替え
開催2日前を切った講座の自動非表示
選択した校舎の住所、アクセス、Googleマップリンク表示
申込内容の確認と項目ごとの修正
LINE Flex Messageによる見やすい申込内容の送信
Googleスプレッドシートへの自動保存
複数講座を講座ごとに別行で保存
LINE表示名の保存
校舎専用LINEへの友だち追加案内
送信中のローディング表示
古い画面を検知して最新版へ更新するキャッシュ対策
他校舎への連続申込

### システム構成: 説明文
GitHub Pagesで配信するLIFF対応フォームと、Google Apps Scriptによる保存・LINE送信処理で構成しています。講座情報はJSONファイルで管理し、フロントエンドで校舎別表示、期限判定、並び替えを行います。申込データはGoogle Apps Scriptへ送信し、Googleスプレッドシートへ保存します。

### システム構成: 処理の流れ
ユーザーがLINE公式アカウントのリッチメニューからLIFFを開く
↓ LIFF初期化・ログイン
個人情報の利用目的を確認し、「同意して申し込む」をタップ
↓ フォーム開始
新学年、校舎、講座、氏名、学校名を入力
↓ 申込内容を確認
LINEへ申込確認用のFlex Messageを送信
↓ Google Apps Scriptへ申込データを送信
選択した講座ごとにGoogleスプレッドシートへ1行ずつ保存
↓ 保存完了
申込完了画面で校舎専用LINEへの友だち追加を案内

### 工夫した点
入力項目を1画面ずつ表示し、スマートフォンでも迷いにくい操作にした
確認画面の各項目をタップすると、その項目だけ修正できるようにした
校舎を変更した場合は、誤申込を防ぐため講座選択を自動で解除した
講座名と日時を視覚的に分け、LINEメッセージでも読みやすくした
講座をJSONで管理し、コードを変更せず講座情報を更新できるようにした
日本時間を基準に受付期限を判定し、締切後の講座を自動で非表示にした
送信中はローダーと変化する点を表示し、処理が継続していることを伝えた
申込完了後、選択校舎の専用LINEへ自然に誘導できる画面を設計した
GitHub ActionsでLIFF IDとGAS URLを注入し、公開ファイルへ設定値を直接保存しない構成にした

---

## 3. 技術的ハイライト

### 技術的ハイライト 1: 見出し
1. 校舎別講座の読込・期限判定・並び替え

### 技術的ハイライト 1: コード
```javascript
CAMPUSES = (catalog.campuses || []).map(campus => ({
  name: campus.name,
  lineUrl: campus.lineUrl,
  postalCode: campus.postalCode || "",
  address: campus.address || "",
  access: campus.access || "",
  courses: (campus.courses || [])
    .slice()
    .sort(compareCourses)
    .filter(course => isCourseOpen(course.date, deadline))
    .map(formatCourse)
})).filter(campus => campus.name && campus.courses.length > 0);
```

### 技術的ハイライト 2: 見出し
2. 複数講座を講座ごとに自動保存

### 技術的ハイライト 2: コード
```javascript
for (let index = 0; index < courseDetails.length; index += 1) {
  const course = courseDetails[index];
  await requestGas({
    ...data,
    courses: [data.courses[index]],
    courseTitles: [course.title],
    courseDatetimes: [course.datetime],
    submittedAt,
    lineName: profile.displayName,
    userId: profile.userId,
    messageText,
    flexMessage,
    deliverLine: !sentInChat && index === 0
  });
}
```

### 技術的ハイライト 3: 見出し
3. LINE Flex Messageによる申込内容の通知

### 技術的ハイライト 3: コード
```javascript
return {
  type: "flex",
  altText: "2027年度 春の無料体験講座の申込を受け付けました",
  contents: {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#06C755",
      contents: [
        {
          type: "text",
          text: "申込を受け付けました",
          color: "#FFFFFF",
          weight: "bold",
          size: "xl"
        }
      ]
    }
  }
};
```

### 技術的ハイライト: 補足リスト
LIFFのトークコンテキストが利用できる場合はsendMessagesを使用
トーク外から開いた場合はGoogle Apps Script経由のpush送信へ切り替え
通常のPOSTが失敗した場合にJSONPへ切り替えるフォールバックを実装
Googleスプレッドシートでは講座名と日時を別列に保存
複数講座でもLINEへの確認メッセージは1通だけ送信
ユーザーIDはスプレッドシートへ保存せず、担当者が検索に使えるLINE表示名のみ保存
エラー時は完了画面へ進まず、利用者へ再試行可能なメッセージを表示

---

## 4. 開発情報

### 開発形態
個人開発

### 役割
要件整理
画面設計
フロントエンド実装
Google Apps Script実装
LINE Messaging API・LIFF連携
Googleスプレッドシート設計
GitHub Actionsによるデプロイ構築
動作確認・改善

### 制作期間
2026年10月（継続改善）

---

## 5. 開発時の注意事項

### 導入文
本プロジェクトは、実際の無料体験講座の申込受付を想定して開発しました。氏名、学校名、LINE表示名などを扱うため、利用目的の明示、秘密情報の管理、誤送信の防止に配慮しています。

### 注意事項グループ 1: 小見出し
個人情報の取り扱い

### 注意事項グループ 1: 項目
申込開始前に利用目的を説明する同意画面を表示
取得する情報を画面上で明示
無料体験講座の受付、連絡、当日の運営に利用目的を限定
プライバシーポリシーへのリンクを掲載
LINEユーザーIDはスプレッドシートへ保存しない
スプレッドシートの閲覧権限を運営担当者に限定して管理する

### 注意事項グループ 2: 小見出し
認証情報・設定値の管理

### 注意事項グループ 2: 項目
LINEチャネルアクセストークンはGoogle Apps Scriptのスクリプトプロパティで管理
LIFF IDとGAS URLはGitHub Actionsのリポジトリ変数から公開時に注入
.envはGitの管理対象外に設定
アクセストークンや秘密情報を公開リポジトリへ保存しない

### 注意事項グループ 3: 小見出し
運用・データ整合性

### 注意事項グループ 3: 項目
校舎変更時は選択済み講座を解除し、別校舎の講座が残らないようにする
保存成功を確認してから申込完了画面を表示する
複数講座は講座ごとに別行で保存し、担当者が集計しやすい形にする
開催日時と受付期限は日本時間を基準に判定する
公開ページが古い場合は最新版を検知して自動で読み直す

### 開発時の注意事項: 補足リスト
Messaging API、LIFF、Google Apps Scriptの仕様変更時には再検証が必要
GASを新しいURLでデプロイした場合は、GitHub変数とLINE Webhook URLも更新する
GitHub変数を変更した場合は、GitHub Pagesの再デプロイが必要

---

## 6. デモ動画

### デモ動画: 説明文
LINEのリッチメニューから申込フォームを開き、入力、確認、送信、LINEメッセージ受信、スプレッドシート反映までの流れを紹介します。

### デモ動画: YouTube URL
後から設定

---

## 7. 謝辞

LINE Developers: LIFF・Messaging APIドキュメント
Google Apps Script: Webアプリ・スプレッドシート連携
GitHub Pages / GitHub Actions: 静的サイトの公開と自動デプロイ
MDN Web Docs: HTML・CSS・JavaScriptの技術資料