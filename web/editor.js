import {emptyState,normalize,clamp,hits,cycleHit,snap,shiftedColor} from './model.js';
const NS='http://www.w3.org/2000/svg';
const colors=['#69d2ff','#ffb86b','#ab9aff','#74e0ad','#ff8dab'];
const style=`:host{display:block;height:100%;color:#e6edf7;font:13px system-ui,sans-serif}*{box-sizing:border-box}button,input,select,textarea{font:inherit;color:inherit;background:#263348;border:1px solid #50617a;border-radius:5px;padding:5px}button{cursor:pointer}button:hover,button[aria-pressed=true]{background:#3c5877}button:disabled{opacity:.45;cursor:default}label{display:flex;gap:5px;align-items:center}input[type=number]{width:65px}input[type=checkbox]{width:auto}textarea{width:100%;resize:vertical;min-height:46px}.root{height:100%;display:flex;flex-direction:column;background:#151f2f;border:1px solid #46556b;border-radius:8px;padding:10px;gap:8px;overflow:auto}.bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.main{display:grid;grid-template-columns:minmax(200px,1fr) 205px;gap:10px;flex:1;min-height:330px}.stage{display:flex;align-items:center;justify-content:center;background:#0a101a;min-width:0;min-height:240px;overflow:hidden}svg{display:block;width:100%;height:100%;max-height:600px;touch-action:none;user-select:none}.side{display:flex;flex-direction:column;gap:8px;min-width:0}.list{height:135px;overflow:auto;background:#111927;border:1px solid #46556b;border-radius:4px}.row{display:block;width:100%;text-align:left;border:0;border-radius:0;font-size:12px;white-space:pre-line}.row[aria-pressed=true]{box-shadow:inset 3px 0 #69d2ff}.fields{display:grid;grid-template-columns:1fr 1fr;gap:6px}.fields label{justify-content:space-between}.muted{color:#adbbcf;font-size:11px}.error{color:#ffadad;min-height:16px}.wide{width:100%}@media(max-width:540px){.main{grid-template-columns:1fr}.list{height:90px}}`;
function el(tag,text,props={}) {const e=document.createElement(tag);if(text)e.textContent=text;Object.assign(e,props);return e;}
function svg(tag,attrs={}) {const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
export function createEditor({width=1024,height=1024,onChange=()=>{}}={}) {
  const host=el('div',null,{tabIndex:0}); const shadow=host.attachShadow({mode:'open'}); shadow.append(el('style',style));
  shadow.append(el('style',`input[type=color]{width:38px;height:30px;padding:2px;cursor:pointer;flex-shrink:0}.color-row{display:flex;gap:8px;align-items:center;height:30px;flex:0 0 30px}.color-row input[type=text]{width:88px;min-width:0}.side textarea{height:46px;min-height:46px;flex:0 0 46px;resize:none}.selection-info{height:32px;flex:0 0 32px;line-height:16px;overflow:hidden}.grid-colors{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.grid-colors label{font-size:12px}`));
  const root=el('div',null,{className:'root'});shadow.append(root);
  let state=emptyState(), selected=null, mode='select', drag=null, bg=null;
  const history=[JSON.stringify(state)]; let cursor=0,inputSource=null;
  const bar=el('div',null,{className:'bar'});root.append(bar);
  const button=(parent,text,fn)=>{const b=el('button',text,{type:'button'});b.onclick=fn;parent.append(b);return b;};
  const drawButton=button(bar,'＋ 描画',()=>{mode='draw';render();});
  const selectButton=button(bar,'選択 / 移動',()=>{mode='select';render();});
  const undo=button(bar,'元に戻す',()=>restore(-1)),redo=button(bar,'やり直す',()=>restore(1));
  const gridBar=el('div',null,{className:'bar'});root.append(gridBar);
  const number=(parent,label,min,max,change)=>{const wrap=el('label',label),i=el('input',null,{type:'number',min,max,step:1});i.setAttribute('aria-label',label);i.onchange=()=>{const v=Number(i.value);if(!Number.isFinite(v)){render();return;}change(clamp(Math.round(v),Number(i.min),Number(i.max)));};wrap.append(i);parent.append(wrap);return i;};
  const cols=number(gridBar,'列',1,32,v=>{state.grid.cols=v;commit();}),rows=number(gridBar,'行',1,32,v=>{state.grid.rows=v;commit();});
  const snapLabel=el('label','スナップ'),snapInput=el('input',null,{type:'checkbox'});snapInput.onchange=()=>{state.grid.snap=snapInput.checked;commit();};snapLabel.prepend(snapInput);gridBar.append(snapLabel);
  const gridInfo=el('span',null,{className:'muted'});gridBar.append(gridInfo);
  const gridColors=el('div',null,{className:'grid-colors'});root.append(gridColors);
  function gridColor(label,key){
    const wrap=el('label',label),picker=el('input',null,{type:'color',title:label});picker.setAttribute('aria-label',label);
    picker.oninput=()=>{state.grid[key]=picker.value;commit({refresh:false,source:picker});paint();};
    picker.onchange=()=>{state.grid[key]=picker.value;commit();};wrap.append(picker);gridColors.append(wrap);return picker;
  }
  const backgroundColor=gridColor('グリッド背景','background'),alternateColor=gridColor('交互マス','alternate');
  for(const [label,background,alternate]of [['暗色','#1d2939','#253247'],['グレー','#555555','#666666'],['明色','#ffffff','#e2e8f0']]){
    button(gridColors,label,()=>{state.grid.background=background;state.grid.alternate=alternate;commit();});
  }
  const main=el('div',null,{className:'main'}),stage=el('div',null,{className:'stage'}),canvas=svg('svg',{'aria-label':'領域編集キャンバス',role:'img'}),side=el('div',null,{className:'side'});stage.append(canvas);main.append(stage,side);root.append(main);
  side.append(el('div','領域一覧 · 上ほど前面',{className:'muted'}));const list=el('div',null,{className:'list'});side.append(list);
  const fields=el('div',null,{className:'fields'});side.append(fields);const inputs={};
  for(const [k,label]of [['x','X'],['y','Y'],['width','幅'],['height','高さ']])inputs[k]=number(fields,label,0,16384,v=>{const b=active();if(!b)return;b[k]=v;state=normalize(state,width,height);commit();});
  const percent=el('div',null,{className:'muted selection-info'});side.append(percent);
  const type=el('select',null,{className:'wide'});for(const[v,t]of [['obj','オブジェクト'],['text','テキスト']])type.append(el('option',t,{value:v}));type.setAttribute('aria-label','領域タイプ');type.onchange=()=>edit('type',type.value);side.append(type);
  const desc=el('textarea',null,{placeholder:'領域の説明',title:'領域の説明'}),text=el('textarea',null,{placeholder:'画像内に描く文字',title:'画像内に描く文字'});desc.onchange=()=>edit('desc',desc.value);text.onchange=()=>edit('text',text.value);side.append(desc,text);
  for(const [field,key]of [[desc,'desc'],[text,'text']])field.oninput=()=>{const b=active();if(b){b[key]=field.value;commit({refresh:false,source:field});paint();}};
  const colorRow=el('div',null,{className:'color-row'});
  const colorEnabled=el('input',null,{type:'checkbox',title:'領域の色を指定'});colorEnabled.setAttribute('aria-label','領域の色を指定');colorEnabled.style.margin='0';
  colorEnabled.onchange=()=>{const b=active();if(b){b.palette=colorEnabled.checked?[regionColor.value]:[];commit();}};
  const colorLabel=el('label','色指定');colorLabel.prepend(colorEnabled);
  const regionColor=el('input',null,{type:'color',title:'選択領域の色'});regionColor.setAttribute('aria-label','選択領域の色');
  const regionHex=el('input',null,{type:'text',title:'選択領域の色コード（空欄で指定なし）',placeholder:'指定なし',maxLength:7});regionHex.setAttribute('aria-label','選択領域の色コード');
  regionColor.oninput=()=>{const b=active();if(!b)return;b.palette[0]=regionColor.value;regionHex.value=regionColor.value;colorEnabled.checked=true;commit({refresh:false,source:regionColor});paint();};
  regionColor.onchange=()=>{const b=active();if(b){b.palette[0]=regionColor.value;commit();}};
  regionHex.onchange=()=>{const b=active();if(!b)return;if(!regionHex.value.trim()){b.palette=[];commit();return;}if(!/^#[\da-f]{6}$/i.test(regionHex.value)){error.textContent='色は #RRGGBB 形式で入力してください';return;}b.palette[0]=regionHex.value;commit();};
  regionHex.oninput=()=>{const b=active(),value=regionHex.value;if(!b||value.trim()&&!/^#[\da-f]{6}$/i.test(value))return;b.palette=value.trim()?[value,...b.palette.slice(1)]:[];colorEnabled.checked=!!b.palette.length;if(value.trim())regionColor.value=value;commit({refresh:false,source:regionHex});paint();};
  colorRow.append(colorLabel,regionColor,regionHex);side.append(colorRow);
  const actions=el('div',null,{className:'bar'});side.append(actions);
  const duplicate=button(actions,'複製',()=>{const b=active();if(!b||state.boxes.length>=512)return;const c={...structuredClone(b),id:crypto.randomUUID()};c.x=clamp(c.x+16,0,width-c.width);c.y=clamp(c.y+16,0,height-c.height);const color=shiftedColor(b.palette[0]||b.display_color||colors[state.boxes.indexOf(b)%colors.length]);if(b.palette.length)c.palette[0]=color;else c.display_color=color;state.boxes.push(c);selected=c.id;commit();});
  const remove=button(actions,'削除',deleteSelected);
  remove.title='選択領域を削除（Delete / Backspace）';duplicate.title='位置と色をずらして複製';
  const front=button(actions,'前へ',()=>reorder(1)),back=button(actions,'後ろへ',()=>reorder(-1));
  const filebar=el('div',null,{className:'bar'});root.append(filebar);const file=el('input',null,{type:'file',accept:'.json,application/json'});file.hidden=true;filebar.append(file);
  button(filebar,'JSON読込',()=>file.click());file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>2e6)throw Error('JSONは2MB以下にしてください');state=normalize(await f.text(),width,height);selected=null;commit();}catch(e){error.textContent=e.message;}finally{file.value='';}};
  button(filebar,'JSON保存',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=el('a',null,{href:url,download:'moss-layout.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  root.append(el('div','描画: 空き領域をドラッグ ／ 選択: ドラッグで移動・四隅でサイズ変更 ／ Alt＋クリックで重なりを順番に選択',{className:'muted'}));
  const error=el('div',null,{className:'error',role:'status'});root.append(error);
  function active(){return state.boxes.find(b=>b.id===selected);}
  function deleteSelected(){if(!active()||drag)return;state.boxes=state.boxes.filter(b=>b.id!==selected);selected=null;commit();host.focus({preventScroll:true});}
  function edit(k,v){if(active()){active()[k]=v;commit();}}
  function reorder(d){const i=state.boxes.findIndex(b=>b.id===selected),j=i+d;if(i<0||j<0||j>=state.boxes.length)return;[state.boxes[i],state.boxes[j]]=[state.boxes[j],state.boxes[i]];commit();}
  // Persist input events immediately: a tab/subgraph switch can detach controls
  // before their change event. Keep focus/native text undo and group each edit.
  function commit({refresh=true,source=null}={}){error.textContent='';const raw=JSON.stringify(state);if(raw!==history[cursor]){history.splice(cursor+1);if(source&&source===inputSource)history[cursor]=raw;else{history.push(raw);if(history.length>100)history.shift();cursor=history.length-1;}onChange(raw);}inputSource=source;undo.disabled=cursor===0;redo.disabled=cursor===history.length-1;if(refresh)render();}
  function restore(delta){if(!history[cursor+delta])return;inputSource=null;cursor+=delta;state=JSON.parse(history[cursor]);selected=active()?.id??null;onChange(history[cursor]);render();host.focus({preventScroll:true});}
  function render(){
    inputSource=null;
    drawButton.setAttribute('aria-pressed',mode==='draw');selectButton.setAttribute('aria-pressed',mode==='select');undo.disabled=cursor===0;redo.disabled=cursor===history.length-1;
    cols.value=state.grid.cols;rows.value=state.grid.rows;snapInput.checked=state.grid.snap;backgroundColor.value=state.grid.background;alternateColor.value=state.grid.alternate;gridInfo.textContent=`${width} × ${height} px · 1マス ${(width/state.grid.cols).toFixed(1)} × ${(height/state.grid.rows).toFixed(1)} px`;
    list.replaceChildren();[...state.boxes].reverse().forEach(b=>{const i=state.boxes.indexOf(b);const row=button(list,`${String(i+1).padStart(2,'0')} ${b.type==='text'?'文字':'物体'}  ${b.width} × ${b.height} px\n${b.desc.slice(0,30) || '(説明なし)'}`,()=>{selected=b.id;mode='select';render();host.focus({preventScroll:true});});row.className='row';row.setAttribute('aria-pressed',selected===b.id);});
    const b=active();for(const k of Object.keys(inputs)){inputs[k].disabled=!b;inputs[k].value=b?.[k]??'';inputs[k].min=['width','height'].includes(k)?1:0;inputs[k].max=k==='x'?width-(b?.width??1):k==='y'?height-(b?.height??1):k==='width'?width-(b?.x??0):height-(b?.y??0);}
    for(const e of [type,desc,text,colorEnabled,regionColor,regionHex,duplicate,remove,front,back])e.disabled=!b;
    type.value=b?.type??'obj';desc.value=b?.desc??'';text.value=b?.text??'';text.disabled=!b||b.type!=='text';
    text.placeholder=b?.type==='text'?'画像内に描く文字':'文字領域を選択すると編集できます';
    const color=b?(b.palette[0]||b.display_color||colors[state.boxes.indexOf(b)%colors.length]):'#69d2ff';
    colorEnabled.checked=!!b?.palette.length;regionColor.value=color;regionHex.value=b?.palette[0]??'';
    percent.textContent=b?`幅 ${(b.width/width*100).toFixed(1)}% · 高さ ${(b.height/height*100).toFixed(1)}%`: '一覧から背面の領域も選択できます';paint();
  }
  function paint(){
    const margin=Math.max(width,height)*.045,unit=Math.max(width,height)/1024;canvas.setAttribute('viewBox',`${-margin} ${-margin} ${width+margin*2} ${height+margin*2}`);canvas.replaceChildren();
    canvas.append(svg('rect',{width,height,fill:state.grid.background}));if(bg)canvas.append(svg('image',{href:bg,width,height,preserveAspectRatio:'none',opacity:.65}));
    const {cols:c,rows:r}=state.grid;
    for(let y=0;y<r;y++)for(let x=0;x<c;x++)if((x+y)%2===0)canvas.append(svg('rect',{x:x*width/c,y:y*height/r,width:width/c,height:height/r,fill:state.grid.alternate,opacity:bg?.18:1,'pointer-events':'none'}));
    const rgb=state.grid.background.slice(1).match(/../g).map(v=>parseInt(v,16));
    const light=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>145;
    const major=light?'#475569':'#9eb4cf',minor=light?'#94a3b8':'#57708c';
    for(let x=0;x<=c;x++){canvas.append(svg('line',{x1:x*width/c,x2:x*width/c,y1:0,y2:height,stroke:x%4===0?major:minor,'stroke-width':(x%4===0?1.5:.7)*unit}));if(x<c)label((x+.5)*width/c,-margin*.3,String(x+1),13*unit);}
    for(let y=0;y<=r;y++){canvas.append(svg('line',{x1:0,x2:width,y1:y*height/r,y2:y*height/r,stroke:y%4===0?major:minor,'stroke-width':(y%4===0?1.5:.7)*unit}));if(y<r)label(-margin*.5,(y+.5)*height/r,String(y+1),13*unit);}
    state.boxes.forEach((b,i)=>{
      const color=b.palette[0]||b.display_color||colors[i%colors.length];
      canvas.append(svg('rect',{x:b.x,y:b.y,width:b.width,height:b.height,fill:color,'fill-opacity':selected===b.id?.20:.06,stroke:color,'stroke-width':(selected===b.id?3:1.5)*unit}));
      const t=svg('text',{x:b.x+5*unit,y:b.y+18*unit,fill:color,'font-size':15*unit,stroke:'#0a101a','stroke-width':3*unit,'paint-order':'stroke','pointer-events':'none'});
      t.textContent=`${i+1} · ${b.width} × ${b.height} px`;canvas.append(t);
      if(b.desc&&b.width>10*unit&&b.height>30*unit){
        const description=svg('foreignObject',{'data-description':b.id,x:b.x+5*unit,y:b.y+26*unit,width:b.width-10*unit,height:b.height-30*unit,'pointer-events':'none',overflow:'hidden'});
        const body=document.createElementNS('http://www.w3.org/1999/xhtml','div');
        body.style.cssText=`height:100%;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;font:${14*unit}px/1.35 system-ui,sans-serif;color:${color};text-shadow:-1px -1px 0 #0a101a,1px -1px 0 #0a101a,-1px 1px 0 #0a101a,1px 1px 0 #0a101a;pointer-events:none`;
        body.textContent=b.desc;description.append(body);canvas.append(description);
      }
    });
    const b=active();if(b)for(const [h,x,y]of [['nw',b.x,b.y],['ne',b.x+b.width,b.y],['sw',b.x,b.y+b.height],['se',b.x+b.width,b.y+b.height]])canvas.append(svg('rect',{'data-handle':h,x:x-6*unit,y:y-6*unit,width:12*unit,height:12*unit,fill:'#fff',stroke:'#17243a','stroke-width':unit,style:`cursor:${h}-resize`}));
    function label(x,y,text,size){const t=svg('text',{x,y,fill:'#b8cce4','font-size':size,'text-anchor':'middle','dominant-baseline':'middle','pointer-events':'none'});t.textContent=text;canvas.append(t);}
  }
  function point(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(canvas.getScreenCTM().inverse());return {x:clamp(p.x,0,width),y:clamp(p.y,0,height)};}
  function snapped(p){return {x:snap(p.x,width,state.grid.cols,state.grid.snap),y:snap(p.y,height,state.grid.rows,state.grid.snap)};}
  canvas.onpointerdown=e=>{
    if(e.button!==0)return;e.preventDefault();host.focus({preventScroll:true});const p=point(e),handle=e.target.getAttribute('data-handle');
    if(e.altKey){selected=cycleHit(state.boxes,p.x,p.y,selected);mode='select';render();return;}
    if(mode==='draw'){if(state.boxes.length>=512){error.textContent='最大512領域です';return;}const q=snapped(p),b={id:crypto.randomUUID(),x:Math.min(q.x,width-1),y:Math.min(q.y,height-1),width:1,height:1,type:'obj',text:'',desc:'',palette:[]};state.boxes.push(b);selected=b.id;drag={kind:'draw',start:{x:b.x,y:b.y},before:history[cursor]};}
    else {if(!handle){const current=active();selected=current && hits([current],p.x,p.y).length?current.id:hits(state.boxes,p.x,p.y)[0]?.id??null;}const b=active();if(!b){render();return;}drag={kind:handle?'resize':'move',handle,start:p,box:structuredClone(b),before:history[cursor]};}
    canvas.setPointerCapture(e.pointerId);render();
  };
  canvas.onpointermove=e=>{
    if(!drag)return;const p=point(e),b=active();if(!b)return;
    if(drag.kind==='move'){const d=drag.box;b.x=clamp(snap(d.x+p.x-drag.start.x,width,state.grid.cols,state.grid.snap),0,width-d.width);b.y=clamp(snap(d.y+p.y-drag.start.y,height,state.grid.rows,state.grid.snap),0,height-d.height);}
    else {const q=snapped(p);let x0,y0,x1,y1;if(drag.kind==='draw'){x0=drag.start.x;y0=drag.start.y;x1=q.x;y1=q.y;}else{const d=drag.box;x0=d.x;y0=d.y;x1=d.x+d.width;y1=d.y+d.height;if(drag.handle.includes('w'))x0=q.x;else x1=q.x;if(drag.handle.includes('n'))y0=q.y;else y1=q.y;}b.x=Math.min(x0,x1);b.y=Math.min(y0,y1);b.width=Math.max(1,Math.abs(x1-x0));b.height=Math.max(1,Math.abs(y1-y0));b.x=clamp(b.x,0,width-b.width);b.y=clamp(b.y,0,height-b.height);}
    render();
  };
  canvas.onpointerup=e=>{if(!drag)return;const wasDraw=drag.kind==='draw';drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(wasDraw)mode='select';commit();};
  canvas.onpointercancel=()=>{if(drag){state=JSON.parse(drag.before);drag=null;selected=null;render();}};
  host.addEventListener('keydown',e=>{
    e.stopPropagation();
    const editing=e.composedPath().some(target=>target instanceof Element&&(target.matches('input,textarea,select,[role="textbox"]')||target.isContentEditable));
    if(editing||e.isComposing)return;
    const key=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&(key==='z'||key==='y')){
      e.preventDefault();e.stopImmediatePropagation();
      if(!drag)restore(key==='y'||e.shiftKey?1:-1);
      return;
    }
    if(!['Delete','Backspace'].includes(e.key)||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||!active()||drag)return;
    e.preventDefault();deleteSelected();
  });
  for(const event of ['pointerdown','wheel','dblclick'])host.addEventListener(event,e=>e.stopPropagation());
  // Clipboard events are separate from keydown. Outside the Shadow DOM their
  // target is the host DIV, which ComfyUI can mistake for the graph canvas.
  // Keep native clipboard editing, but never forward it to graph copy/paste.
  for(const event of ['copy','cut','paste'])host.addEventListener(event,e=>e.stopPropagation());
  render();
  return {element:host,get value(){return JSON.stringify(state);},setValue(raw){try{state=normalize(raw,width,height);selected=null;history.splice(0,history.length,JSON.stringify(state));cursor=0;render();}catch(e){error.textContent=`読込エラー: ${e.message}`;}},setDimensions(w,h){if(w===width&&h===height)return;width=w;height=h;state=normalize(state,width,height);history.splice(0,history.length,JSON.stringify(state));cursor=0;onChange(JSON.stringify(state));render();},setBackground(url){bg=url;paint();},destroy(){if(drag){state=JSON.parse(drag.before);drag=null;}host.remove();}};
}
