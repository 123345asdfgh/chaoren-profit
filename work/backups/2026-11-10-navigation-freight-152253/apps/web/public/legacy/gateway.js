(function(){
 'use strict';
 const entrance=document.getElementById('gateway'),canvas=document.getElementById('gateway-canvas'),globeButton=document.getElementById('gateway-globe'),skip=document.getElementById('gateway-skip'),status=document.getElementById('gateway-status'),main=document.querySelector('body>main'),compare=document.getElementById('compare-dialog');
 const context=canvas.getContext('2d');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let visible=false,turning=false,frame=0,longitude=90,startLongitude=90,started=0,last=0,size=500,timeout=0;
 const land=[];
 for(let latitude=-56;latitude<=82;latitude+=2.8){const step=2.8/Math.max(.25,Math.cos(latitude*Math.PI/180));for(let longitude=-178;longitude<=180;longitude+=step)if(GatewayCore.isLand(longitude,latitude))land.push([longitude,latitude]);}
 function resize(){
  if(!visible)return;
  size=canvas.getBoundingClientRect().width||500;
  const scale=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(size*scale);canvas.height=Math.round(size*scale);context?.setTransform(scale,0,0,scale,0,0);
  draw(0);
 }
 function draw(progress){
  if(!context)return;
  const center=size/2,radius=size*.355;context.clearRect(0,0,size,size);
  const haze=context.createRadialGradient(center,center,radius*.8,center,center,radius*1.38);haze.addColorStop(0,'#168dcb24');haze.addColorStop(.58,'#23b8f830');haze.addColorStop(1,'#0b8bc400');context.fillStyle=haze;context.fillRect(0,0,size,size);
  context.save();context.translate(center,center);context.rotate(-.19);context.scale(1,.35);context.beginPath();context.ellipse(0,0,radius*1.32,radius*1.32,0,0,Math.PI*2);context.strokeStyle='#4bc1e950';context.lineWidth=1;context.stroke();context.restore();
  const ocean=context.createRadialGradient(center-radius*.35,center-radius*.45,0,center,center,radius);ocean.addColorStop(0,'#133c61');ocean.addColorStop(.62,'#092540');ocean.addColorStop(1,'#010b18');context.beginPath();context.arc(center,center,radius,0,Math.PI*2);context.fillStyle=ocean;context.fill();
  context.save();context.beginPath();context.arc(center,center,radius,0,Math.PI*2);context.clip();
  function trace(points,color,width){context.beginPath();let active=false;for(const [lon,lat]of points){const point=GatewayCore.project(lon,lat,longitude);if(point.z>0){if(!active)context.moveTo(center+point.x*radius,center+point.y*radius);else context.lineTo(center+point.x*radius,center+point.y*radius);active=true;}else active=false;}context.strokeStyle=color;context.lineWidth=width;context.stroke();}
  for(let latitude=-60;latitude<=75;latitude+=15){const points=[];for(let lon=-180;lon<=180;lon+=2)points.push([lon,latitude]);trace(points,'#4ca1c626',.65);}
  for(let lon=-180;lon<180;lon+=20){const points=[];for(let lat=-90;lat<=90;lat+=2)points.push([lon,lat]);trace(points,'#4ca1c626',.65);}
  for(const [lon,lat]of land){const point=GatewayCore.project(lon,lat,longitude);if(point.z<=0)continue;context.beginPath();context.arc(center+point.x*radius,center+point.y*radius,Math.max(.5,size*.0021)*(.6+.4*point.z),0,Math.PI*2);context.fillStyle=`rgba(89,205,247,${.22+.7*point.z})`;context.fill();}
  const shade=context.createLinearGradient(center-radius,center,center+radius,center);shade.addColorStop(0,'#02101f00');shade.addColorStop(.5,'#02101f00');shade.addColorStop(1,'#000815b0');context.fillStyle=shade;context.fillRect(center-radius,center-radius,radius*2,radius*2);context.restore();
  context.beginPath();context.arc(center,center,radius,0,Math.PI*2);context.strokeStyle='#6bd5ff98';context.lineWidth=1.2;context.shadowBlur=15;context.shadowColor='#39bfff';context.stroke();context.shadowBlur=0;
  if(turning&&progress>.7){const pin=GatewayCore.project(-100,38,longitude);if(pin.z>0){const px=center+pin.x*radius,py=center+pin.y*radius;context.beginPath();context.arc(px,py,5,0,Math.PI*2);context.fillStyle='#f6d38c';context.shadowBlur=18;context.shadowColor='#ffe2a2';context.fill();context.shadowBlur=0;context.beginPath();context.arc(px,py,11+Math.min(1,(progress-.7)/.3)*8,0,Math.PI*2);context.strokeStyle='#f6d38c90';context.stroke();context.font=`500 ${Math.max(10,size*.024)}px sans-serif`;context.fillStyle='#e3f6ff';context.fillText('UNITED STATES',px+17,py-11);}}
 }
 function animate(now){
  if(!visible)return;
  const delta=last?Math.min(now-last,50):0;last=now;
  let progress=0;
  if(turning){progress=Math.min(1,(now-started)/1700);longitude=GatewayCore.rotate(progress,startLongitude,-100);if(progress===1){status.textContent='美国区域已定位 · 正在进入测算工作台';entrance.classList.add('gateway-locked');if(!timeout)timeout=window.setTimeout(dismiss,650);}}
  else if(!reduced.matches)longitude+=delta*.002;
  draw(progress);
  if(!reduced.matches||turning)frame=requestAnimationFrame(animate);
 }
 function dismiss(){
  if(!visible)return;
  visible=false;turning=false;cancelAnimationFrame(frame);clearTimeout(timeout);timeout=0;entrance.hidden=true;document.body.classList.remove('gateway-active');main.inert=false;compare.inert=false;main.hidden=false;globeButton.disabled=false;
  history.replaceState(null,'',location.pathname+location.search+'#calculator');document.querySelector('h1').setAttribute('tabindex','-1');document.querySelector('h1').focus({preventScroll:true});window.scrollTo(0,0);
 }
 function enter(){
  if(!visible||turning)return;
  if(reduced.matches||!context){dismiss();return;}
  turning=true;globeButton.disabled=true;started=performance.now();startLongitude=longitude;status.textContent='正在旋转地球 · 定位美国区域';skip.focus({preventScroll:true});
 }
 function open(){
  if(compare.open)compare.close();
  cancelAnimationFrame(frame);clearTimeout(timeout);timeout=0;visible=true;turning=false;longitude=90;last=0;globeButton.disabled=false;entrance.hidden=false;entrance.classList.remove('gateway-locked');main.inert=true;compare.inert=true;main.hidden=true;document.body.classList.add('gateway-active');status.textContent='点击地球，开启美区测算';resize();if(!reduced.matches)frame=requestAnimationFrame(animate);globeButton.focus({preventScroll:true});
 }
 globeButton.addEventListener('click',enter);skip.addEventListener('click',dismiss);document.getElementById('gateway-replay').addEventListener('click',()=>{history.replaceState(null,'',location.pathname+location.search+'#entry');open();});
 entrance.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dismiss();}});
 window.addEventListener('resize',resize);window.addEventListener('hashchange',()=>{if(location.hash==='#calculator')dismiss();else if(location.hash==='#entry')open();});
 reduced.addEventListener('change',()=>{if(!visible)return;if(turning){dismiss();return;}cancelAnimationFrame(frame);last=0;draw(0);if(!reduced.matches)frame=requestAnimationFrame(animate);});
 if(location.hash!=='#calculator')open();
})();
