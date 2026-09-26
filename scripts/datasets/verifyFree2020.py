"""Independent CSV + OOXML checks. Does not import or trust the TS builder."""
import csv, json, hashlib, pathlib, os, statistics, math, zipfile, xml.etree.ElementTree as ET
ROOT=pathlib.Path.cwd(); base=ROOT/'public/free-data/public-sewer-2020-national'
rows=list(csv.DictReader((base/'public-sewer-2020.csv').open(encoding='utf-8-sig',newline='')))
columns=list(csv.DictReader((base/'columns.csv').open(encoding='utf-8-sig',newline='')))
ids={c['id']:c['label'] for c in columns}
m=json.loads((ROOT/'data/static/free-2020-catalog.json').read_text())
assert len(rows)==m['rowCount']==1189
assert len(rows[0])==len(columns)==174
assert all(r['決算年度']=='2020' and len(r['団体コード'])==6 for r in rows)
assert len(set(r['行識別子'] for r in rows))==len(rows)
for f in m['files']:
 b=(base/f['name']).read_bytes();assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
def number(s): return float(s) if s!='' else None
def close(a,b):
 if a is None or b is None: assert a is None and b is None,(a,b)
 else: assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-8),(a,b)
metrics=[c['id'][:-7] for c in columns if c['id'].endswith('_annual')]
raw_rows=list(csv.DictReader((base/'input-values.csv').open(encoding='utf-8-sig',newline='')))
raw_by_id={r['行識別子']:r for r in raw_rows}
assert len(raw_by_id)==len(raw_rows)==len(rows)
raw_columns={k.rsplit('[',1)[1][:-1]:k for k in raw_rows[0] if k.endswith(']')}
traces=list(csv.DictReader((base/'calculations.csv').open(encoding='utf-8-sig',newline='')))
assert [t['項目ID'] for t in traces]==list(ids)
trace_by_id={t['項目ID']:t for t in traces}
def raw_number(s):
 s=s.removeprefix("'").strip().replace(',','')
 return None if s in ('','-','－','―','…','...','X','x','***') else float(s)
for t in traces:
 for dependency in filter(None,t['入力項目ID'].split(' | ')):assert dependency in ids or dependency in raw_columns
for r in rows:
 raw=raw_by_id[r['行識別子']]
 assert raw['団体コード']==r['団体コード'] and raw['決算年度']=='2020'
 values={key:raw_number(raw[col]) for key,col in raw_columns.items()}
 for field in set(raw_columns)&set(ids):close(number(r[ids[field]]),values[field])
 for metric in metrics:
  keys=trace_by_id[metric+'_annual']['入力項目ID'].split(' | ')
  vals=[values[k] for k in keys]
  annual=sum(vals) if all(v is not None for v in vals) else None
  close(number(r[ids[metric+'_annual']]),annual)
  denominator=values[trace_by_id[metric+'_share']['入力項目ID'].split(' | ')[1]]
  close(number(r[ids[metric+'_share']]),annual/denominator*100 if annual is not None and annual>=0 and denominator is not None and denominator>0 else None)
 for metric,numerator,denominator,scale in [('expenseRecoveryRate','sewerFeeRevenue','wastewaterTreatmentCost',100),('feeUnitPrice','sewerFeeRevenue','annualBillableVolume',1000),('treatmentCost','wastewaterTreatmentCost','annualBillableVolume',1000)]:
  n,d=values[numerator],values[denominator]
  result=n*scale/d if n is not None and n>=0 and d is not None and d>0 else None
  actual=number(r[ids[metric]])
  if result is None:assert actual is None
  else:assert abs(actual-result)<=0.000050001
for metric in metrics:
 groups={}
 for r in rows:
  if r['費用比較対象']=='対象' and r[ids[metric+'_unit']]!='':groups.setdefault(r['都道府県'],[]).append(float(r[ids[metric+'_unit']]))
 for r in rows:
  annual=number(r[ids[metric+'_annual']]);volume=number(r['年間有収水量（m³/年）']);unit=number(r[ids[metric+'_unit']])
  close(unit,annual*1000/volume if annual is not None and annual>=0 and volume is not None and volume>0 else None)
  peers=groups.get(r['都道府県'],[]);assert int(r[ids[metric+'_count']])==len(peers)
  med=statistics.median(peers) if peers and r['費用比較対象']=='対象' else None
  close(number(r[ids[metric+'_median']]),med)
  close(number(r[ids[metric+'_difference']]),unit-med if unit is not None and med is not None else None)
