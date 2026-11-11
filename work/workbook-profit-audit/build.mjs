import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const rawFx=process.argv.includes('--raw-fx');
const estimatedFx=rawFx||process.argv.includes('--estimated-fx');
const {summary,rows}=JSON.parse(await fs.readFile(new URL(rawFx?'./audit-raw-fx.json':estimatedFx?'./audit-estimated-fx.json':'./audit.json',import.meta.url),'utf8'));
const outputDir=fileURLToPath(new URL(rawFx?'./outputs/profit-audit-20261105-row-raw-fx/':estimatedFx?'./outputs/profit-audit-20261105-estimated-fx/':'./outputs/profit-audit-20261105-a8c67d/',import.meta.url));
const buildEnd=rawFx?'BN':'BB';
const wb=Workbook.create(),out=wb.worksheets.add('逐条核对'),build=wb.worksheets.add('输入与计算');
const first=12,last=first+rows.length-1;
const color={ink:'#263347',orange:'#AD4A16',header:'#925026',pale:'#FFF2DF',line:'#DCCFBC',red:'#B42318'};
const amount='#,##0.00;(#,##0.00);0.00',rate='0.00%;(0.00%);0.00%';
for(const s of [out,build]){
 s.showGridLines=false;s.getRange(`A1:${s===out?'N':buildEnd}${last}`).format.font={name:'Arial',size:10,color:color.ink};
 s.getRange(`A1:${s===out?'N':buildEnd}${last}`).format.verticalAlignment='center';
 s.getRange(`A1:${s===out?'N':buildEnd}${last}`).format.rowHeight=25;
 s.freezePanes.freezeRows(11);s.freezePanes.freezeColumns(3);
}
out.tabColor=color.header;build.tabColor='#DBC2A4';
out.getRange('A2').values=[[rawFx?'利润逐条复核（每行原始汇率比值）':estimatedFx?'利润逐条复核（按行估算汇率）':'利润与净利率逐条核对']];out.getRange('A2').format.font={size:16,bold:true,color:color.orange};
out.getRange('A2:N2').format.rowHeight=33;out.getRange('A3:N3').format.borders={bottom:{style:'thin',color:color.line}};
out.getRange('A4:B4').values=[['商品条数',rows.length]];
out.getRange('D4').values=[['输入完整']];out.getRange('E4').formulas=[[`=COUNTIFS('输入与计算'!V${first}:V${last},"完整")`]];
out.getRange('G4').values=[[estimatedFx?'本次复核一致':'当前配置一致']];out.getRange('H4').formulas=[[`=COUNTIFS(J${first}:J${last},"一致")`]];
out.getRange('J4').values=[['缺项待确认']];out.getRange('K4').formulas=[[`=COUNTIFS(J${first}:J${last},"缺项待确认")`]];
out.getRange('A4:N4').format.fill=color.pale;out.getRange('A4:N4').format.font.bold=true;
if(rawFx){
 out.getRange('G5').values=[['舍入边界']];out.getRange('H5').formulas=[[`=COUNTIFS(J${first}:J${last},"舍入边界")`]];
 out.getRange('J5').values=[['参数差异']];out.getRange('K5').formulas=[[`=COUNTIFS(J${first}:J${last},"参数差异")`]];
 out.getRange('G5:K5').format.font.bold=true;
}
out.getRange('A6').values=[[estimatedFx?'汇率按原表人民币 GMV÷美元含税实收估算到一位小数；其余参数统一采用本次确认值。':'比较采用项目当前统一配置。差额＝项目－原表；净利率＝净利润÷去税后营业收入。']];
out.getRange('A7').values=[[estimatedFx?'产品成本40%、去税÷1.13、推广25%、代运营10%、平台7%、版权按成本7%、人工3%、其他2%、所得税25%。':'原表复算按金额反推汇率、费率与版权基数，结果仅用于解释差异；未修改项目配置。']];
out.getRange('A8').values=[[estimatedFx?'差额＝本次－原表。净利率＝净利润÷去税后营业收入；8 条缺项不生成正式结果，详见右侧原因。':'缺项记录不生成正式项目结果。右侧复算对缺项按原表表现视作 0，须先补齐才能用于报价。']];
out.getRange('A9').values=[['原表只有数值，未提供原始公式。核对精度：利润 0.01 RMB，利润率 0.01 个百分点。']];
if(rawFx){
 out.getRange('A6').values=[['每行汇率＝该行人民币 GMV÷美元实收；不取整、不分组。汇率显示8位，计算保留原始除法结果。']];
 out.getRange('A8').values=[['差额＝本次－原表；净利率＝净利润÷去税营业收入。“舍入边界”表示同一汇率可在原表精度内同时对齐四项。']];
 out.getRange('A9').values=[['原表金额只保留两位，无法唯一还原真实汇率。按显示精度核对；缺项保留空白，舍入区间详见“输入与计算”。']];
}
out.getRange('A6:N9').format.font={size:10,color:'#6D6254'};
const outputHeaders=['原表行号','商品编码','商品名称','原表净利润\nRMB','项目净利润\nRMB','利润差额\nRMB','原表净利率','项目净利率','利率差\n百分点','当前配置核对','按原表规则复算\n净利润 RMB','原表规则复算\n净利率','原表规则核验','核对时差异原因'];
if(estimatedFx){outputHeaders[4]='本次净利润\nRMB';outputHeaders[7]='本次净利率';outputHeaders[9]='本次复核';outputHeaders[10]='本次估算汇率\nRMB/USD';outputHeaders[11]='原表推断\n推广费率';outputHeaders[12]='原表推断\n版权计费口径';}
if(rawFx)outputHeaders[10]='逐行隐含汇率\nRMB/USD';
out.getRange('A11:N11').values=[outputHeaders];

