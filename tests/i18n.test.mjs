import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveLocale,translate,english,createLocaleController} from '../web/i18n.js';

test('only Japanese locales select Japanese; others fall back to English',()=>{
  for(const value of ['ja','ja-JP','JA_jp'])assert.equal(resolveLocale(value),'ja');
  for(const value of ['en','en-US','fr','zh',null,undefined,'javanese'])assert.equal(resolveLocale(value),'en');
  assert.equal(translate('en','幅 {width}% · 高さ {height}%',{width:'50.0',height:'25.0'}),'Width 50.0% · Height 25.0%');
  for(const key of Object.keys(english))assert.equal(translate('ja',key),key);
});

test('Comfy.Locale change updates registered editors and new editors use current setting',()=>{
  let value='en',listener;
  const settings={getSettingValue:id=>{assert.equal(id,'Comfy.Locale');return value;},addEventListener:(name,fn)=>{assert.equal(name,'Comfy.Locale.change');listener=fn;}};
  const controller=createLocaleController(settings,'ja-JP'),updates=[];
  const editor={setLocale:locale=>updates.push(locale)};
  controller.register(editor);assert.deepEqual(updates,['en']);
  value='ja';listener({detail:{value}});assert.deepEqual(updates,['en','ja']);
  controller.register({setLocale:locale=>assert.equal(locale,'ja')});
  assert.equal(createLocaleController(null,'ja-JP').locale,'ja');
});

test('native node translations have matching input keys and positional output keys',()=>{
  const load=locale=>JSON.parse(readFileSync(new URL(`../locales/${locale}/nodeDefs.json`,import.meta.url),'utf8')).MossImageCreateBoundingBoxes;
  const en=load('en'),ja=load('ja');
  assert.deepEqual(Object.keys(en.inputs),['width','height','editor_state','background']);
  assert.deepEqual(Object.keys(en.inputs),Object.keys(ja.inputs));
  assert.deepEqual(Object.keys(en.outputs),['0','1','2','3','4']);
  assert.deepEqual(Object.keys(en.outputs),Object.keys(ja.outputs));
  assert.equal(en.display_name,'Create Bounding Boxes (MossImage)');
  assert.equal(ja.inputs.width.name,'幅');
});

test('locale session transfer supports repeated subgraph configuration without mixing node IDs',()=>{
  let listener;
  const controller=createLocaleController({getSettingValue:()=> 'en',addEventListener:(_,fn)=>{listener=fn;}});
  const node={id:7,graph:{id:'subgraph-id'}},session={value:'layout',cursor:3};
  const oldEditor={getSession:()=>session,setLocale(){}};
  controller.register(oldEditor,node);listener({detail:{value:'ja'}});
  let restored=0;
  const newEditor={restoreSession:saved=>{assert.equal(saved,session);restored++;return true;}};
  controller.restore(newEditor,{id:8,graph:node.graph});assert.equal(restored,0);
  controller.restore(newEditor,node);controller.restore(newEditor,node);assert.equal(restored,2);
});
