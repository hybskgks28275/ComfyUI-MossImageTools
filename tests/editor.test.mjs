import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../web/editor.js';

// A small DOM double exercises the real editor event handlers and persistence,
// without a browser dependency. Visual/clipboard integration is checked in ComfyUI.
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.style={};this.attrs={};this.listeners={};this.value='';}
  get textContent(){return this._text??this.children.map(child=>child.textContent??'').join('');}
  set textContent(value){this.children=[];this._text=value;}
  append(...nodes){this.children.push(...nodes);}
  prepend(...nodes){this.children.unshift(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this.attrs[key]=String(value);if(['title','placeholder'].includes(key))this[key]=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  attachShadow(){return this.shadowRoot=new Element('shadow');}
  addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
  focus(){}
  matches(selector){return ['input','textarea','select'].includes(this.tagName);}
}
globalThis.Element=Element;
globalThis.document={createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:value=>Object.assign(new Element('#text'),{textContent:value})};
function all(root){return [root,...root.children.flatMap(all),...(root.shadowRoot?all(root.shadowRoot):[])];}
function fixture(locale='ja'){
  let saved;
  const editor=createEditor({locale,onChange:raw=>{saved=raw;}});
  editor.setValue(JSON.stringify({version:1,boxes:[{id:'a',x:10,y:10,width:300,height:300,type:'text',desc:'before',text:'old',palette:[]}]}));
  const find=predicate=>all(editor.element).find(predicate);
  find(e=>e.tagName==='button'&&e.className==='row').onclick();
  return {editor,find,get saved(){return JSON.parse(saved);}};
}
function input(field,value){field.value=value;field.oninput();}

test('description and image text persist on input before blur/change; survive reconstruction',()=>{
  const f=fixture();
  input(f.find(e=>e.title==='領域の説明'),'説明入力中');
  assert.equal(f.saved.boxes[0].desc,'説明入力中');
  input(f.find(e=>e.title==='画像内に描く文字'),'NEW TEXT');
  assert.equal(f.saved.boxes[0].text,'NEW TEXT');
  const restored=createEditor();restored.setValue(JSON.stringify(f.saved));
  assert.deepEqual(JSON.parse(restored.value),f.saved);
});

test('picker input and valid/cleared HEX persist before change, without resetting focus values',()=>{
  const f=fixture(),picker=f.find(e=>e.title==='選択領域の色'),hex=f.find(e=>e.attrs['aria-label']==='選択領域の色コード');
  input(picker,'#123456');assert.deepEqual(f.saved.boxes[0].palette,['#123456']);
  assert.equal(hex.value,'#123456');
  input(hex,'#abcdef');assert.deepEqual(f.saved.boxes[0].palette,['#abcdef']);
  input(hex,'#ab');assert.deepEqual(f.saved.boxes[0].palette,['#abcdef']);assert.equal(hex.value,'#ab');
  input(hex,'');assert.deepEqual(f.saved.boxes[0].palette,[]);
});

test('both grid colors persist on input before native picker closes',()=>{
  const f=fixture();
  for(const [label,key,value]of [['グリッド背景','background','#123456'],['交互マス','alternate','#abcdef']]){
    input(f.find(e=>e.title===label),value);assert.equal(f.saved.grid[key],value);
  }
});

test('continuous input remains one local undo step and redo preserves final text',()=>{
  const f=fixture(),desc=f.find(e=>e.title==='領域の説明');
  input(desc,'a');input(desc,'ab');input(desc,'abc');desc.onchange();
  f.find(e=>e.textContent==='元に戻す').onclick();assert.equal(f.saved.boxes[0].desc,'before');
  f.find(e=>e.textContent==='やり直す').onclick();assert.equal(f.saved.boxes[0].desc,'abc');
});

test('copy/cut/paste stop at editor boundary and retain browser default editing',()=>{
  const f=fixture();
  for(const type of ['copy','cut','paste']){
    let stopped=false,prevented=false;
    for(const listener of f.editor.element.listeners[type]??[])listener({stopPropagation(){stopped=true;},preventDefault(){prevented=true;}});
    assert.equal(stopped,true,`${type} must not reach graph handlers`);
    assert.equal(prevented,false,`${type} must retain native text editing`);
  }
});

test('English/Japanese switching preserves content, selection, palette, grid, and undo history',()=>{
  const f=fixture('en');
  assert.ok(f.find(e=>e.tagName==='button'&&e.textContent==='+ Draw'));
  input(f.find(e=>e.title==='Region description'),'日本語 and English user content');
  input(f.find(e=>e.title==='Selected region color'),'#123456');
  const before=f.editor.value;
  f.editor.setLocale('ja-JP');
  assert.equal(f.editor.value,before);
  assert.ok(f.find(e=>e.tagName==='button'&&e.textContent==='＋ 描画'));
  assert.equal(f.find(e=>e.title==='領域の説明').value,'日本語 and English user content');
  assert.equal(f.find(e=>e.title==='選択領域の色').value,'#123456');
  assert.equal(f.find(e=>e.className==='row').attrs['aria-pressed'],'true');
  f.editor.setLocale('en');
  f.find(e=>e.tagName==='button'&&e.textContent==='Undo').onclick();
  assert.deepEqual(f.saved.boxes[0].palette,[]);
  assert.equal(f.saved.boxes[0].desc,'日本語 and English user content');
  f.find(e=>e.tagName==='button'&&e.textContent==='Redo').onclick();
  assert.equal(f.editor.value,before);
});

test('validation messages switch language and do not modify layout data',()=>{
  const f=fixture('en'),before=f.editor.value;
  f.editor.setValue('{"version":2}');
  assert.match(f.find(e=>e.role==='status').textContent,/Load error: Expected version 1/);
  f.editor.setLocale('ja');
  assert.match(f.find(e=>e.role==='status').textContent,/読込エラー: version 1/);
  assert.equal(f.editor.value,before);
});

test('locale-triggered reconstruction restores editor session only for matching layout and dimensions',()=>{
  const f=fixture('en');
  input(f.find(e=>e.title==='Region description'),'New description');
  const session=f.editor.getSession(),restored=createEditor({locale:'ja'});
  restored.setValue(session.value);
  assert.equal(restored.restoreSession(session),true);
  const find=predicate=>all(restored.element).find(predicate);
  assert.equal(find(e=>e.className==='row').attrs['aria-pressed'],'true');
  find(e=>e.tagName==='button'&&e.textContent==='元に戻す').onclick();
  assert.equal(JSON.parse(restored.value).boxes[0].desc,'before');
  restored.setValue(session.value);
  assert.equal(restored.restoreSession({...session,width:2048}),false);
  assert.equal(restored.restoreSession({...session,value:'different layout'}),false);
});
