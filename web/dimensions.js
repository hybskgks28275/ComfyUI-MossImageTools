export const MOSS_NODE_ID='MossImageCreateBoundingBoxes';
export const HYBS_SELECTOR_ID='HYBS_ResolutionSelector';

function connectedValue(node,name){
  const input=node.inputs?.find(input=>input.name===name);
  if(input?.link==null)return null;
  const graph=node.graph;
  const link=graph?.links?.get?.(input.link)??graph?.links?.[input.link];
  if(!link)return null;
  const source=graph.getNodeById(link.origin_id);
  if((source?.comfyClass??source?.type)!==HYBS_SELECTOR_ID)return null;
  // A linked resolution string is only known after executing its upstream node.
  if(source.inputs?.some(input=>input.name==='resolution'&&input.link!=null))return null;
  const value=source.widgets?.find(widget=>widget.name==='resolution')?.value;
  const match=typeof value==='string'?value.match(/^(\d+)x(\d+)$/):null;
  if(!match||![0,1].includes(link.origin_slot))return null;
  const dimension=Number(match[link.origin_slot+1]);
  return Number.isSafeInteger(dimension)&&dimension>0?dimension:null;
}

export function linkedDimensions(node){
  return ['width','height'].map(name=>connectedValue(node,name)??Number(node.widgets?.find(widget=>widget.name===name)?.value));
}

export function syncLinkedDimensions(node){
  if(!node._mossEditor)return;
  const dims=linkedDimensions(node);
  if(!dims.every(value=>Number.isSafeInteger(value)&&value>0))return;
  node.widgets.find(widget=>widget.name==='width').value=dims[0];
  node.widgets.find(widget=>widget.name==='height').value=dims[1];
  node._mossEditor.setDimensions(...dims);
  node.setDirtyCanvas?.(true,true);
}

export function syncMossNodes(graph){
  for(const node of graph?._nodes??[]){
    if((node.comfyClass??node.type)===MOSS_NODE_ID)syncLinkedDimensions(node);
  }
}
