export type FreightConfig={maxWeight:number;routes:Record<string,string>;pack:Record<string,{size:number;weight:number}>;hongKong:{overrideChannel:string;preserveChannel:string;extraFee:number};channels:Record<string,{mode:string;volumeDivisor:number;minWeight:number;tiers:{min:number;max:number;rate:number;fee:number}[]}>};
export type FreightEstimate={code:string;cny:number;chargeWeight:number;volumeWeight:number;rate:number;fee:number;extra:number};
export default function FreightDetails({config}:{config?:FreightConfig}){
 if(!config)return <p className="history-config-note">此版本未记录物流配置。</p>;
 return <details className="history-freight-config"><summary>本版物流渠道与运价配置</summary>
  <h3>商品规则</h3><div className="table-wrap"><table><thead><tr><th>商品属性</th><th>默认渠道</th><th>裸货尺寸倍数</th><th>裸货重量倍数</th></tr></thead><tbody>{Object.entries(config.routes).map(([attribute,route])=><tr key={attribute}><td>{attribute}</td><td>{route}</td><td>{config.pack[attribute]?.size}</td><td>{config.pack[attribute]?.weight}</td></tr>)}</tbody></table></div>
  {Object.entries(config.channels).map(([code,channel])=><section key={code}><h3>{code} · 渠道运价</h3><dl className="history-detail-grid"><div><dt>计费方式</dt><dd>{channel.mode==='actual'?'仅按实重':'实重与材积重取大'}</dd></div><div><dt>材积除数</dt><dd>{channel.volumeDivisor}</dd></div><div><dt>最低计费重（kg）</dt><dd>{channel.minWeight}</dd></div></dl><div className="table-wrap"><table><thead><tr><th>重量范围（kg）</th><th>运价（元/kg）</th><th>票费（元）</th></tr></thead><tbody>{channel.tiers.map((tier,index)=><tr key={index}><td>{tier.min} ～ {tier.max}</td><td>{tier.rate}</td><td>{tier.fee}</td></tr>)}</tbody></table></div></section>)}
  <h3>店铺与限制</h3><dl className="history-detail-grid"><div><dt>香港改走渠道</dt><dd>{config.hongKong.overrideChannel}</dd></div><div><dt>保留原渠道</dt><dd>{config.hongKong.preserveChannel}</dd></div><div><dt>香港附加费（RMB）</dt><dd>{config.hongKong.extraFee}</dd></div><div><dt>最大计费重（kg）</dt><dd>{config.maxWeight}</dd></div></dl>
 </details>;
}
