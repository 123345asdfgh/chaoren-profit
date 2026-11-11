const toolSection=document.querySelector('main > .prep-grid');
const freightCard=toolSection.querySelector('.card');
let activeTool=null;
let toolReturnFocus=null;

function closeTool(){
 if(!activeTool)return;
 activeTool.hidden=true;
 activeTool=null;
 document.body.classList.remove('tool-modal-open');
 toolReturnFocus?.focus();
 toolReturnFocus=null;
}

for(const [name,card,firstInput]of [['freight',freightCard,'length']]){
 const overlay=document.getElementById(name+'-tool-overlay');
 card.querySelector('h2').id=name+'-tool-title';
 document.getElementById(name+'-tool-content').append(card);
 const trigger=document.getElementById('open-'+name+'-tool');
 trigger.addEventListener('click',()=>{
  toolReturnFocus=trigger;
  activeTool=overlay;
  overlay.hidden=false;
  document.body.classList.add('tool-modal-open');
  updateFreightQuote();
  document.getElementById(firstInput).focus();
 });
 overlay.querySelector('[data-close-tool]').addEventListener('click',closeTool);
 overlay.addEventListener('click',event=>{if(event.target===overlay)closeTool()});
}
document.addEventListener('keydown',event=>{
 if(!activeTool)return;
 if(event.key==='Escape'){event.preventDefault();closeTool();return}
 if(event.key!=='Tab')return;
 const focusable=[...activeTool.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')];
 const first=focusable[0],last=focusable.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});

document.getElementById('adopt-quote').addEventListener('click',closeTool);
