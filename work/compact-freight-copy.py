from pathlib import Path

path = Path(__file__).resolve().parents[1] / "apps/web/public/legacy/index.html"
html = path.read_text()
replacements = {
    '<div class="receipt-note freight-result" id="quote-result" role="status"><strong>预计物流成本 <span id="quote-value">— RMB</span></strong><span id="quote-formula">公式：计费重 × 渠道运价 ＋ 票费 ＋ 店铺附加费</span><small id="quote-hint">填完尺寸与实重后自动计算。</small></div><div class="fine-print">按商品属性与店铺自动匹配渠道；估算值自动填入下方物流成本，可再手动修改。报价超出范围时可直接填写实际成本。</div>': '',
    '<div class="receipt-note freight-result" id="compare-quote-result" role="status"><strong>预计物流成本 <span id="compare-quote-value">— RMB</span></strong><span>公式：计费重 × 渠道运价 ＋ 票费 ＋ 店铺附加费</span><small id="compare-quote-hint">填完尺寸与实重后自动计算；实际物流成本可手动修改。</small></div>': '',
    '实际物流成本（独立扣除）': '实际物流成本',
    'placeholder="自动填入物流估算，可手动修改"': 'aria-describedby="logistics-source" placeholder="自动填入，可修改"',
    '<div class="hint" id="logistics-source">物流估算会自动填入，可手动修改；利润按此框实际填写的成本计算。</div>': '<div class="hint" id="logistics-source" role="status">根据物流信息自动填入，可手动修改。</div>',
    '自行判断是否包邮，不收运费就填0。': '不收运费填 0。',
    '<span class="small">自行确认成交金额</span>': '',
    '参考美区商品价（💲）＝国内组合价（RMB）×2.8÷汇率': '参考美区商品价（💲）＝中国组合价（RMB）×参考售价倍率÷结算汇率',
    '真实营业收入（RMB）＝含税实收（💲）×汇率÷去税系数（默认1.13）': '真实营业收入（RMB）＝含税实收（💲）×结算汇率÷去税除数',
    '产品成本（RMB）＝中国组合价×成本比例（默认40%）': '产品成本（RMB）＝中国组合价×产品成本比例',
    '版权费＝产品成本×版权比例（默认4%）': '版权费＝产品成本×版权费率',
    '其余五项费用＝真实营业收入×对应扣点（默认合计42%）': '其余五项费用＝真实营业收入×对应费率',
    '所得税＝MAX(税前利润,0)×25%': '所得税＝MAX(税前利润,0)×所得税率',
    '<p>填写中国组合价后按统一配置自动计算美区商品售价；售价和实收仍可手动调整。没有自动包邮判断。物流输入修改后自动更新预计运费并填入实际物流成本，实际成本仍可手动覆盖；利润按手动确认后的数值计算。</p>': '<p>商品售价和物流成本自动填入后均可修改，利润按最终填写的金额计算。</p>',
    '<p>中美时钟实时显示，使用统一配置中的美国时间地区；两侧金额按结算汇率双向换算。点击“保存测算”后存入数据库，可在历史记录页搜索和载入；未保存的输入刷新后清空。零营业收入净利率不适用，亏损所得税为0。展示保留2位小数，内部不提前舍入。</p>': '<p>保存后可在历史记录中查看、载入修改或恢复上一版。未保存的输入刷新后清空。零营业收入不计算净利率；亏损所得税为 0。结果保留两位小数，计算时不提前舍入。</p>',
    '新方案默认带入历史成交与成本；临时设置每次从统一配置开始，只用于本次对比。接受新方案时，利润参数随新版本保存；物流输入及当次配置随本版一起保存，不修改统一配置。': '接受新方案会更新当前记录，原版本可在历史记录中恢复。',
    '再次打开对比会恢复统一配置；利润费率和汇率随新版本保存，物流输入及当次配置随接受的新版本一起存档。': '每次打开对比使用统一配置；本次改动随方案保存，不影响统一配置。',
    '每格依次为 RMB / 💲；变化额＝新方案－历史。两方案各按自己的汇率换算，利润率差值＝新方案净利润率－历史净利润率，以%显示，非相对增长率。正数绿色，负数红色；各币种分别判断。': '金额按 RMB / 💲 显示，两方案各用本版汇率；变化额＝新方案－历史，利润率差值以百分点表示。',
}
for old, new in replacements.items():
    if old not in html:
        raise SystemExit(f"Missing expected text: {old[:100]}")
    html = html.replace(old, new)
path.write_text(html)
