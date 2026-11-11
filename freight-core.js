(function (root) {
  const DEFAULT_RANGES = [[.05,.226],[.227,.311],[.312,.45],[.451,1],[1.001,3],[3.001,10]];
  const DEFAULT_RULES = {'普货':'USPH','潮玩':'USPH','带电':'USFC','带磁':'USFC','毛绒':'USMPPK','洞洞包':'USMPPK','包袋':'USMPPK','液体':'USTM','未分类':'USPH'};
  const DEFAULT_PACK = {'普货':[1.15,1.3],'潮玩':[1.25,1.4],'毛绒':[.75,1.2],'带电':[1.3,1.45],'包袋':[.95,1.15],'洞洞包':[1.05,1.2],'带磁':[1.2,1.3],'液体':[1.3,1.3]};
  const DEFAULT_CHANNELS = {
    USPH: { name:'美国普货快线(TK)', mode:'max', rates:[97,97,97,102,102,102], fees:[22,21,19,12,12,12] },
    USFC: { name:'美国带电快线(TK)', mode:'max', rates:[102,102,102,107,107,107], fees:[22,21,19,12,12,12] },
    USMPPK: { name:'USMPPK美国', mode:'actual', rates:[111,111,111,108,108,108], fees:[25,25,25,27,29,29] },
    USTM: { name:'美国特敏专线', mode:'max', ranges:[[.05,.2],[.201,.45],[.451,.7],[.701,1],[1.001,2],[2.001,5],[5.001,10]], rates:[100,100,100,100,100,100,100], fees:[35,35,50,50,49,49,49] }
  };
  const FREIGHT_DEFAULTS = { volumeDivisor:10000, minChargeWeight:.05, maxChargeWeight:10, hongKongSurcharge:1, hongKongForcedChannel:'USFC', hongKongExceptionChannel:'USTM', ranges:DEFAULT_RANGES, channels:DEFAULT_CHANNELS, rules:DEFAULT_RULES, pack:DEFAULT_PACK };
  const clone = value => JSON.parse(JSON.stringify(value));
  const normalizeConfig = config => {
    const value = config || FREIGHT_DEFAULTS;
    return { ...FREIGHT_DEFAULTS, ...value, ranges:value.ranges||FREIGHT_DEFAULTS.ranges, channels:value.channels||FREIGHT_DEFAULTS.channels, rules:value.rules||FREIGHT_DEFAULTS.rules, pack:value.pack||FREIGHT_DEFAULTS.pack };
  };
  const makeTiers = (ranges, rates, fees) => ranges.map(([min,max],index) => ({min,max,rate:rates[index],fee:fees[index]}));
  const channelMap = config => Object.fromEntries(Object.entries(config.channels).map(([code,channel]) => [code,{...channel,tiers:makeTiers(channel.ranges||config.ranges,channel.rates,channel.fees)}]));
  const RATES = channelMap(FREIGHT_DEFAULTS);
  const RULES = FREIGHT_DEFAULTS.rules;
  const PACK = FREIGHT_DEFAULTS.pack;
  const round2 = value => Math.round((value + Number.EPSILON)*100)/100;
  function quote(input) {
    for (const key of ['length','width','height','weight']) if (typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<=0||input[key]>1e6) throw Error('长宽高与实重必须为有效正数。');
    let {length,width,height,weight}=input;
    const config=normalizeConfig(input.config);
    const channels=channelMap(config);
    if (input.naked) {
      const [sizeFactor,weightFactor]=config.pack[input.attribute]||config.pack['普货'];
      length=round2(length*sizeFactor);width=round2(width*sizeFactor);height=round2(height*sizeFactor);weight=round2(weight*weightFactor);
    }
    if (![length,width,height,weight].every(value=>value>0)) throw Error('包装换算后尺寸或重量为0，请检查输入。');
    let code=config.rules[input.attribute]||'USPH';
    const hongKong=input.store==='香港店铺';
    if (hongKong&&code!==config.hongKongExceptionChannel) code=config.hongKongForcedChannel;
    const channel=channels[code]||channels.USPH;
    const volumeWeight=round2(length*width*height/config.volumeDivisor);
    const chargeWeight=round2(Math.max(channel.mode==='actual'?weight:Math.max(weight,volumeWeight),config.minChargeWeight));
    if (chargeWeight>config.maxChargeWeight) throw Error('计费重超过'+config.maxChargeWeight+'kg，需人工询价。');
    const tier=channel.tiers.find(tier=>chargeWeight>=tier.min-1e-9&&chargeWeight<=tier.max+1e-9);
    if (!tier) throw Error('未匹配到报价区间，需人工询价。');
    const extra=hongKong?config.hongKongSurcharge:0;
    return {code,name:channel.name,mode:channel.mode,length,width,height,weight,volumeWeight,chargeWeight,rate:tier.rate,fee:tier.fee,extra,cny:round2(chargeWeight*tier.rate+tier.fee+extra),naked:!!input.naked};
  }
  const api={quote,RATES,RULES,PACK,FREIGHT_DEFAULTS,clone,version:'2026.09.28-op',updatedAt:'2026-09-28'};
  root.FreightCore=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
