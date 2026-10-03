"""Verify a reviewed static TEST payload before upload. No cloud or booking calls."""
from pathlib import Path
import hashlib
import json
import re

BASE = Path(__file__).resolve().parent
SITE = BASE / 'website'


def verify():
    contract = json.loads((BASE / 'review-contract.json').read_text())
    expected = contract['member_sha256']
    if SITE.is_symlink() or any(p.is_symlink() for p in SITE.rglob('*')):
        raise ValueError('All filesystem symlinks, including dangling and directory links, are prohibited.')
    files = {p.relative_to(SITE).as_posix(): p for p in SITE.rglob('*') if p.is_file()}
    if set(files) != set(expected):
        raise ValueError('Only the frozen website members may be deployed.')
    for name, path in files.items():
        if path.is_symlink() or any(p.is_symlink() for p in path.parents if p != BASE):
            raise ValueError('Symlinks cannot be published.')
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected[name]:
            raise ValueError('Changed website bytes require a fresh review contract.')
    config = json.loads(files['staticwebapp.config.json'].read_text())
    if set(config) != {'globalHeaders', 'routes', 'responseOverrides'}:
        raise ValueError('Dynamic authorization or additional configuration requires a new design review.')
    if any(value != 'no-store' for route in config['routes'] for key, value in route.get('headers', {}).items() if key.lower() == 'cache-control'):
        raise ValueError('Route headers cannot weaken the private cache policy.')
    if any(value != 'noindex, nofollow' for route in config['routes'] for key, value in route.get('headers', {}).items() if key.lower() == 'x-robots-tag'):
        raise ValueError('Route headers cannot weaken the private indexing policy.')
    for header in ('cache-control', 'x-robots-tag'):
        if sum(key.lower() == header for key in config['globalHeaders']) != 1:
            raise ValueError('Case-variant global privacy headers are prohibited.')
    if 'navigationFallback' in config or config['routes'][-1] != {'route': '/*', 'allowedRoles': ['jadore_reviewer']}:
        raise ValueError('Every static route must require the invited reviewer role.')
    if any(r.get('allowedRoles') != ['jadore_reviewer'] for r in config['routes']):
        raise ValueError('Anonymous or generic authenticated access is prohibited.')
    api = next(r for r in config['routes'] if r['route'] == '/api/*')
    if api.get('statusCode') != 404:
        raise ValueError('This test environment cannot expose a live API.')
    if config['responseOverrides'] != {'401': {'statusCode': 302, 'redirect': '/.auth/login/aad'}}:
        raise ValueError('Reviewers must use the reviewed Microsoft sign-in entry.')
    if config['globalHeaders'].get('X-Robots-Tag') != 'noindex, nofollow':
        raise ValueError('The test environment cannot be indexed.')
    if config['globalHeaders'].get('Cache-Control') != 'no-store':
        raise ValueError('Private preview content cannot use public caching.')
    for path in files.values():
        if path.suffix == '.html' and not re.search(r'<meta\s+name=["\']robots["\']\s+content=["\']noindex', path.read_text(), re.I):
            raise ValueError('All concept and guest pages must remain noindex.')
    script = re.sub(r'//[^\n]*', '', files['concierge-config.js'].read_text()).strip()
    if not re.fullmatch(r'window\.JADORE_CONCIERGE\s*=\s*Object\.freeze\(\{\s*enabled\s*:\s*false\s*\}\)\s*;?', script):
        raise ValueError('The preview cannot enable the AI service.')
    if 'Disallow: /' not in files['robots.txt'].read_text():
        raise ValueError('Preview robots policy must stay closed.')
    corporate = BASE.parent / '.github/workflows/azure-static-web-apps-icy-pond-0fc80af03.yml'
    if hashlib.sha256(corporate.read_bytes()).hexdigest() != contract['corporate_workflow_sha256']:
        raise ValueError('The existing production workflow must remain unchanged.')
    print(f'Verified {len(files)} frozen website members; invited role required; APIs and AI disabled.')


if __name__ == '__main__':
    verify()
