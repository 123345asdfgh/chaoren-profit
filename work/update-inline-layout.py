from pathlib import Path

p=Path('apps/web/public/legacy/index.html')
s=p.read_text()
start=s.index('<section class="prep-grid"')
end=s.index('<section class="card product-identity"',start)
block=s[start:end]
card=block[block.index('<article class="card">'):block.index('</article>')+len('</article>')]
card=card.replace('<article class="card">','<section class="card freight-inline" aria-label="物流测算">',1).replace('</article>','</section>')
card=card.replace('<span>物流成本计算</span>','<span>物流测算</span>')
card=card.replace('</div><div class="three-grid">','')
button_start=card.index('<div class="tool-actions freight-adopt-actions">')
button_end=card.index('</div>',button_start)+len('</div>')
card=card[:button_start]+card[button_end:]
card=card.replace('按商品属性与店铺选择渠道；裸货按属性预估包装。报价超出范围需人工询价。','按商品属性与店铺自动匹配渠道；估算值自动填入下方物流成本，可再手动修改。报价超出范围时可直接填写实际成本。')
s=s[:start]+s[end:]
insert=s.index('<section class="profit-layout"')
s=s[:insert]+card+'\n<input id="referenceChina" type="hidden" value="">\n'+s[insert:]
start=s.index('<button id="open-freight-tool"')
end=s.index('</button>',start)+len('</button>')
s=s[:start]+s[end:]
s=s.replace('placeholder="手动填写，或采用物流测算"','placeholder="自动填入物流估算，可手动修改"')
s=s.replace('运费查询不会自动覆盖此值。支持直接手动填写。','物流估算会自动填入，可手动修改；利润按此框实际填写的成本计算。')
s=s.replace('<button id="export">导出本单CSV</button>','')
s=s.replace('<script src="tool-dialogs.js"></script>','')
s=s.replace('<div id="record-config-fields" class="record-config-fields"></div></section>','<div id="record-config-fields" class="record-config-fields"></div><details class="freight-config-section"><summary>本记录物流渠道与运价配置</summary><div id="record-freight-config-editor"></div><p id="record-freight-message" class="small" role="status"></p></details></section>')
s=s.replace('物流测算需确认采用，产品参数修改后旧运费会提示重新确认。','物流输入修改后自动更新预计运费并填入实际物流成本，实际成本仍可手动覆盖；利润按手动确认后的数值计算。')
s=s.replace('临时物流规则只用于计算本次采用的运费，不修改统一配置。','物流输入及当次配置随本版一起保存，不修改统一配置。')
s=s.replace('临时物流规则不单独存档。','物流输入及当次配置随接受的新版本一起存档。')
start=s.index('<div id="compare-freight-overlay"')
end=s.index('<section class="card breakdown compare-table"',start)
comparison_freight='''<section class="compare-input-section compare-freight-inline" aria-label="新方案物流测算"><h3>新方案物流测算</h3><div id="compare-freight-fields" class="compare-freight-fields"></div><div class="receipt-note freight-result" id="compare-quote-result" role="status"><strong>预计物流成本 <span id="compare-quote-value">— RMB</span></strong><span>公式：计费重 × 渠道运价 ＋ 票费 ＋ 店铺附加费</span><small id="compare-quote-hint">填完尺寸与实重后自动计算；实际物流成本可手动修改。</small></div></section>'''
s=s[:start]+s[end:]
s=s.replace('<div id="compare-fields"></div>',comparison_freight+'<div id="compare-fields"></div>')
p.write_text(s)
