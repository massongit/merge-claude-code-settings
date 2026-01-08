# merge-claude-code-settings

<!-- textlint-disable ja-technical-writing/ja-no-mixed-period -->

[English](./README.md) | 日本語

<!-- textlint-enable ja-technical-writing/ja-no-mixed-period -->

## ⚠️重要⚠️

**本バージョンにはnpmjsのTrusted Publishingを設定するために必要な最低限の内容しか含まれていません。**

Claude Codeの複数プロジェクトの設定を統合するTypeScriptツールです。
グローバル設定ファイルに統合します。

## 背景

Claude Codeでは、特定のコマンド実行を今後ユーザーへの確認なしに許可する機能があります。
この許可設定は各プロジェクトのローカル設定ファイル（`.claude/settings.local.json`）に保存されます。

**問題点：** プロジェクトごとに個別に許可設定を行う必要があります。
同じコマンドを複数プロジェクトで毎回許可するのは非効率です。

**解決策：** 各プロジェクトの設定を統合します。
グローバル設定ファイル（`~/.claude/settings.json`）にマージされます。
これにより、全プロジェクトで共通の許可設定を利用できます。

## 機能

- 複数プロジェクトの `.claude/settings.local.json` を自動検出
- グローバル設定 (`~/.claude/settings.json`) にマージ
- 書き込み前に自動バックアップを作成 (`~/.claude/settings.json.bak`)
- `permissions` フィールドは配列を結合して重複を自動削除
- 実行時に許可されたコマンドをデバッグ出力

## 使い方

### 1. ビルド

```bash
bun run build
```

### 2. 実行

開発時（TypeScriptを直接実行）。

```bash
bun run dev
```

ビルド後（コンパイル済みJavaScriptを実行）。

```bash
node dist/index.js
```

実行すると次の処理を行います。

1. `~/.claude.json` から登録済みのプロジェクト一覧を取得
2. 各プロジェクトの `.claude/settings.local.json` を読み込み
3. グローバル設定にマージ
4. 現在の設定のバックアップを作成 (`~/.claude/settings.json.bak`)
5. マージ済み設定を `~/.claude/settings.json` に書き込み

### デバッグモード

`--show-allow-commands` オプションを付与すると、各プロジェクトで許可されているコマンドを標準出力します。

```bash
node dist/index.js --show-allow-commands
```

出力例。

<!-- markdownlint-disable MD010 -->

```text
/path/to/project/.claude/settings.local.json	Bash(git status)
/path/to/project/.claude/settings.local.json	Bash(npm run build)
```

<!-- markdownlint-enable MD010 -->

## マージロジック

### 通常のフィールド

後から読み込まれた設定で上書きされます（最後のプロジェクトの設定が優先）。

### `permissions` フィールド

特別な処理を行います。

- 全プロジェクトの配列を結合
- 重複を削除
- アルファベット順にソート

**例：**

- グローバル設定： `{"permissions": {"allow": ["cmd1", "cmd2"]}}`
- プロジェクトA: `{"permissions": {"allow": ["cmd2", "cmd3"]}}`
- プロジェクトB: `{"permissions": {"allow": ["cmd4"]}}`
- **結果:** `{"permissions": {"allow": ["cmd1", "cmd2", "cmd3", "cmd4"]}}`

## 技術スタック

- **言語:** TypeScript
- **ランタイム:** Bun
- **主な依存関係:** Node.js標準ライブラリ（fs, path, os）

## 開発

### 設定

<https://pre-commit.com/> の手順に従って `pre-commit` をインストールします。
これにより、コミット時にクレデンシャルが含まれていないかの検査が行われるようになります。

### テスト

ライブラリ関数の機能を検証するために、テストスイートを実行します。

```bash
bun test
```

39の包括的なテストが実行されます。

- `isStringArray`: 型ガード検証（21テスト）
- `mergeSettings`: 設定マージロジック（18テスト）

## コード整形

```bash
bun run fix
```

Prettierでコードをフォーマットします。
