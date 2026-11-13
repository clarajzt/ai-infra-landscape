(() => {
  const one={rounds:'round',deals:'deal',companies:'company',buyers:'buyer',entries:'entry',events:'event',observations:'observation',records:'record',segments:'segment'};
  const pattern=/(^|[^\d.,/–-])1 ((?:comparable |announced |financial |public )?)(rounds|deals|companies|buyers|entries|events|observations|records|segments)\b/g;
  const fix=node=>{const text=node.nodeValue,next=text.replace(pattern,(m,a,b,c)=>a+'1 '+b+one[c]);if(next!==text)node.nodeValue=next;};
  const walk=root=>{if(root.nodeType===3)return fix(root);const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(w.nextNode())fix(w.currentNode);};
  new MutationObserver(list=>{for(const m of list){if(m.type==='characterData')fix(m.target);for(const n of m.addedNodes)if(n.nodeType===1||n.nodeType===3)walk(n);}}).observe(document.body,{childList:true,subtree:true,characterData:true});
  walk(document.body);
})();