build.getRange('A2').values=[['输入数据与计算过程']];build.getRange('A2').format.font={size:16,bold:true,color:color.orange};
build.getRange('A4:J4').values=[['结算汇率','去税除数','产品成本比例','所得税率','推广费率','代运营费率','平台佣金率','版权费率（按成本）','人工费率','其他费率']];
const p=summary.params;
build.getRange('A5:J5').values=[[estimatedFx?'按行估算（AJ列）':p.fx,p.divisor,p.costRate/100,p.tax/100,p.promotion/100,p.operation/100,p.platform/100,p.royalty/100,p.labor/100,p.other/100]];
build.getRange('A4:J4').format.fill=color.pale;build.getRange('A4:J4').format.wrapText=true;build.getRange('A4:J4').format.rowHeight=40;
build.getRange('A5:J5').format.font.color='#2057B2';build.getRange('A5:J5').format.numberFormat='0.00';build.getRange('C5:J5').format.numberFormat=rate;
if(rawFx){
 build.getRange('A5').values=[['每行原始比值（AJ列）']];
 build.getRange('L4').values=[['收入扣点合计']];build.getRange('L5').formulas=[['=SUM(E5:G5,I5:J5)']];build.getRange('L5').format.numberFormat=rate;
 build.getRange('N4').values=[['金额舍入半宽（RMB）']];build.getRange('N5').values=[[.005]];build.getRange('N5').format.numberFormat='0.000';
 build.getRange('P4').values=[['利润率舍入半宽']];build.getRange('P5').values=[[.00005]];build.getRange('P5').format.numberFormat='0.000%';
}
build.getRange('A7').values=[[estimatedFx?'来源：工作簿2.xlsx，Sheet1 第 3–105 行。AJ列汇率＝原表人民币 GMV÷美元实收，估算到一位小数；其余参数见上方。':'来源：工作簿2.xlsx，Sheet1 第 3–105 行的 92 条非空商品记录；参数取项目 2026-11-05 当前统一配置。']];
build.getRange('A8').values=[['D:G 保留原始空白；项目计算只处理完整输入。AJ:AZ 为解释原表的推断复算，空白按 0、所得税按税前利润×25%（含负值）。']];
build.getRange('A9').values=[['原表利润与利润率为已保存数值；复算匹配不代表缺项有效。商品编码按文本展示，美元输入与人民币成本分别标注。']];
if(rawFx){
 build.getRange('A7').values=[['来源：工作簿2.xlsx，Sheet1 第3–105行。AJ＝原表人民币GMV÷美元实收，不舍入；BE提供营业收入反推比值用于交叉核对。']];
 build.getRange('A8').values=[['D:G保留原始空白。W:AI为统一参数结果；AO:AZ仅解释原表费用，诊断时空白按0、亏损所得税按原表负值处理。']];
 build.getRange('A9').values=[['BC:BD为GMV舍入允许的汇率区间；BG:BH为GMV、营业收入、利润和利润率同时对齐的交集。下限小于上限才有解。']];
}
build.getRange('A7:BB9').format.font.color='#6D6254';
const headers=['原表行号','商品编码','商品名称','中国组合价\nRMB','申请售价\nUSD','买家运费\nUSD','实际物流成本\nRMB','原表含税实收\nUSD','原表 GMV\nRMB','原表营业收入\nRMB','原表成本\nRMB','原表推广费\nRMB','原表代运营\nRMB','原表平台佣金\nRMB','原表版权费\nRMB','原表人工\nRMB','原表其他费用\nRMB','原表税前利润\nRMB','原表所得税\nRMB','原表净利润\nRMB','原表净利率','输入检查','项目含税实收\nUSD','项目营业收入\nRMB','项目产品成本\nRMB','项目推广费\nRMB','项目代运营\nRMB','项目平台佣金\nRMB','项目版权费\nRMB','项目人工\nRMB','项目其他费用\nRMB','项目税前利润\nRMB','项目所得税\nRMB','项目净利润\nRMB','项目净利率','原表推断汇率','原表推广费率','原表平台费率','原表版权基数','原表版权费率','复算营业收入\nRMB','复算产品成本\nRMB','复算推广费\nRMB','复算代运营\nRMB','复算平台佣金\nRMB','复算版权费\nRMB','复算人工\nRMB','复算其他费用\nRMB','复算税前利润\nRMB','复算所得税\nRMB','复算净利润\nRMB','复算净利率','原表规则核验','缺失输入'];
if(headers.length!==54)throw Error('Unexpected column count');
if(rawFx)headers.push('GMV舍入允许\n汇率下限','GMV舍入允许\n汇率上限','原表营业收入\n反推汇率','复核分类','四项同时对齐\n汇率下限','四项同时对齐\n汇率上限','营业收入复核差\nRMB','当前固定成本\nRMB','净利润对齐\n汇率下限','净利润对齐\n汇率上限','净利率对齐\n汇率下限','净利率对齐\n汇率上限');
build.getRange(`A11:${buildEnd}11`).values=[headers];
const values=rows.map(r=>{
 const a=r.values,row=Array(headers.length).fill(null);
 const mapping=[r.row,r.code,r.name,a[3],a[6],a[7],a[17],a[8],a[9],a[10],a[11],a[13],a[14],a[15],a[16],a[18],a[19],a[20],a[21],a[22],a[23]];
 mapping.forEach((v,i)=>row[i]=v);row[38]=r.royaltyBasis==='成本7%'?'产品成本':'营业收入';row[53]=r.missing.join('、');return row;
});
build.getRange(`A${first}:${buildEnd}${last}`).values=values;
function column(c,formula){build.getRange(`${c}${first}:${c}${last}`).formulas=rows.map((r,i)=>[formula(first+i)]);}
column('V',n=>`=IF(COUNT(D${n}:G${n})=4,"完整","缺项")`);
const present=(n,expression)=>`=IF(V${n}="完整",${expression},"")`;
column('W',n=>present(n,`SUM(E${n}:F${n})`));column('X',n=>present(n,`W${n}*${estimatedFx?'AJ'+n:'$A$5'}/$B$5`));column('Y',n=>present(n,`D${n}*$C$5`));
for(const [col,base,parameter]of [['Z','X','E'],['AA','X','F'],['AB','X','G'],['AC','Y','H'],['AD','X','I'],['AE','X','J']])column(col,n=>present(n,`${base}${n}*$${parameter}$5`));
column('AF',n=>present(n,`X${n}-Y${n}-SUM(Z${n}:AE${n})-G${n}`));column('AG',n=>present(n,`MAX(AF${n},0)*$D$5`));column('AH',n=>present(n,`AF${n}-AG${n}`));column('AI',n=>present(n,`IF(X${n}=0,"",AH${n}/X${n})`));
column('AJ',n=>rawFx?`=I${n}/H${n}`:`=ROUND(I${n}/H${n},1)`);column('AK',n=>`=ROUND(L${n}/J${n},2)`);column('AL',n=>`=ROUND(N${n}/J${n},2)`);column('AN',n=>`=IF(AM${n}="产品成本",ROUND(O${n}/K${n},2),ROUND(O${n}/J${n},2))`);
column('AO',n=>`=SUM(E${n}:F${n})*AJ${n}/$B$5`);column('AP',n=>`=D${n}*$C$5`);column('AQ',n=>`=AO${n}*AK${n}`);column('AR',n=>`=AO${n}*$F$5`);column('AS',n=>`=AO${n}*AL${n}`);column('AT',n=>`=IF(AM${n}="产品成本",AP${n},AO${n})*AN${n}`);column('AU',n=>`=AO${n}*$I$5`);column('AV',n=>`=AO${n}*$J$5`);
column('AW',n=>`=AO${n}-AP${n}-SUM(AQ${n}:AV${n})-G${n}`);column('AX',n=>`=AW${n}*$D$5`);column('AY',n=>`=AW${n}-AX${n}`);column('AZ',n=>`=IF(AO${n}=0,"",AY${n}/AO${n})`);
column('BA',n=>`=IF(AND(ROUND(AY${n},2)=ROUND(T${n},2),ROUND(AZ${n},4)=ROUND(U${n},4)),"重现","差异")`);
if(rawFx){
 column('BC',n=>`=(I${n}-$N$5)/H${n}`);column('BD',n=>`=(I${n}+$N$5)/H${n}`);column('BE',n=>`=J${n}*$B$5/H${n}`);
 column('BI',n=>`=I${n}/$B$5-J${n}`);
 column('BJ',n=>present(n,`Y${n}*(1+$H$5)+G${n}`));
 column('BK',n=>present(n,`(BJ${n}+(T${n}-$N$5)/IF(T${n}-$N$5>0,1-$D$5,1))/(W${n}/$B$5*(1-$L$5))`));
 column('BL',n=>present(n,`(BJ${n}+(T${n}+$N$5)/IF(T${n}+$N$5>0,1-$D$5,1))/(W${n}/$B$5*(1-$L$5))`));
 column('BM',n=>present(n,`BJ${n}/(W${n}/$B$5*(1-$L$5-(U${n}-$P$5)/IF(U${n}-$P$5>0,1-$D$5,1)))`));
 column('BN',n=>present(n,`BJ${n}/(W${n}/$B$5*(1-$L$5-(U${n}+$P$5)/IF(U${n}+$P$5>0,1-$D$5,1)))`));
 column('BG',n=>present(n,`MAX(BC${n},(J${n}-$N$5)*$B$5/H${n},BK${n},BM${n})`));
 column('BH',n=>present(n,`MIN(BD${n},(J${n}+$N$5)*$B$5/H${n},BL${n},BN${n})`));
 column('BF',n=>`=IF(V${n}<>"完整","缺项待确认",IF(AND(ROUND(AH${n},2)=ROUND(T${n},2),ROUND(AI${n},4)=ROUND(U${n},4)),"一致",IF(BH${n}>BG${n},"舍入边界","参数差异")))`);
}
out.getRange(`A${first}:N${last}`).values=rows.map(r=>Array.from({length:14},(_,i)=>i===13?r.reasons.join('；'):null));
const source=(c,n)=>`'输入与计算'!${c}${n}`;
for(const [dest,src]of [['A','A'],['C','C'],['D','T'],['G','U'],['K',estimatedFx?'AJ':'AY'],['L',estimatedFx?'AK':'AZ']])out.getRange(`${dest}${first}:${dest}${last}`).formulas=rows.map((_,i)=>[`=${source(src,first+i)}`]);
out.getRange(`B${first}:B${last}`).values=rows.map(r=>[r.code]);
for(const [dest,src]of [['E','AH'],['H','AI']])out.getRange(`${dest}${first}:${dest}${last}`).formulas=rows.map((_,i)=>{const n=first+i;return [`=IF(${source('V',n)}="完整",${source(src,n)},"")`];});
out.getRange(`F${first}:F${last}`).formulas=rows.map((_,i)=>{const n=first+i;return [`=IF(ISNUMBER(E${n}),E${n}-D${n},"")`];});
out.getRange(`I${first}:I${last}`).formulas=rows.map((_,i)=>{const n=first+i;return [`=IF(ISNUMBER(H${n}),(H${n}-G${n})*100,"")`];});
out.getRange(`J${first}:J${last}`).formulas=rows.map((_,i)=>{const n=first+i;return [`=IF(${source('V',n)}<>"完整","缺项待确认",IF(AND(ROUND(E${n},2)=ROUND(D${n},2),ROUND(H${n},4)=ROUND(G${n},4)),"一致","不一致"))`];});
if(rawFx)out.getRange(`J${first}:J${last}`).formulas=rows.map((_,i)=>[`=${source('BF',first+i)}`]);
out.getRange(`M${first}:M${last}`).formulas=rows.map((_,i)=>{const n=first+i;return [estimatedFx?`=IF(${source('AM',n)}="产品成本","产品成本×7%","营业收入×4%")`:`=IF(${source('BA',n)}="重现",IF(${source('V',n)}="完整","可重现","空白按0可重现"),"存在差异")`];});

