#!/usr/bin/env python3
"""Ad-hoc sign the native files in a private, self-contained .NET publish folder."""
from pathlib import Path
import subprocess
import sys
root = Path(sys.argv[1]).resolve()
subprocess.run(['/usr/bin/xattr', '-cr', str(root)], check=True)
magic = {bytes.fromhex(value) for value in ('feedface', 'cefaedfe', 'feedfacf', 'cffaedfe', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca')}
for path in sorted(root.rglob('*')):
    if not path.is_file() or path.is_symlink():
        continue
    with path.open('rb') as file:
        native = file.read(4) in magic
    if native:
        subprocess.run(['/usr/bin/codesign', '--force', '--sign', '-', str(path)], check=True)
