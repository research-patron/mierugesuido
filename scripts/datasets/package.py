"""Package only the explicitly generated deliverables. No upload or network."""
import hashlib, json, sys, zipfile
from pathlib import Path
root = Path(sys.argv[1]).resolve()
files = ['indicators.csv', 'columns.csv', 'sources.csv', 'README.md', 'corrections.json', 'manifest.json']
archive = root / 'dataset.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as out:
    for name in files:
        info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        out.writestr(info, (root / name).read_bytes())
assert archive.stat().st_size <= 50_000_000, 'note upload exceeds conservative 50 MB limit'
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
    assert check.namelist() == files
    for name in files:
        assert check.read(name) == (root / name).read_bytes()
manifest = json.loads((root / 'manifest.json').read_text())
for item in manifest['files']:
    assert hashlib.sha256((root / item['name']).read_bytes()).hexdigest() == item['sha256']
print(json.dumps({'zipBytes': archive.stat().st_size, 'zipVerified': True}))