# Exact official values: parse XLSX independently using the standard OOXML ZIP/XML format.
source_root=os.getenv('FREE_DATA_SOURCE_ROOT'); source_checks=0
if source_root:
 ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 source_cells={}
 def xlsx_records(file):
  with zipfile.ZipFile(file) as z:
   strings=[]
   if 'xl/sharedStrings.xml' in z.namelist():
    strings=[''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
   for sheet in sorted(n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')):
    headings=None
    for row in ET.fromstring(z.read(sheet)).findall('m:sheetData/m:row',ns):
     cells={}
     for cell in row.findall('m:c',ns):
      address=''.join(x for x in cell.attrib['r'] if x.isalpha());v=cell.find('m:v',ns);value=v.text if v is not None else ''
      if cell.attrib.get('t')=='s':value=strings[int(value)]
      elif cell.attrib.get('t')=='inlineStr':value=''.join(cell.find('m:is',ns).itertext())
      cells[address]=value
     if headings is None:headings=cells;continue
     yield {**{headings[k]:v for k,v in cells.items() if k in headings},'__excelrow':int(row.attrib['r'])}
 for s in m['sources']:
  b=(pathlib.Path(source_root)/s['file']).read_bytes();assert hashlib.sha256(b).hexdigest()==s['sha256']
  for r in xlsx_records(pathlib.Path(source_root)/s['file']):
   if r.get('業種コード')!='17' or r.get('事業コード')!='1':continue
   assert r['決算年度']=='2020'
   key=(r['団体コード'].zfill(6),'17-1-'+r['施設コード'].zfill(3),s['accountingType'],s['tableNo'],int(r['行番号']))
   assert key not in source_cells;source_cells[key]=r
 source_defs=list(csv.DictReader((base/'sources.csv').open(encoding='utf-8-sig')))
 # Read the documented mapping for source locations, then independently verify every exported raw value.
 for r in rows:
  acc='legal_applied' if r['会計区分']=='法適用' else 'non_legal_applied'
  fields={}
  raw=raw_by_id[r['行識別子']]
  for d in source_defs:
   if d['accounting']!=acc:continue
   key=(r['団体コード'],r['事業キー'],acc,int(d['table']),int(d['row']))
   s=source_cells.get(key,{}).get('列'+d['col'].zfill(3),''); fields[d['field']]=raw_number(s)
   close(raw_number(raw[raw_columns[d['field']]]),fields[d['field']]);source_checks+=1
  for field in ['servicePopulation','connectedPopulation','treatedVolume','annualBillableVolume','householdFee20m3Yen','sewerFeeRevenue','wastewaterTreatmentCost','opexComponent','capitalCostComponent','operating_expense','total_cost']:
   close(number(r[ids[field]]),fields.get(field));source_checks+=1
  # Published source-field names are declared in each cost annual column definition.
  for metric in metrics:
   definition=next(c['definition'] for c in columns if c['id']==metric+'_annual').split('。')[0]
   vals=[fields.get(k) for k in definition.split('＋')]
   close(number(r[ids[metric+'_annual']]),sum(vals) if all(v is not None for v in vals) else None);source_checks+=1
 # Independent identities cover exactly the 2020 public-sewer table 10 records.
 expected={(k[0],k[1],k[2]) for k in source_cells if k[3]==10 and k[4]==1}
 actual={(r['団体コード'],r['事業キー'],'legal_applied' if r['会計区分']=='法適用' else 'non_legal_applied') for r in rows}
 assert actual==expected
 record_rows=list(csv.DictReader((base/'source-records.csv').open(encoding='utf-8-sig')))
 assert len(record_rows)==len(source_cells)
 for r in record_rows:
  key=(r['団体コード'],r['事業キー'],r['会計区分'],int(r['表番号']),int(r['行番号']))
  assert source_cells[key]['__excelrow']==int(r['Excel行番号']);source_checks+=1
print(json.dumps({'rows':len(rows),'columns':len(columns),'costMetrics':len(metrics),'officialValueChecks':source_checks,'medianAndConversionChecks':'passed','hashes':'passed'}))
