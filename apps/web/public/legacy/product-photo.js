// Keep only a server photo ID in product and measurement snapshots.
(()=>{
 const field=get('photoId'),picker=get('product-photo-file'),button=get('choose-product-photo'),preview=get('product-photo-preview'),placeholder=get('product-photo-placeholder'),remove=get('remove-product-photo'),message=get('product-photo-message'),caption=get('product-photo-caption');
 let pending=null,controller=null,generation=0,failure='';
 function render(){
  const hasPhoto=Boolean(field.value);
  preview.hidden=!hasPhoto;placeholder.hidden=hasPhoto;remove.hidden=!hasPhoto;
  if(hasPhoto)preview.src='/api/profit/product-photos/'+encodeURIComponent(field.value);else preview.removeAttribute('src');
  button.setAttribute('aria-label',hasPhoto?'更换商品照片':'上传商品照片');
  caption.textContent=hasPhoto?'点击照片更换':'';
 }
 function reset(){generation++;controller?.abort();controller=null;pending=null;failure='';field.value='';picker.value='';button.disabled=false;message.textContent='';render()}
 button.addEventListener('click',()=>picker.click());
 remove.addEventListener('click',reset);
 picker.addEventListener('change',()=>{
  const file=picker.files?.[0];if(!file)return;
  const current=++generation;controller?.abort();controller=new AbortController();failure='';
  pending=(async()=>{
   try{
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 格式的照片。');
    if(file.size>5*1024*1024)throw Error('照片大小不能超过 5 MB。');
    if(!file.size)throw Error('照片文件为空，请重新选择。');
    button.disabled=true;message.classList.remove('input-error');message.textContent='照片上传中…';
    const response=await fetch('/api/profit/product-photos',{method:'POST',headers:{'content-type':'application/octet-stream'},body:file,signal:controller.signal});
    const data=await response.json();if(!response.ok)throw Error(data.error||'照片上传失败，请重试。');
    if(current!==generation)return;
    field.value=data.id;message.textContent='';render();
   }catch(error){if(current===generation&&error.name!=='AbortError'){failure=error.message;message.textContent=failure;message.classList.add('input-error')}}
   finally{if(current===generation){button.disabled=false;picker.value='';pending=null}}
  })();
 });
 preview.addEventListener('error',()=>{message.classList.add('input-error');message.textContent='照片加载失败，请更换照片或重试。'});
 window.ProductPhoto={render,reset,isPending:()=>Boolean(pending),async ready(){await pending;if(failure)throw Error(failure)}};
 render();
})();