for(const [sheet,end]of [[out,'N'],[build,buildEnd]]){
 const head=sheet.getRange(`A11:${end}11`);head.format={fill:color.header,font:{name:'Arial',size:10,color:'#FFFFFF',bold:true},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,rowHeight:45};
 sheet.getRange(`A12:${end}${last}`).format.numberFormat=amount;
 sheet.getRange(`A12:C${last}`).format.numberFormat='@';sheet.getRange(`A12:C${last}`).format.horizontalAlignment='left';
 for(let n=first;n<=last;n++)if((n-first)%2===1)sheet.getRange(`A${n}:${end}${n}`).format.fill='#FFF9F0';
 const table=sheet.tables.add(`A11:${end}${last}`,true,sheet===out?'ProfitAudit':'ProfitInputs');table.showFilterButton=true;table.style='TableStyleLight1';
 sheet.getRange(`A11:${end}11`).format.borders={bottom:{style:'medium',color:color.orange}};
}
out.getRange(`D${first}:F${last}`).format.numberFormat=amount;out.getRange(`K${first}:K${last}`).format.numberFormat=amount;
out.getRange(`G${first}:H${last}`).format.numberFormat=rate;out.getRange(`L${first}:L${last}`).format.numberFormat=rate;out.getRange(`I${first}:I${last}`).format.numberFormat='0.00;[Red](0.00);0.00';
out.getRange(`D${first}:M${last}`).format.horizontalAlignment='right';out.getRange(`J${first}:J${last}`).format.horizontalAlignment='center';out.getRange(`M${first}:M${last}`).format.horizontalAlignment='center';out.getRange(`N${first}:N${last}`).format.wrapText=true;
out.getRange(`A11:N${last}`).format.rowHeight=48;out.getRange('A11:N11').format.rowHeight=48;
out.getRange(`A1:A${last}`).format.columnWidth=9;out.getRange(`B1:B${last}`).format.columnWidth=19;out.getRange(`C1:C${last}`).format.columnWidth=45;out.getRange(`C12:C${last}`).format.wrapText=true;
out.getRange(`D1:F${last}`).format.columnWidth=14;out.getRange(`G1:I${last}`).format.columnWidth=14;out.getRange(`J1:J${last}`).format.columnWidth=17;out.getRange(`K1:L${last}`).format.columnWidth=17;out.getRange(`M1:M${last}`).format.columnWidth=22;out.getRange(`N1:N${last}`).format.columnWidth=77;
out.getRange('A2:N9').format.rowHeight=24;out.getRange('A2:N2').format.rowHeight=34;
build.getRange(`A1:BB${last}`).format.columnWidth=17;build.getRange(`A1:A${last}`).format.columnWidth=10;build.getRange(`B1:B${last}`).format.columnWidth=20;build.getRange(`C1:C${last}`).format.columnWidth=47;build.getRange(`C12:C${last}`).format.wrapText=true;build.getRange(`BB1:BB${last}`).format.columnWidth=30;
build.getRange(`A12:BB${last}`).format.rowHeight=42;build.getRange(`D12:U${last}`).format.font.color='#2057B2';build.getRange(`AM12:AM${last}`).format.font.color='#2057B2';
if(rawFx){
 out.getRange(`K${first}:K${last}`).format.numberFormat='0.00000000';out.getRange(`K1:K${last}`).format.columnWidth=20;
 build.getRange(`AJ${first}:AJ${last}`).format.numberFormat='0.00000000';
 build.getRange(`BC1:BN${last}`).format.columnWidth=22;build.getRange(`BC12:BN${last}`).format.rowHeight=42;
 build.getRange(`BC12:BH${last}`).format.numberFormat='0.00000000';build.getRange(`BK12:BN${last}`).format.numberFormat='0.00000000';
 build.getRange(`BI12:BI${last}`).format.numberFormat='0.000000';build.getRange(`BF12:BF${last}`).format.numberFormat='@';
 build.getRange(`AJ12:AJ${last}`).format.columnWidth=22;build.getRange('A1:A5').format.columnWidth=24;
}
for(const c of ['U','AI','AK','AL','AN','AZ'])build.getRange(`${c}${first}:${c}${last}`).format.numberFormat=rate;
for(const c of ['V','AM','BA','BB'])build.getRange(`${c}${first}:${c}${last}`).format.numberFormat='@';
const warning={fill:'#FDE9E7',font:{color:color.red,bold:true}};
out.getRange(`F${first}:F${last}`).conditionalFormats.addCustom(`AND(ISNUMBER(F${first}),ABS(F${first})>=0.005)`,warning);
out.getRange(`I${first}:I${last}`).conditionalFormats.addCustom(`AND(ISNUMBER(I${first}),ABS(I${first})>=0.005)`,warning);
out.getRange(`J${first}:J${last}`).conditionalFormats.add('containsText',{text:'缺项',format:warning});
build.getRange(`D${first}:G${last}`).conditionalFormats.add('containsBlanks',{format:warning});
wb.recalculate();
// Independent verification uses the actual project's DailyCore output for every complete row.
for(let i=0;i<rows.length;i++){
 const n=first+i,r=rows[i],current=build.getRange(`AH${n}:AI${n}`).values[0];
 if(r.actual){if(Math.abs(current[0]-r.actual.netRmb)>1e-8||Math.abs(current[1]-r.actual.margin)>1e-10)throw Error('Project formula mismatch at source row '+r.row);}
 else if(current.some(value=>value!==''&&value!==null))throw Error('Missing input produced a result at source row '+r.row);
 if(!rawFx&&build.getRange(`BA${n}`).values[0][0]!=='重现')throw Error('Source reconstruction mismatch at row '+r.row);
 if(rawFx){
  if(Math.abs(build.getRange(`AJ${n}`).values[0][0]-r.fx)>1e-12)throw Error('Row FX mismatch at source row '+r.row);
  if(build.getRange(`BF${n}`).values[0][0]!==r.status)throw Error('Rounding classification mismatch at source row '+r.row);
  if(r.roundingPossible){
   if(Math.abs(build.getRange(`BG${n}`).values[0][0]-r.jointLower)>1e-10||Math.abs(build.getRange(`BH${n}`).values[0][0]-r.jointUpper)>1e-10)throw Error('Rounding interval mismatch at source row '+r.row);
  }
 }
}
// Check a real input dependency, then restore the captured current setting before export.
const original=build.getRange('AH12').values[0][0];build.getRange('E5').values=[[p.promotion===25?.2:.25]];wb.recalculate();
if(Math.abs(build.getRange('AH12').values[0][0]-original)<1e-6)throw Error('Promotion change did not recalculate');
build.getRange('E5').values=[[p.promotion/100]];wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'逐条核对!D11:M14',include:'values,formulas',tableMaxRows:4,tableMaxCols:10,maxChars:4500})).ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:1500});
console.log('ERROR SCAN',errors.ndjson);
await fs.mkdir(outputDir,{recursive:true});
for(const [sheetName,range,name]of [['逐条核对',rawFx?'A2:K16':'A2:J16','audit-preview.png'],['输入与计算',rawFx?'BC10:BI16':'V10:AI16','calculation-preview.png']]){
 const blob=await wb.render({sheetName,range,scale:1.5,format:'png'});
 await fs.writeFile(outputDir+name,new Uint8Array(await blob.arrayBuffer()));
}
if(out.getRange('H4').values[0][0]!==summary.matches)throw Error('一致记录汇总与独立计算不一致');
await (await SpreadsheetFile.exportXlsx(wb)).save(outputDir+(rawFx?'利润逐条复核_每行独立汇率.xlsx':estimatedFx?'利润逐条复核_估算汇率.xlsx':'利润逐条核对.xlsx'));
console.log('VERIFIED',rows.length,'rows;',summary.complete,'complete rows match project engine;',rawFx?JSON.stringify(summary.statusCounts):'all reconstructed source outputs match.');
