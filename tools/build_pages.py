"""Stage Pages below its 1 GB limit without recompressing source videos.

Large static libraries use byte-identical videos from this public repository,
pinned to the newest commit that changed each file (stable URLs keep browser
caches across deploys); any file that cannot be proven identical uses HEAD. Originals remain tracked. Dynamic/shared guide assets stay
local. Only exact, resolvable quoted URLs are rewritten, never display text.
"""
import argparse
import json
import posixpath
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
LIBRARIES = {'hooks', 'glowderm-production', 'glowderm-team-videos', 'glowderm-cleanser',
             'glowderm-cbo', 'glowderm-ads', 'powerpages', 'kimgayeon-powerpage', 'ugg-spray-cases',
             'fullmoon-spray'}
TEXT = {'.html', '.js', '.json', '.css'}
URL = re.compile(r'''(["'`])([^"'`<>\n]*?\.(?:mp4|jpg|jpeg|png|webp)(?:[?#][^"'`<>\n]*)?)\1''')
PREFIX = '/chaakan-creator-guide/'

def resolve_url(source, value):
    parts = urlsplit(value)
    if parts.scheme or parts.netloc:
        if parts.netloc != 'jehyeonyang-oss.github.io' or not parts.path.startswith(PREFIX):
            return None
        return unquote(parts.path[len(PREFIX):])
    path = unquote(parts.path)
    if path.startswith(PREFIX):
        return path[len(PREFIX):]
    if path.startswith('/'):
        return None
    return posixpath.normpath(posixpath.join(posixpath.dirname(source), path))

def is_offload_candidate(source):
    return (source.split('/')[0] in LIBRARIES and source.endswith('.mp4')) or (
        source.startswith(('glowderm-research/assets/', 'glowderm-retinal/assets/', 'fullmoon-analysis/assets/')) and
        Path(source).suffix in {'.jpg', '.jpeg', '.png', '.webp', '.mp4'})


def pinned_commits(paths, head):
    """Newest commit touching each path, kept only when its blob equals HEAD's."""
    pins = {}
    try:
        log = subprocess.check_output(['git', '-c', 'core.quotePath=false', 'log', '--format=C %H',
                                       '--name-only', '--no-renames', 'HEAD'], cwd=ROOT, text=True,
                                      encoding='utf-8')
        commit = None
        for line in log.splitlines():
            if line.startswith('C ') and len(line) == 42:
                commit = line[2:]
            elif line in paths and line not in pins:
                pins[line] = commit
        order = sorted(pins)
        query = ''.join(f'{pins[p]}:{p}\n{head}:{p}\n' for p in order)
        out = subprocess.run(['git', 'cat-file', '--batch-check=%(objectname)'], cwd=ROOT, input=query,
                             capture_output=True, text=True, encoding='utf-8', check=True).stdout.split('\n')
        return {p: pins[p] if out[2 * i] == out[2 * i + 1] and 'missing' not in out[2 * i] else head
                for i, p in enumerate(order)}
    except Exception as error:
        print(f'pinning fell back to HEAD: {error}')
        return {}

def build(output):
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8').split('\0')
    files = [f for f in files if f and not f.startswith(('.', 'tools/'))]
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    candidates = {f for f in files if is_offload_candidate(f)}
    contents = {}
    referenced = set()
    for source in files:
        if Path(source).suffix in TEXT:
            body = (ROOT / source).read_text(encoding='utf-8')
            contents[source] = body
            for match in URL.finditer(body):
                target = resolve_url(source, match[2])
                if target in candidates:
                    referenced.add(target)
    # Unreferenced files stay local: they may be assembled dynamically.
    removed_bytes = sum((ROOT / f).stat().st_size for f in referenced)
    pins = pinned_commits(referenced, commit)
    output.mkdir(parents=True, exist_ok=False)
    rewritten = 0
    for source in files:
        if source in referenced:
            continue
        target = output / source
        target.parent.mkdir(parents=True, exist_ok=True)
        if source in contents:
            def replace(match):
                nonlocal rewritten
                video = resolve_url(source, match[2])
                if video not in referenced:
                    return match[0]
                suffix = urlsplit(match[2])
                url = f'https://raw.githubusercontent.com/jehyeonyang-oss/chaakan-creator-guide/{pins.get(video, commit)}/{quote(video)}'
                if suffix.query: url += '?' + suffix.query
                if suffix.fragment: url += '#' + suffix.fragment
                rewritten += 1
                return match[1] + url + match[1]
            target.write_text(URL.sub(replace, contents[source]), encoding='utf-8')
        else:
            shutil.copyfile(ROOT / source, target)
    size = sum(f.stat().st_size for f in output.rglob('*') if f.is_file())
    if size >= 950_000_000:
        raise RuntimeError(f'Pages artifact too large: {size} bytes (950 MB safety limit)')
    manifest = dict(commit=commit, bytes=size, offloaded_bytes=removed_bytes,
                    offloaded_videos=sum(f.endswith('.mp4') for f in referenced),
                    offloaded_images=sum(not f.endswith('.mp4') for f in referenced),
                    rewritten_urls=rewritten, pinned_before_head=sum(v != commit for v in pins.values()))
    (output / 'deployment.json').write_text(json.dumps(manifest), encoding='utf-8')
    print(json.dumps(manifest))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    build(parser.parse_args().output.resolve())
