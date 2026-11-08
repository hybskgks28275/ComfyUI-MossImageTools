import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,emptyState,hits,cycleHit,snap} from '../web/model.js';
const box=(id,x=0,y=0,w=512,h=512)=>({id,x,y,width:w,height:h,type:'obj',palette:[]});
test('overlap cycles through every region, including fully obscured ones',()=>{
  const boxes=[box('back'),box('middle'),box('front')];
  assert.deepEqual(hits(boxes,200,200).map(b=>b.id),['front','middle','back']);
  assert.equal(cycleHit(boxes,200,200,null),'front');
  assert.equal(cycleHit(boxes,200,200,'front'),'middle');
  assert.equal(cycleHit(boxes,200,200,'middle'),'back');
  assert.equal(cycleHit(boxes,200,200,'back'),'front');
});
test('state survives JSON round trip with text, palette, grid',()=>{
  const state={...emptyState(),boxes:[{...box('text'),type:'text',text:'森のポスター',desc:'見出し',palette:['#123ABC']}],grid:{...emptyState().grid,cols:12,rows:6,snap:false}};
  assert.deepEqual(normalize(JSON.stringify(state),1024,1024),state);
});
test('reverse drag, boundary clamps, duplicate IDs, invalid JSON',()=>{
  const s=normalize({...emptyState(),boxes:[box('same',800,800,-400,-200),box('same',1000,1000,100,100)]},1024,1024);
  assert.deepEqual([s.boxes[0].x,s.boxes[0].y,s.boxes[0].width,s.boxes[0].height],[400,600,400,200]);
  assert.equal(s.boxes[1].width,24);assert.notEqual(s.boxes[0].id,s.boxes[1].id);
  assert.throws(()=>normalize('{',1024,1024));
  assert.throws(()=>normalize({...emptyState(),boxes:[box('bad',NaN)]},1024,1024));
});
test('grid snap uses independent rectangular axes and clamps edges',()=>{
  assert.equal(snap(180,1024,8,true),128);
  assert.equal(snap(180,768,6,true),128);
  assert.equal(snap(180,1024,8,false),180);
  assert.equal(snap(2000,1024,8,true),1024);
});
test('new layouts default to 32 by 32 with persisted grid colors',()=>{
  const state=emptyState();
  assert.equal(state.grid.cols,32);assert.equal(state.grid.rows,32);
  state.grid.background='#ffffff';state.grid.alternate='#dddddd';
  assert.deepEqual(normalize(JSON.stringify(state),1024,1024),state);
});
test('older workflows retain grid dimensions and gain default colors',()=>{
  const state=normalize({version:1,boxes:[],grid:{cols:8,rows:6,snap:false}},1024,768);
  assert.equal(state.grid.cols,8);assert.equal(state.grid.rows,6);
  assert.equal(state.grid.background,'#1d2939');assert.equal(state.grid.alternate,'#253247');
  assert.equal(state.grid.snap,false);
  assert.equal(normalize({version:1,boxes:[],grid:{background:'invalid'}},1024,1024).grid.background,'#1d2939');
});
