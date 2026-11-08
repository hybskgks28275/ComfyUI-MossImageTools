// Japanese source labels are kept stable for existing workflows and UI tests.
// These strings describe controls only; user-authored layout content is never translated.
export const english = {
  '＋ 描画': '+ Draw', '選択 / 移動': 'Select / Move', '元に戻す': 'Undo', 'やり直す': 'Redo',
  '列': 'Columns', '行': 'Rows', 'スナップ': 'Snap',
  'グリッド背景': 'Grid background', '交互マス': 'Alternating cells',
  '暗色': 'Dark', 'グレー': 'Gray', '明色': 'Light',
  '領域編集キャンバス': 'Region editor canvas', '領域一覧 · 上ほど前面': 'Regions · Front at top',
  '幅': 'Width', '高さ': 'Height', '領域タイプ': 'Region type',
  'オブジェクト': 'Object', 'テキスト': 'Text', '文字': 'Text', '物体': 'Object', '(説明なし)': '(No description)',
  '領域の説明': 'Region description', '画像内に描く文字': 'Text to render',
  '領域の色を指定': 'Specify region color', '色指定': 'Color', '選択領域の色': 'Selected region color',
  '選択領域の色コード（空欄で指定なし）': 'Region HEX color (empty for unspecified)',
  '指定なし': 'Unspecified', '選択領域の色コード': 'Selected region HEX color',
  '色は #RRGGBB 形式で入力してください': 'Enter a color in #RRGGBB format.',
  '複製': 'Duplicate', '削除': 'Delete', '前へ': 'Forward', '後ろへ': 'Backward',
  '選択領域を削除（Delete / Backspace）': 'Delete selected region (Delete / Backspace)',
  '位置と色をずらして複製': 'Duplicate with an offset and a different hue',
  'JSON読込': 'Import JSON', 'JSON保存': 'Export JSON', 'JSONは2MB以下にしてください': 'JSON must be 2 MB or smaller.',
  '描画: 空き領域をドラッグ ／ 選択: ドラッグで移動・四隅でサイズ変更 ／ Alt＋クリックで重なりを順番に選択': 'Draw: drag on the canvas / Select: drag to move, corners to resize / Alt-click to cycle overlaps',
  '一覧から背面の領域も選択できます': 'Use the list to select regions behind others.',
  '文字領域を選択すると編集できます': 'Select a text region to edit its text.',
  '最大512領域です': 'A maximum of 512 regions is supported.',
  'version 1 / boxes配列（最大512件）が必要です': 'Expected version 1 and a boxes array with at most 512 regions.',
  '座標には有限の数値が必要です': 'Coordinates must be finite numbers.',
  '読込エラー: {message}': 'Load error: {message}',
  '{width} × {height} px · 1マス {cellWidth} × {cellHeight} px': '{width} × {height} px · Cell {cellWidth} × {cellHeight} px',
  '幅 {width}% · 高さ {height}%': 'Width {width}% · Height {height}%',
};

export function resolveLocale(locale) {
  return /^ja(?:[-_]|$)/i.test(String(locale ?? '')) ? 'ja' : 'en';
}

export function translate(locale, key, values = {}) {
  const template = resolveLocale(locale) === 'ja' ? key : english[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}

// One settings listener per extension, with weak editor references: removed nodes
// can still be restored by graph Undo without retaining every discarded editor.
export function createLocaleController(settings, browserLocale = 'en') {
  const editors = new Set();
  const pending = new Map();
  const identity = node => node?.graph && node.id != null ? `${node.graph.id ?? 'root'}:${node.id}` : null;
  const current = () => resolveLocale(settings?.getSettingValue?.('Comfy.Locale') ?? browserLocale);
  settings?.addEventListener?.('Comfy.Locale.change', event => {
    const locale = resolveLocale(event.detail?.value ?? current());
    pending.clear();
    for (const entry of editors) {
      const editor = entry.editor.deref(), node = entry.node?.deref();
      if (editor) {
        const key = identity(node);
        if (key) pending.set(key,{session:editor.getSession(),expires:Date.now()+30000});
        editor.setLocale(locale);
      } else editors.delete(entry);
    }
  });
  return {
    get locale(){return current();},
    register(editor,node){editors.add({editor:new WeakRef(editor),node:node?new WeakRef(node):null});editor.setLocale(current());},
    restore(editor,node){
      const key=identity(node),saved=pending.get(key);
      if(!saved)return;
      // ComfyUI may configure the same nested node more than once per reload.
      // Retain this short-lived snapshot until all configure passes have finished.
      if(saved.expires>=Date.now())editor.restoreSession(saved.session);
      else pending.delete(key);
    },
  };
}
