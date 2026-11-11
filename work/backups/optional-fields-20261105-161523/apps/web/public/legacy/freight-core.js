(function (root) {
  const ranges = [[.05,.226],[.227,.311],[.312,.45],[.451,1],[1.001,3],[3.001,10]];
  const tiers = (rates, fees) => ranges.map(([min,max],i)=>({min,max,rate:rates[i],fee:fees[i]}));
  const DEFAULT_CONFIG = {
    maxWeight:10,
    channels:{
      USPH:{mode:'max',volumeDivisor:10000,minWeight:.05,tiers:tiers([97,97,97,102,102,102],[22,21,19,12,12,12])},
      USFC:{mode:'max',volumeDivisor:10000,minWeight:.05,tiers:tiers([102,102,102,107,107,107],[22,21,19,12,12,12])},
      USMPPK:{mode:'actual',volumeDivisor:10000,minWeight:.05,tiers:tiers([111,111,111,108,108,108],[25,25,25,27,29,29])},
      USTM:{mode:'max',volumeDivisor:10000,minWeight:.05,tiers:[
        {min:.05,max:.2,rate:100,fee:35},{min:.201,max:.45,rate:100,fee:35},
        {min:.451,max:.7,rate:100,fee:50},{min:.701,max:1,rate:100,fee:50},
        {min:1.001,max:2,rate:100,fee:49},{min:2.001,max:5,rate:100,fee:49},
        {min:5.001,max:10,rate:100,fee:49}
      ]}
    },
    routes:{'普货':'USPH','潮玩':'USPH','带电':'USFC','带磁':'USFC','毛绒':'USMPPK','洞洞包':'USMPPK','包袋':'USMPPK','液体':'USTM'},
    pack:{'普货':{size:1.15,weight:1.3},'潮玩':{size:1.25,weight:1.4},'毛绒':{size:.75,weight:1.2},'带电':{size:1.3,weight:1.45},'包袋':{size:.95,weight:1.15},'洞洞包':{size:1.05,weight:1.2},'带磁':{size:1.2,weight:1.3},'液体':{size:1.3,weight:1.3}},
    hongKong:{overrideChannel:'USFC',preserveChannel:'USTM',extraFee:1}
  };
  const cloneConfig=config=>JSON.parse(JSON.stringify(config));
  const round2=value=>Math.round((value+Number.EPSILON)*100)/100;
  const RULES=DEFAULT_CONFIG.routes,PACK=DEFAULT_CONFIG.pack,RATES=DEFAULT_CONFIG.channels;
  function quote(input,config=DEFAULT_CONFIG){
    for(const key of ['length','width','height','weight'])if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<=0||input[key]>1e6)throw Error('长宽高与实重必须为有效正数。');
    let {length,width,height,weight}=input;
    const attribute=Object.hasOwn(config.routes,input.attribute)?input.attribute:'普货';
    if(input.naked){
      const factor=config.pack[attribute];
      length=round2(length*factor.size);width=round2(width*factor.size);height=round2(height*factor.size);weight=round2(weight*factor.weight);
    }
    if(![length,width,height,weight].every(value=>value>0))throw Error('包装换算后尺寸或重量为0，请检查输入。');
    const store=input.store==='香港店铺'?'香港店铺':'广州店铺';
    const route=config.routes[attribute];
    const code=store==='香港店铺'&&route!==config.hongKong.preserveChannel?config.hongKong.overrideChannel:route;
    const channel=config.channels[code];
    const volumeWeight=round2(length*width*height/channel.volumeDivisor);
    const chargeWeight=round2(Math.max(channel.mode==='actual'?weight:Math.max(weight,volumeWeight),channel.minWeight));
    const tier=[...channel.tiers].sort((a,b)=>a.min-b.min).find(t=>chargeWeight>=t.min-1e-9&&chargeWeight<=t.max+1e-9);
    if(!tier||chargeWeight>config.maxWeight)throw Error(chargeWeight>config.maxWeight?`计费重超过${config.maxWeight}kg，需人工询价。`:'未匹配到报价区间，需人工询价。');
    const extra=store==='香港店铺'?config.hongKong.extraFee:0;
    const cny=round2(chargeWeight*tier.rate+tier.fee+extra);
    return {code,mode:channel.mode,store,attribute,length,width,height,weight,volumeWeight,chargeWeight,rate:tier.rate,fee:tier.fee,extra,cny,naked:!!input.naked};
  }
  const api={quote,RATES,RULES,PACK,DEFAULT_CONFIG,cloneConfig,version:'2026.10.26',updatedAt:'2026-10-26'};
  root.FreightCore=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
