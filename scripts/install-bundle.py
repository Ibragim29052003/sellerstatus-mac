#!/usr/bin/env python3
"""Replace a generated bundle without overwriting read-only .NET assemblies."""
from pathlib import Path
import os
import shutil
import subprocess
import sys
source, destination = (Path(value).resolve() for value in sys.argv[1:])
incoming = destination.with_name('.SellerStatus-next.app')
previous = destination.with_name('.SellerStatus-previous.app')
for path in (incoming, previous):
    shutil.rmtree(path, ignore_errors=True)
subprocess.run(['/usr/bin/ditto', '--norsrc', '--noextattr', str(source), str(incoming)], check=True)
if destination.exists():
    destination.rename(previous)
try:
    incoming.rename(destination)
except BaseException:
    if previous.exists(): previous.rename(destination)
    raise
shutil.rmtree(previous, ignore_errors=True)
