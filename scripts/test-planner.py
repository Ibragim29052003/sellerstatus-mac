#!/usr/bin/env python3
"""Exercise the private sidecar over HTTP in an isolated temporary workspace."""
import argparse
from contextlib import contextmanager
import html
from http.cookiejar import CookieJar
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import queue
import secrets
import subprocess
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import io

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--runtime', type=Path, default=Path(__file__).resolve().parents[1] / '.local/planner')
args = parser.parse_args()
runtime = args.runtime.resolve()
class Fields(HTMLParser):
    def __init__(self, page):
        super().__init__(); self.fields = {}; self.feed(page)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'input' and 'name' in attrs:
            self.fields.setdefault(attrs['name'], attrs.get('value', ''))

@contextmanager
def launch(directory, owner):
    token = secrets.token_hex(32)
    env = {key: value for key,value in os.environ.items() if not key.startswith(('Planner__','SELLERSTATUS_DESKTOP_'))}
    env.update(ASPNETCORE_URLS='http://127.0.0.1:0', ASPNETCORE_ENVIRONMENT='Development', DOTNET_ENVIRONMENT='Development', Planner__DataDirectory=directory, Planner__LocalSellerStatus='false', Planner__AccessKey='', Planner__PathBase='', SELLERSTATUS_DESKTOP_SESSION=token, SELLERSTATUS_DESKTOP_OWNER=owner, Logging__LogLevel__Default='Warning', DOTNET_USE_POLLING_FILE_WATCHER='1', DOTNET_HOSTBUILDER__RELOADCONFIGONCHANGE='false')
    process = subprocess.Popen([str(runtime / 'SupplyPlanner.Web')], cwd=runtime, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    ready = queue.Queue()
    def read():
        for line in process.stdout:
            if line.startswith('SELLERSTATUS_PLANNER_READY '): ready.put(line.strip().split(' ',1)[1])
    threading.Thread(target=read,daemon=True).start()
    try:
        base = ready.get(timeout=20)
        assert urllib.parse.urlparse(base).hostname == '127.0.0.1'
        cookies = CookieJar()
        client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
        def request(path='/', data=None, headers=None, status=200, authenticate=False):
            headers = dict(headers or {})
            if authenticate: headers['X-SellerStatus-Desktop'] = token
            req = urllib.request.Request(base + path, data=data, headers=headers)
            try: response = client.open(req, timeout=10)
            except urllib.error.HTTPError as error: response = error
            body = response.read()
            assert response.status == status, (path, response.status, status)
            return body, response.headers
        yield request, process
    finally:
        process.stdin.close()
        try: process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill(); process.wait(); raise AssertionError('Planner did not stop on parent pipe EOF')
        assert process.returncode == 0, process.returncode

def form(page, **values):
    fields = Fields(page.decode()).fields
    fields.update(values)
    return urllib.parse.urlencode(fields).encode()

with tempfile.TemporaryDirectory(prefix='sellerstatus-planner-test-') as data:
    owner = secrets.token_hex(16)
    with launch(data,owner) as (request, process):
        request('/healthz',status=403)
        request('/planner.css',status=403)
        health,_ = request('/healthz', authenticate=True)
        assert json.loads(health)['service'] == 'supply-planner'
        request('/',headers={'Origin':'https://example.com'},status=403)
        page,_ = request('/')
        assert 'Рассчитать план'.encode() in page
        assert b'Settings.LeadDays' in page
        csrf = Fields(page.decode()).fields
        request('/?handler=Calculate',data=b'Revision=0',status=400)
        page,_ = request('/?handler=Calculate',data=form(page,ScenarioName='Mac integration smoke',**{'Settings.LeadDays':'9'}),headers={'Content-Type':'application/x-www-form-urlencoded'})
        scenario, headers = request('/?handler=Json')
        parsed = json.loads(scenario)
        assert parsed['name'] == 'Mac integration smoke'
        assert parsed['settings']['leadDays'] == 9
        assert 'attachment' in headers['Content-Disposition']
        csv, headers = request('/?handler=Csv')
        assert len(csv)>100 and 'attachment' in headers['Content-Disposition']
        excel, headers = request('/?handler=Excel')
        assert zipfile.is_zipfile(io.BytesIO(excel))
        with zipfile.ZipFile(io.BytesIO(excel)) as book: assert 'xl/workbook.xml' in book.namelist()
        # Save a named copy, then import a changed JSON through the real CSRF path.
        request('/?handler=Save',data=form(page),headers={'Content-Type':'application/x-www-form-urlencoded'})
        page,_=request('/')
        fields=Fields(page.decode()).fields
        parsed['name']='Imported on Mac'
        boundary='sellerstatus-'+secrets.token_hex(16)
        payload=b''
        for key,value in {'Revision':fields['Revision'],'__RequestVerificationToken':fields['__RequestVerificationToken']}.items():
            payload+=f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
        payload+=f'--{boundary}\r\nContent-Disposition: form-data; name="Upload"; filename="scenario.json"\r\nContent-Type: application/json\r\n\r\n'.encode()+json.dumps(parsed).encode()+f'\r\n--{boundary}--\r\n'.encode()
        request('/?handler=Import',data=payload,headers={'Content-Type':f'multipart/form-data; boundary={boundary}'})
        imported,_=request('/?handler=Json')
        assert json.loads(imported)['name']=='Imported on Mac'
    # Fresh port, secret, and cookie jar; persistent owner restores the workspace.
    with launch(data,owner) as (request,process):
        request('/healthz',authenticate=True)
        scenario,_=request('/?handler=Json')
        assert json.loads(scenario)['name']=='Imported on Mac'
        page,_=request('/')
        assert b'Mac integration smoke' in page
    with launch(data,secrets.token_hex(16)) as (request,process):
        request('/healthz',authenticate=True)
        scenario,_=request('/?handler=Json')
        assert json.loads(scenario)['name']!='Imported on Mac'
print('PASS: gate, CSRF, calculation, JSON/CSV/Excel export, import, saved copies, restart persistence, workspace isolation, parent EOF shutdown')
