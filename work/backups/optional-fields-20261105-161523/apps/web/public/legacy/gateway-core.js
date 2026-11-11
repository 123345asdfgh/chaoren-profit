(function(root){
 'use strict';
 const radians=Math.PI/180;
 const continents=[
  [[-168,66],[-160,70],[-145,70],[-137,60],[-128,55],[-124,48],[-123,40],[-117,32],[-111,29],[-105,23],[-99,19],[-90,21],[-86,16],[-83,9],[-78,8],[-82,15],[-88,22],[-82,25],[-80,31],[-75,35],[-70,42],[-61,47],[-55,53],[-64,60],[-79,63],[-85,70],[-100,74],[-122,73],[-140,69]],
  [[-73,59],[-49,60],[-24,70],[-20,80],[-42,84],[-58,80],[-67,70]],
  [[-81,12],[-71,11],[-62,8],[-51,3],[-35,-6],[-39,-18],[-47,-25],[-54,-34],[-64,-55],[-72,-50],[-75,-35],[-71,-20],[-77,-6]],
  [[-17,32],[-5,36],[10,37],[25,32],[34,30],[43,12],[51,11],[43,-11],[34,-25],[18,-35],[10,-23],[11,-5],[0,5],[-15,11],[-17,22]],
  [[-10,36],[-9,44],[-1,49],[8,54],[4,59],[17,71],[30,70],[42,67],[60,70],[87,76],[116,73],[141,71],[166,65],[179,64],[173,56],[153,50],[143,45],[135,35],[126,39],[121,29],[112,21],[108,10],[103,2],[98,9],[99,20],[91,22],[80,8],[75,19],[67,25],[58,24],[51,13],[43,15],[36,29],[28,36],[22,40],[17,38],[12,43],[5,43],[0,38]],
  [[112,-11],[129,-12],[137,-16],[145,-15],[153,-27],[145,-39],[131,-32],[115,-35]],
  [[46,-13],[50,-15],[49,-25],[44,-24]],[[130,32],[137,36],[142,44],[145,44],[141,35]],[[96,5],[105,-6],[115,-8],[128,-4],[120,4]],[[166,-35],[178,-39],[171,-47],[166,-44]]
 ];
 function project(longitude,latitude,centerLongitude,centerLatitude=20){
  const delta=(longitude-centerLongitude)*radians,lat=latitude*radians,tilt=centerLatitude*radians;
  return {x:Math.cos(lat)*Math.sin(delta),y:-(Math.cos(tilt)*Math.sin(lat)-Math.sin(tilt)*Math.cos(lat)*Math.cos(delta)),z:Math.sin(tilt)*Math.sin(lat)+Math.cos(tilt)*Math.cos(lat)*Math.cos(delta)};
 }
 function isLand(longitude,latitude){
  return continents.some(polygon=>{
   let inside=false;
   for(let index=0,previous=polygon.length-1;index<polygon.length;previous=index++){
    const [currentLon,currentLat]=polygon[index],[previousLon,previousLat]=polygon[previous];
    if((currentLat>latitude)!==(previousLat>latitude)&&longitude<(previousLon-currentLon)*(latitude-currentLat)/(previousLat-currentLat)+currentLon)inside=!inside;
   }
   return inside;
  });
 }
 function rotate(progress,start=90,end=-100){const bounded=Math.max(0,Math.min(1,progress));return start+(end-start)*(1-Math.pow(1-bounded,3));}
 const api={project,isLand,rotate};root.GatewayCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
