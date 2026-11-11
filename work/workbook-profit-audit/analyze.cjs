const fs=require('node:fs');
const core=require('../../apps/web/public/legacy/core.js');
const source=JSON.parse(fs.readFileSync(__dirname+'/source.json','utf8'));
const rawFx=process.argv.includes('--raw-fx');
const estimatedFx=rawFx||process.argv.includes('--estimated-fx');
const settings=estimatedFx?core.DEFAULTS:JSON.parse(fs.readFileSync(__dirname+'/settings.json','utf8')).fields;
const params=Object.fromEntries(Object.entries(core.DEFAULTS).map(([k])=>[k,Number(settings[k])]));
const numeric=v=>typeof v==='number'&&Number.isFinite(v),round=(n,d=2)=>Math.round((n+Number.EPSILON)*10**d)/10**d;
const audit=source.map(r=>{
 const a=r.values,missing=[['中国组合价',3],['申请价格',6],['买家运费',7],['物流费用',17]].filter(([,i])=>!numeric(a[i])).map(([name])=>name);
 const fx=rawFx?a[9]/a[8]:round(a[9]/a[8],1),revenue=a[10],cost=a[11];
 if(!numeric(fx)||fx<=0||Math.abs(a[9]-a[8]*fx)>.00501)throw Error('无法从原表金额确认汇率，第'+r.row+'行');
 const actual=missing.length?null:core.calculate({...params,fx:estimatedFx?fx:params.fx,chinaPrice:a[3],salePrice:a[6],buyerShipping:a[7],receipt:a[6]+a[7],logistics:a[17],currency:'RMB'});
 const rates={promotion:round(a[13]/revenue*100,0),operation:round(a[14]/revenue*100,0),platform:round(a[15]/revenue*100,0),labor:round(a[18]/revenue*100,0),other:round(a[19]/revenue*100,0)};
 const royaltyBasis=Math.abs(a[16]-cost*.07)<.011?'成本7%':'收入4%';
 const standardized={...params,...rates,fx,royalty:royaltyBasis==='成本7%'?7:4};
 const diagnosticInput={...standardized,chinaPrice:a[3],salePrice:a[6]??0,buyerShipping:a[7]??0,receipt:(a[6]??0)+(a[7]??0),logistics:a[17]??0,currency:'RMB'};
 const reconstruct=core.calculate(diagnosticInput);
 if(royaltyBasis==='收入4%'){
  const difference=reconstruct.revenueRmb*.04-reconstruct.costRmb*.04;
  reconstruct.pretaxUsd-=difference/fx;
 }
 const pretax=reconstruct.pretaxUsd*fx;
 // Diagnostic only: the workbook's negative tax values indicate a 25% loss tax credit.
 const reconstructedNet=pretax*.75;
 const reconstructedMargin=reconstructedNet/reconstruct.revenueRmb;
 const bookArithmetic=a[10]-a[11]-[13,14,15,16,17,18,19].reduce((s,i)=>s+(a[i]??0),0);
 const reasons=[];
 if(!estimatedFx&&fx!==params.fx)reasons.push(`汇率${fx}（项目${params.fx}）`);
 if(rates.promotion!==params.promotion)reasons.push(`推广${rates.promotion}%（项目${params.promotion}%）`);
 if(rates.platform!==params.platform)reasons.push(`平台${rates.platform}%（项目${params.platform}%）`);
 if(royaltyBasis!=='成本7%'||params.royalty!==7)reasons.push(royaltyBasis==='成本7%'?`版权按成本7%（本次${params.royalty}%）`:`版权按收入4%（本次按成本${params.royalty}%）`);
 if(a[20]<0)reasons.push('原表亏损仍计负所得税，项目亏损税为0');
 if(missing.length)reasons.unshift('缺少'+missing.join('、'));
 const match=actual?round(actual.netRmb)===a[22]&&round(actual.margin,4)===a[23]:null;
 const fxLower=(a[9]-.005)/a[8],fxUpper=(a[9]+.005)/a[8],revenueFx=a[10]*params.divisor/a[8];
 let jointLower=null,jointUpper=null,roundingPossible=false;
 if(actual){
  const usd=a[6]+a[7],base=usd/params.divisor;
  const retained=1-['promotion','operation','platform','labor','other'].reduce((sum,key)=>sum+params[key],0)/100;
  const fixed=a[3]*params.costRate/100*(1+params.royalty/100)+a[17];
  const taxFactor=net=>net>0?1-params.tax/100:1;
  const profitFx=net=>(fixed+net/taxFactor(net))/(base*retained);
  const marginFx=margin=>fixed/(base*(retained-margin/taxFactor(margin)));
  jointLower=Math.max(fxLower,(a[10]-.005)*params.divisor/usd,profitFx(a[22]-.005),marginFx(a[23]-.00005));
  jointUpper=Math.min(fxUpper,(a[10]+.005)*params.divisor/usd,profitFx(a[22]+.005),marginFx(a[23]+.00005));
  roundingPossible=jointUpper>jointLower;
  if(!roundingPossible){jointLower=null;jointUpper=null;}
  if(rawFx&&match&&!roundingPossible)throw Error('显示一致但原始金额无共同舍入范围，第'+r.row+'行');
 }
 const status=missing.length?'缺项待确认':match?'一致':rawFx&&roundingPossible?'舍入边界':'参数差异';
 if(rawFx&&status==='舍入边界')reasons.unshift('原表金额仅保留两位；未取整汇率直接复算存在显示差异，但同一汇率可在舍入范围内同时对齐各项');
 if(rawFx&&status==='一致'&&!reasons.length)reasons.push('按本行原始汇率比值计算，利润与利润率均一致');
 return {sheet:r.sheet,row:r.row,code:String(a[1]),name:a[2],values:a,missing,actual,fx,fxLower,fxUpper,revenueFx,jointLower,jointUpper,roundingPossible,status,rates,royaltyBasis,reconstructedNet,reconstructedMargin,reconstructedNetDelta:reconstructedNet-a[22],reconstructedMarginDelta:reconstructedMargin-a[23],bookPretaxArithmeticDelta:bookArithmetic-a[20],reasons,delta:actual?actual.netRmb-a[22]:null,marginDelta:actual?actual.margin-a[23]:null,match};
});
const complete=audit.filter(r=>r.actual),incomplete=audit.filter(r=>!r.actual);
const summary={params,total:audit.length,complete:complete.length,incomplete:incomplete.map(r=>({row:r.row,name:r.name,missing:r.missing})),matches:complete.filter(r=>r.match).length,profitMatches:complete.filter(r=>round(r.actual.netRmb)===r.values[22]).length,marginMatches:complete.filter(r=>round(r.actual.margin,4)===r.values[23]).length,maxNetDelta:Math.max(...complete.map(r=>Math.abs(r.delta))),maxMarginDelta:Math.max(...complete.map(r=>Math.abs(r.marginDelta))),parameterReconstructionExact:audit.filter(r=>round(r.reconstructedNet)===r.values[22]&&round(r.reconstructedMargin,4)===r.values[23]).length,parameterReconstructionWithin1Cent:audit.filter(r=>Math.abs(r.reconstructedNetDelta)<.01001&&Math.abs(r.reconstructedMarginDelta)<=.00010001).length,parameterReconstructionOutliers:audit.filter(r=>Math.abs(r.reconstructedNetDelta)>.01001||Math.abs(r.reconstructedMarginDelta)>.00010001).map(r=>({row:r.row,delta:r.reconstructedNetDelta,rateDelta:r.reconstructedMarginDelta})),feeCases:audit.filter(r=>r.rates.platform!==7||r.rates.promotion===27||r.values[20]<0).map(r=>({row:r.row,rates:r.rates,pretax:r.values[20],tax:r.values[21],net:r.values[22]})),sample:complete.slice(0,5).map(r=>({row:r.row,name:r.name,bookNet:r.values[22],actualNet:round(r.actual.netRmb),bookMargin:r.values[23],actualMargin:round(r.actual.margin,4),delta:round(r.delta),reconstructedNet:round(r.reconstructedNet),reconstructedMargin:round(r.reconstructedMargin,4)}))};
summary.fxMethod=rawFx?'逐行以原表人民币GMV÷美元含税实收反推，不取整、不分组、不舍入；原表金额仅两位，所得比值为隐含汇率估计':estimatedFx?'原表人民币GMV÷原表美元含税实收，按一位小数估算；校验汇差不超过0.00501元':'统一汇率';
summary.fxDistribution=audit.reduce((counts,r)=>(counts[r.fx]=(counts[r.fx]||0)+1,counts),{});
summary.differenceGroups=complete.filter(r=>!r.match).reduce((counts,r)=>{const key=r.reasons.join('；');counts[key]=(counts[key]||0)+1;return counts;},{});
summary.statusCounts=audit.reduce((counts,r)=>(counts[r.status]=(counts[r.status]||0)+1,counts),{});
summary.roundingBoundaryRows=audit.filter(r=>r.status==='舍入边界').map(r=>({row:r.row,name:r.name,fx:r.fx,net:r.actual.netRmb,margin:r.actual.margin,jointLower:r.jointLower,jointUpper:r.jointUpper}));
fs.writeFileSync(__dirname+(rawFx?'/audit-raw-fx.json':estimatedFx?'/audit-estimated-fx.json':'/audit.json'),JSON.stringify({summary,rows:audit},null,2));
console.log(JSON.stringify(summary,null,2));
