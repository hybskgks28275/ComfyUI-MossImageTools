import {test} from 'node:test';
import assert from 'node:assert/strict';
import {linkedDimensions,syncLinkedDimensions,HYBS_SELECTOR_ID} from '../web/dimensions.js';

function fixture(){
  const source={id:2,type:HYBS_SELECTOR_ID,widgets:[{name:'resolution',value:'896x1152'}],inputs:[]};
  const graph={links:new Map([[5,{origin_id:2,origin_slot:0}],[6,{origin_id:2,origin_slot:1}]]),getNodeById:id=>id===2?source:null};
  const node={graph,inputs:[{name:'width',link:5},{name:'height',link:6}],widgets:[{name:'width',value:1024},{name:'height',value:768}]};
  return {node,source,graph};
}

test('HYBS selection is available without executing and changes both dimensions',()=>{
  const {node,source}=fixture();
  assert.deepEqual(linkedDimensions(node),[896,1152]);
  source.widgets[0].value='1728x1344';
  assert.deepEqual(linkedDimensions(node),[1728,1344]);
});

test('output slot determines the dimension, including swapped connections',()=>{
  const {node,graph}=fixture();
  graph.links.get(5).origin_slot=1;graph.links.get(6).origin_slot=0;
  assert.deepEqual(linkedDimensions(node),[1152,896]);
});

test('unconnected input retains its manual dimension and object link maps work',()=>{
  const {node,graph}=fixture();
  node.inputs[1].link=null;
  graph.links=Object.fromEntries(graph.links);
  assert.deepEqual(linkedDimensions(node),[896,768]);
});

test('unknown, invalid, or dynamically linked source is left for execution',()=>{
  const {node,source}=fixture();
  source.type='HYBS_RandomResolutionSelector';
  assert.deepEqual(linkedDimensions(node),[1024,768]);
  source.type=HYBS_SELECTOR_ID;source.widgets[0].value='section heading';
  assert.deepEqual(linkedDimensions(node),[1024,768]);
  source.widgets[0].value='896x1152';source.inputs=[{name:'resolution',link:99}];
  assert.deepEqual(linkedDimensions(node),[1024,768]);
});

test('sync writes both fallback widgets before updating the editor',()=>{
  const {node,source}=fixture();
  node._mossEditor={setDimensions:(width,height)=>assert.deepEqual(node.widgets.map(w=>w.value),[width,height])};
  syncLinkedDimensions(node);
  assert.deepEqual(node.widgets.map(w=>w.value),[896,1152]);
  source.widgets[0].value='1024x1024';syncLinkedDimensions(node);
  assert.deepEqual(node.widgets.map(w=>w.value),[1024,1024]);
});
