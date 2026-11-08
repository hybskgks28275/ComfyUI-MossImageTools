export const emptyState = () => ({version:1, boxes:[], grid:{cols:32, rows:32, snap:true, background:'#1d2939', alternate:'#253247'}});
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function normalize(raw, width, height) {
  const s = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
  if (s?.version !== 1 || !Array.isArray(s.boxes) || s.boxes.length > 512) throw Error('version 1 / boxes配列（最大512件）が必要です');
  const ids = new Set();
  s.boxes = s.boxes.map(b => {
    if (!b || ['x','y','width','height'].some(k => typeof b[k] !== 'number' || !Number.isFinite(b[k]))) throw Error('座標には有限の数値が必要です');
    const x = clamp(Math.round(Math.min(b.x,b.x+b.width)),0,width-1);
    const y = clamp(Math.round(Math.min(b.y,b.y+b.height)),0,height-1);
    const right = clamp(Math.round(Math.max(b.x,b.x+b.width)),x+1,width);
    const bottom = clamp(Math.round(Math.max(b.y,b.y+b.height)),y+1,height);
    let id = typeof b.id === 'string' ? b.id : crypto.randomUUID();
    if (ids.has(id)) id = crypto.randomUUID();
    ids.add(id);
    if (b.palette !== undefined && (!Array.isArray(b.palette) || b.palette.some(c => typeof c !== 'string' || !/^#[\da-f]{6}$/i.test(c)))) throw Error('色は #RRGGBB 形式で入力してください');
    const normalized={...b,id,x,y,width:right-x,height:bottom-y,type:b.type==='text'?'text':'obj',text:String(b.text??''),desc:String(b.desc??''),palette:(b.palette??[]).slice(0,5)};
    if(typeof normalized.display_color!=='string'||!/^#[\da-f]{6}$/i.test(normalized.display_color))delete normalized.display_color;
    return normalized;
  });
  const color = (value, fallback) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
  s.grid = {
    cols:clamp(Math.round(Number(s.grid?.cols)||32),1,32),
    rows:clamp(Math.round(Number(s.grid?.rows)||32),1,32),
    snap:s.grid?.snap!==false,
    background:color(s.grid?.background,'#1d2939'),
    alternate:color(s.grid?.alternate,'#253247'),
  };
  return s;
}
export function hits(boxes, x, y) { return boxes.filter(b => x>=b.x && x<=b.x+b.width && y>=b.y && y<=b.y+b.height).reverse(); }
export function cycleHit(boxes, x, y, selected) { const h=hits(boxes,x,y); return h.length ? h[(h.findIndex(b=>b.id===selected)+1)%h.length].id : null; }
export function snap(v, extent, divisions, enabled) { return clamp(Math.round(enabled ? Math.round(v/(extent/divisions))*(extent/divisions) : v),0,extent); }
export function shiftedColor(hex) {
  const [r,g,b]=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min,light=(max+min)/2;
  let hue=0;
  if(delta)hue=(max===r?(g-b)/delta+(g<b?6:0):max===g?(b-r)/delta+2:(r-g)/delta+4)/6;
  hue=(hue+137.508/360)%1;
  const saturation=Math.max(.55,delta?delta/(1-Math.abs(2*light-1)):0),l=clamp(light,.4,.7);
  const chroma=(1-Math.abs(2*l-1))*saturation,x=chroma*(1-Math.abs((hue*6)%2-1)),m=l-chroma/2;
  const channels=hue<1/6?[chroma,x,0]:hue<2/6?[x,chroma,0]:hue<3/6?[0,chroma,x]:hue<4/6?[0,x,chroma]:hue<5/6?[x,0,chroma]:[chroma,0,x];
  return '#'+channels.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
}
