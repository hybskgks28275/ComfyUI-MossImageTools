import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';
import { createEditor } from './editor.js';
import { MOSS_NODE_ID,HYBS_SELECTOR_ID,syncLinkedDimensions,syncMossNodes } from './dimensions.js';

app.registerExtension({
  name:'MossImageTools.LayoutEditor',
  afterConfigureGraph(){syncMossNodes(app.graph);},
  async beforeRegisterNodeDef(nodeType,nodeData){
    if(nodeData.name===HYBS_SELECTOR_ID){
      const created=nodeType.prototype.onNodeCreated;
      nodeType.prototype.onNodeCreated=function(...args){
        const result=created?.apply(this,args);
        const resolution=this.widgets?.find(widget=>widget.name==='resolution');
        if(resolution){
          const callback=resolution.callback,node=this;
          resolution.callback=function(...args){
            const result=callback?.apply(this,args);
            queueMicrotask(()=>syncMossNodes(node.graph));
            return result;
          };
        }
        return result;
      };
      const configure=nodeType.prototype.onConfigure;
      nodeType.prototype.onConfigure=function(...args){const result=configure?.apply(this,args);queueMicrotask(()=>syncMossNodes(this.graph));return result;};
      return;
    }
    if(nodeData.name!==MOSS_NODE_ID)return;
    const created=nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated=function(...args){
      const result=created?.apply(this,args);
      const state=this.widgets.find(w=>w.name==='editor_state');
      const width=this.widgets.find(w=>w.name==='width'),height=this.widgets.find(w=>w.name==='height');
      // The original STRING is the single persisted workflow and API input.
      state.hidden=true;state.type='hidden';state.computeSize=()=>[0,-4];
      const editor=createEditor({width:width.value,height:height.value,onChange:raw=>{
        const graph=this.graph;graph?.beforeChange?.();state.value=raw;state.callback?.(raw);graph?.afterChange?.();this.setDirtyCanvas?.(true,true);
      }});
      editor.setValue(state.value);
      const widget=this.addDOMWidget('moss_layout_editor','moss_layout_editor',editor.element,{
        serialize:false,hideOnZoom:false,getMinHeight:()=>660,getMaxHeight:()=>1000,
      });
      widget.serialize=false;
      for(const dimension of [width,height]){const callback=dimension.callback;dimension.callback=(...a)=>{const r=callback?.apply(dimension,a);editor.setDimensions(Number(width.value),Number(height.value));return r;};}
      this._mossEditor=editor;
      queueMicrotask(()=>syncLinkedDimensions(this));
      this.setSize([Math.max(this.size[0],760),Math.max(this.size[1],780)]);
      return result;
    };
    const configure=nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure=function(...args){const r=configure?.apply(this,args);const w=this.widgets.find(w=>w.name==='width'),h=this.widgets.find(w=>w.name==='height');const saved=this.widgets.find(w=>w.name==='editor_state').value;this._mossEditor?.setDimensions(Number(w.value),Number(h.value));this.widgets.find(w=>w.name==='editor_state').value=saved;this._mossEditor?.setValue(saved);queueMicrotask(()=>syncLinkedDimensions(this));return r;};
    const connectionsChanged=nodeType.prototype.onConnectionsChange;
    nodeType.prototype.onConnectionsChange=function(...args){const result=connectionsChanged?.apply(this,args);queueMicrotask(()=>syncLinkedDimensions(this));return result;};
    const executed=nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted=function(message,...args){
      const r=executed?.call(this,message,...args);
      const dims=message?.dims;
      if(Array.isArray(dims)&&dims.length===2&&dims.every(value=>Number.isInteger(value)&&value>0)){
        const width=this.widgets.find(w=>w.name==='width'),height=this.widgets.find(w=>w.name==='height');
        // Upstream inputs resolve on the server; widget callbacks do not run for them.
        width.value=dims[0];height.value=dims[1];
        this._mossEditor?.setDimensions(dims[0],dims[1]);
        this.setDirtyCanvas?.(true,true);
      }
      const image=message?.background_images?.[0];
      this._mossEditor?.setBackground(image?api.apiURL(`/view?${new URLSearchParams(image)}`):null);
      return r;
    };
    // ComfyUI owns the DOM widget lifecycle. Graph Undo can reuse a removed node
    // and its widgets, so detaching the editor in onRemoved breaks restoration.
  },
});
