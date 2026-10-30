#!/usr/bin/env python3
"""Build an optional, private C# sidecar without changing its original checkout."""
import argparse
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', required=True, type=Path, help='Existing supply-planner directory')
parser.add_argument('--work-dir', type=Path, default=root / '.local' / 'planner-build')
parser.add_argument('--skip-tests', action='store_true')
args = parser.parse_args()
source = args.source.resolve()
work = args.work_dir.resolve()
if source == work or source in work.parents or work in source.parents:
    parser.error('Source and work directories must be separate.')
for name in ('SupplyPlanner.Core', 'SupplyPlanner.Web', 'SupplyPlanner.Tests', 'Directory.Build.props', 'global.json', 'examples'):
    if not (source / name).exists():
        parser.error(f'Missing source entry: {name}')
work.mkdir(parents=True, exist_ok=True)
copy = Path(tempfile.mkdtemp(prefix='source-', dir=work))
for name in ('SupplyPlanner.Core', 'SupplyPlanner.Web', 'SupplyPlanner.Tests', 'Directory.Build.props', 'global.json', 'examples'):
    src, dst = source / name, copy / name
    if src.is_dir():
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns('bin', 'obj', 'App_Data', '.runtime', '.git', '.env*'))
    else:
        shutil.copy2(src, dst)
web = copy / 'SupplyPlanner.Web'
program = web / 'Program.cs'
value = program.read_text()
needle = 'var app = builder.Build();'
if value.count(needle) != 1:
    raise SystemExit('Unsupported planner Program.cs; original files have not been modified.')
program.write_text(value.replace(needle, needle + '\napp.UseDesktopHost();'))
identity = web / 'Services' / 'WorkspaceIdentity.cs'
value = identity.read_text()
needle = '        const string cookie = "supply-planner.workspace";'
if value.count(needle) != 1:
    raise SystemExit('Unsupported WorkspaceIdentity.cs; original files have not been modified.')
identity.write_text(value.replace(needle, '        if (context.Items["SellerStatus.DesktopOwner"] is string desktopOwner) return desktopOwner;\n' + needle))
shutil.copy2(root / 'integration' / 'DesktopHost.cs', web / 'Services' / 'DesktopHost.cs')
index = web / 'Pages' / 'Index.cshtml'
index.write_text(index.read_text().replace('Хранятся последние 20 копий в этом браузере.', 'Хранятся последние 20 копий на этом Mac.'))
# Do not use a private/project-level package feed from the original checkout.
(copy / 'NuGet.Config').write_text('<?xml version="1.0"?><configuration><packageSources><clear/><add key="nuget.org" value="https://api.nuget.org/v3/index.json"/></packageSources></configuration>')
env = os.environ.copy()
env.update(DOTNET_CLI_HOME=str(work / 'dotnet-home'), NUGET_PACKAGES=str(work / 'packages'), DOTNET_CLI_TELEMETRY_OPTOUT='1', DOTNET_NOLOGO='1')
# Copy cached packages so the original tree is never used as writable build state.
cache = source / '.runtime' / 'packages'
if cache.exists() and not (work / 'packages').exists():
    shutil.copytree(cache, work / 'packages')
def run(*command):
    subprocess.run(command, cwd=copy, env=env, check=True)
# The generic desktop adapter is required only for a sidecar process, not test hosts.
# Test the original application in the isolated copy before adding the bootstrap.
if not args.skip_tests:
    program.write_text(program.read_text().replace('\napp.UseDesktopHost();', ''))
    run('dotnet', 'test', 'SupplyPlanner.Tests', '-c', 'Release', '--nologo')
    program.write_text(program.read_text().replace('var app = builder.Build();', 'var app = builder.Build();\napp.UseDesktopHost();'))
rid = 'osx-arm64' if platform.machine() == 'arm64' else 'osx-x64'
stage = work / 'publish'
if stage.exists():
    shutil.rmtree(stage)
run('dotnet', 'publish', 'SupplyPlanner.Web', '-c', 'Release', '-r', rid, '--self-contained', 'true', '-o', str(stage), '-p:UseAppHost=true', '-p:DebugType=None', '-p:DebugSymbols=false')
(stage / 'desktop-build.json').write_text(json.dumps({'runtime': rid, 'selfContained': True, 'sourceIncluded': False}, indent=2) + '\n')
# App_Data belongs in Application Support, never inside a signed bundle.
shutil.rmtree(stage / 'App_Data', ignore_errors=True)
output = root / '.local' / 'planner'
output.parent.mkdir(exist_ok=True)
previous = output.with_name('planner-previous')
shutil.rmtree(previous, ignore_errors=True)
if output.exists():
    output.rename(previous)
try:
    shutil.copytree(stage, output)
except BaseException:
    shutil.rmtree(output, ignore_errors=True)
    if previous.exists():
        previous.rename(output)
    raise
shutil.rmtree(previous, ignore_errors=True)
print(f'Private runtime ready: {output}\nOriginal project unchanged: {source}')
