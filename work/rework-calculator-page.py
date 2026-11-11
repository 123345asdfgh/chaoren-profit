from pathlib import Path
import re
p=Path('apps/web/public/legacy/index.html');s=p.read_text()
s=re.sub(r'<button id="open-products".*?</button>','',s,count=1)
s=re.sub(r'<button id="open-settings".*?</button>','',s,count=1)
s=s.replace('placeholder="输入商品名称、规格编码或商品编码"','placeholder="输入规格编码搜索已保存商品"').replace('<label for="product-search">搜索商品</label>','<label for="product-search">搜索商品（规格编码）</label>')
for key,label in [('archive-name','商品名称'),('archive-spec','规格编码'),('archive-product','商品编码')]:
 pattern=r'<output id="'+key+r'-display".*?</output><input id="'+key+r'"[^>]*>'
 replacement=f'<input id="{key}" required maxlength="200" autocomplete="off" placeholder="填写{label}">'
 s,n=re.subn(pattern,replacement,s,count=1);assert n==1,key
s=s.replace('<output id="attribute-display" for="attribute" aria-labelledby="attribute-label">—</output><select id="attribute" hidden></select>','<select id="attribute" required></select>')
for key in ['length','width','height','weight']:
 s,n=re.subn(r'<output id="'+key+r'-display".*?</output>','',s,count=1);assert n==1,key
 s=s.replace(f'id="{key}" type="number" min="0.000001" max="1000000" step="any" hidden',f'id="{key}" type="number" min="0.000001" max="1000000" step="any" required placeholder="填写数值"')
s=s.replace('产品信息</h2></div><form id="save-product-form"','产品信息</h2><span id="measurement-mode" class="small" role="status">新增测算</span></div><form id="save-product-form"',1)
start=s.index('<section class="card freight-inline"')
end=s.index('<input id="referenceChina"',start)
freight=s[start:end]
freight=freight.replace('<div class="product-grid">','<div class="freight-layout"><div class="product-grid">',1)
needle='</div>\n</section>'
assert needle in freight
freight=freight.replace(needle,'''</div><aside class="freight-estimate" aria-label="物流测算结果"><span>预计物流成本</span><strong id="freight-estimate-value">— RMB</strong><p id="freight-estimate-message" role="status">填写物流信息后显示估算结果。</p><button id="adopt-freight" type="button" disabled>采用</button></aside></div>
</section>''',1)
s=s[:start]+freight+s[end:]
start=s.index('<section id="record-config-panel"');end=s.index('<div id="save-success-dialog"',start)
old=s[start:end]
settings=old[old.index('<form id="settings-form">'):old.index('</form></dialog>')+len('</form>')]
settings=re.sub(r'<details class="freight-config-section">.*?</details>','',settings,flags=re.S)
settings=settings.replace('<form id="settings-form">','<div id="settings-form">').replace('</form>','</div>')
settings=settings.replace('<div class="settings-actions"><button id="reset-settings" type="button">恢复全部默认值</button><button class="primary" type="submit">保存配置</button></div>','')
config='''<section class="card calculation-config" aria-label="测算配置"><div class="section-head"><h2><svg class="ui-icon" aria-hidden="true" focusable="false"><use href="#icon-gear"></use></svg>测算配置</h2><span class="small">随本次测算一起保存</span></div>'''+settings+'</section>\n'
s=s[:start]+s[end:]
pos=s.index('<input id="referenceChina"');s=s[:pos]+config+s[pos:]
s=s.replace('placeholder="自动填入，可修改"','placeholder="填写实际成本，或采用上方估算"').replace('根据物流信息自动填入，可手动修改。','点击“采用”填入物流估算，也可自行填写实际成本。')
start=s.index('<ol class="usage-guide">');end=s.index('</ol>',start)+len('</ol>')
s=s[:start]+'''<ol class="usage-guide">
 <li><strong>首次测算：</strong>直接填写产品信息、商品物流信息、测算配置和成交成本。确认保存后，历史记录与商品资料同时新增，完整保存本次输入、配置和利润结果。</li>
 <li><strong>同商品新单：</strong>按规格编码搜索，候选显示商品名称、规格编码和商品编码，匹配文字高亮。选中后回填该商品上次保存的全部资料，所有字段均可修改；保存时新增一条历史记录，同时更新原商品资料。</li>
 <li><strong>确认物流：</strong>系统根据属性、尺寸类型、店铺及长宽高、实重实时估算。点击“采用”才填入下方实际物流成本，也可直接手填；利润始终按实际物流成本计算。超限货物请人工询价后填写。</li>
 <li><strong>本次配置：</strong>在商品物流信息下方直接调整业务参数、费用和美国时间地区，随测算保存。物流渠道和运价规则由系统使用，页面不提供编辑。对比临时设置每次使用默认业务参数，接受后将临时参数保存到本单和商品资料。</li>
 <li><strong>修改历史：</strong>在历史记录详情中点击“载入并修改”，保存会更新原记录并保留上一版，同时同步商品资料。点击“重开一单”清空表单开始新增；从搜索选择商品也会开始该商品的新单。</li>
 <li><strong>唯一编码：</strong>规格编码用于识别商品，商品编码与商品名称同样不可与其他商品重复；编码按文本保存，保留前导 0。重复编码导致的保存失败不会写入部分记录。</li>
 <li><strong>查询与导出：</strong>历史默认显示全部，筛选后显示匹配记录；Excel 导出包含当前筛选范围内全部记录及保存配置，不限于当前页。</li>
</ol>'''+s[end:]
s=re.sub(r'<details class="freight-config-section"><summary>本次物流渠道与运价</summary>.*?</details>','',s,flags=re.S)
s=s.replace('每次打开对比使用统一配置；本次改动随方案保存，不影响统一配置。','每次打开对比使用默认业务参数；临时改动仅在接受并保存后写入本单和商品资料。')
s=s.replace('<div id="compare-freight-fields" class="compare-freight-fields"></div></section>','<div id="compare-freight-fields" class="compare-freight-fields"></div><div class="compare-freight-estimate"><div><strong id="compare-freight-estimate-value">— RMB</strong><span id="compare-freight-estimate-message" role="status"></span></div><button id="compare-adopt-freight" type="button" disabled>采用物流估算</button></div></section>')
s=s.replace('<script src="freight-settings.js"></script>','')
p.write_text(s)
