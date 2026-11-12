(function(root){
  const cache = new Map();
  function local(timestamp, zone) {
    if (!cache.has(zone)) cache.set(zone, new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
    const fields = Object.fromEntries(cache.get(zone).formatToParts(timestamp).map(part => [part.type,part.value]));
    return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}`;
  }
  function offset(timestamp,zone){return (Date.parse(local(timestamp,zone)+'Z')-Math.floor(timestamp/1000)*1000)/60000;}
  function resolve(value,zone){
    const normalized=value.length===16?value+':00':value;
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized))return [];
    const naive=Date.parse(normalized+'Z');
    if(!Number.isFinite(naive))return [];
    const offsets=new Set([-48,-24,0,24,48].map(hours=>offset(naive+hours*3600000,zone)));
    return [...offsets].map(minutes=>naive-minutes*60000).filter(timestamp=>local(timestamp,zone)===normalized).sort((first,second)=>first-second);
  }
  function phase(timestamp,zone){
    const hour=Number(local(timestamp,zone).slice(11,13));
    if(hour<6||hour>=19)return 'night';
    if(hour<12)return 'morning';
    if(hour<17)return 'noon';
    return 'dusk';
  }
  root.TimeCore={local,offset,resolve,phase};
  if(typeof module!=='undefined')module.exports=root.TimeCore;
})(globalThis);
