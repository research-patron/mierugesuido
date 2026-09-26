"""Independent CSV/ZIP checks; never sends or uploads files."""
import csv, hashlib, io, json, zipfile
from pathlib import Path
root=Path.cwd()
products=json.loads((root/'config/dataset-products.json').read_text())
editions=json.loads((root/'data/static/dataset-catalog.json').read_text())
for edition in editions:
    if not edition.get('filesReady'): continue
    product=next(p for p in products if p['slug']==edition['slug'])
    private=root/'private-products'/edition['slug']/edition['dataVersion'][:12]
    if not private.exists(): raise AssertionError('Generate the current private package before verification')
    with (private/'indicators.csv').open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
    assert len(rows)==edition['rowCount']
    assert len(rows[0])==edition['columnCount']
    assert len({row['rowId'] for row in rows})==len(rows)
    assert all(row['fiscalYear']==str(product['fiscalYear']) for row in rows)
    original=json.loads((root/'data/static/home.json').read_text())['mapScopes']['tokkan' if product['businessType']=='17/4' else 'public']['mapMunicipalities']
    by_code={row['municipalityCode']:row for row in original}
    for row in rows:
        source=by_code[row['municipalityCode']]
        for metric in ['expenseRecoveryRate','feeUnitPriceYenPerM3','treatmentCostYenPerM3']:
            if source[metric] is None: assert row[metric]==''
            else: assert float(row[metric])==source[metric]
    if product['status']!='draft':
        sample_dir=root/'public/samples'/product['slug']
        with (sample_dir/'sample.csv').open(encoding='utf-8-sig',newline='') as f: sample=list(csv.DictReader(f))
        assert sample==rows[:product['sampleSize']]
        assert sample[0]['municipalityCode'].startswith('0') or product['regions']
        assert json.loads((sample_dir/'manifest.json').read_text())['dataVersion']==edition['dataVersion']
        assert sorted(p.name for p in sample_dir.iterdir())==['README.md','columns.csv','manifest.json','sample.csv','sources.csv']
    with zipfile.ZipFile(private/'dataset.zip') as archive:
        assert archive.testzip() is None
        for item in edition['files']:
            content=archive.read(item['name'])
            assert len(content)==item['bytes']
            assert hashlib.sha256(content).hexdigest()==item['sha256']
    assert (private/'dataset.zip').stat().st_size<50_000_000
    print(json.dumps({'productId':product['productId'],'rows':len(rows),'sampleRows':product['sampleSize'],'zipBytes':(private/'dataset.zip').stat().st_size,'checks':'passed'}))
for public_root in [root/'public',root/'out']:
    if public_root.exists():
        assert not list(public_root.rglob('dataset.zip'))
        assert not list(public_root.rglob('indicators.csv'))
