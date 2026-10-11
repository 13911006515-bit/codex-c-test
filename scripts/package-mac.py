#!/usr/bin/env python3
"""Package the existing production build with verified official macOS runtimes."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import shutil
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VERSION = 'v24.19.0'
BASE = f'https://nodejs.org/dist/{VERSION}/'
CACHE = Path('/tmp/fingertip-bloom-mac-runtime')
CACHE.mkdir(exist_ok=True)
with urllib.request.urlopen(BASE + 'SHASUMS256.txt', timeout=30) as response:
    checksums = dict((name, digest) for digest, name in
                     (line.split() for line in response.read().decode().splitlines()))
if not (ROOT / 'dist/index.html').is_file():
    raise SystemExit('Run npm run build before packaging.')


def prepare_runtime(arch):
    filename = f'node-{VERSION}-darwin-{arch}.tar.gz'
    archive = CACHE / filename
    expected = checksums[filename]
    def valid():
        if not archive.is_file():
            return False
        with archive.open('rb') as stream:
            return hashlib.file_digest(stream, 'sha256').hexdigest() == expected
    if not valid():
        pending = archive.with_suffix('.partial')
        with urllib.request.urlopen(BASE + filename, timeout=60) as source, pending.open('wb') as target:
            shutil.copyfileobj(source, target)
        with pending.open('rb') as stream:
            actual = hashlib.file_digest(stream, 'sha256').hexdigest()
        if actual != expected:
            pending.unlink()
            raise RuntimeError(f'Official checksum verification failed: {filename}')
        pending.replace(archive)
    print(f'Verified official {arch} runtime: {filename}', flush=True)
    return arch, archive, expected


with ThreadPoolExecutor(max_workers=2) as pool:
    runtimes = list(pool.map(prepare_runtime, ['arm64', 'x64']))

with tempfile.TemporaryDirectory(prefix='fingertip-bloom-mac-') as temporary:
    package = Path(temporary) / '指尖花园 Mac'
    package.mkdir()
    shutil.copytree(ROOT / 'dist', package / 'site')
    shutil.copyfile(ROOT / 'scripts/portable/serve.cjs', package / 'serve.cjs')
    shutil.copyfile(ROOT / 'scripts/portable/start-mac.command', package / '启动花园.command')
    (package / '启动花园.command').chmod(0o755)
    for arch, archive, expected in runtimes:
        target = package / 'runtime' / arch
        target.mkdir(parents=True)
        prefix = f'node-{VERSION}-darwin-{arch}/'
        with tarfile.open(archive, 'r:gz') as source:
            for original, destination in [('bin/node', 'node'), ('LICENSE', 'LICENSE')]:
                member = source.getmember(prefix + original)
                if not member.isfile():
                    raise RuntimeError(f'Expected regular file: {member.name}')
                with source.extractfile(member) as input_file, (target / destination).open('wb') as output_file:
                    shutil.copyfileobj(input_file, output_file)
        (target / 'node').chmod(0o755)
        (target / 'VERIFICATION.txt').write_text(
            f'Official source: {BASE}{archive.name}\nVerified SHA-256: {expected}\n'
            f'Official checksum list: {BASE}SHASUMS256.txt\n')
    licenses = package / 'licenses'
    licenses.mkdir()
    shutil.copyfile(ROOT / 'node_modules/three/LICENSE', licenses / 'Three-LICENSE.txt')
    shutil.copyfile('/usr/share/common-licenses/Apache-2.0', licenses / 'MediaPipe-Apache-2.0.txt')
    (licenses / 'NOTICE.txt').write_text(
        'Three.js 0.180.0 — MIT License, copyright three.js authors.\n'
        'MediaPipe Hands 0.4.1675469240 — Apache License 2.0, The MediaPipe Authors / Google.\n'
        f'Node.js {VERSION} — licenses and notices in ../runtime/<architecture>/LICENSE.\n')
    (package / '使用说明.txt').write_text('''指尖花园 · Mac 通用启动版

适用于 macOS 13.5 或更新版本，支持苹果芯片（M 系列）和 Intel Mac，自动选择处理器版本。

1. 在 Finder 中找到下载的 ZIP 文件，双击，用系统自带的归档实用工具完整解压。
2. 打开“指尖花园 Mac”文件夹，双击“启动花园.command”。
3. 网页会在默认浏览器自动打开。保持终端窗口开启。
4. 点击“开启手势魔法”，允许浏览器使用摄像头。可先用鼠标按住/松开体验花朵。
5. 停止时在终端按 Control+C，或关闭终端窗口。

首次打开：如果 macOS 提示无法验证开发者，请先确认文件来自本项目的 GitHub 下载链接，
然后在“系统设置 → 隐私与安全性”中找到刚刚被阻止的项目，选择“仍要打开”，按系统提示确认。
部分 macOS 版本也可右键“启动花园.command”并选择“打开”。
此包没有 Apple 应用公证；不会修改 Gatekeeper 设置、删除隔离属性或关闭系统安全验证。

如果摄像头不可用：检查浏览器的网站摄像头权限，以及“系统设置 → 隐私与安全性 → 摄像头”中的浏览器权限。
建议使用最新版 Chrome 或 Edge。请勿直接双击 site/index.html，摄像头与模型需要通过启动程序提供的本地 HTTP 服务加载。
如果浏览器没有自动打开，将终端显示的 http://127.0.0.1:端口 地址复制到浏览器地址栏。

包中已包含网页、模型和官方 Node.js 运行时，不需要安装 Node.js、npm 或下载运行时依赖。
两种运行时均已按 Node.js 官方 SHA-256 列表验证。请保留整个文件夹结构，不要单独移动启动文件。
网页和本地服务可以在云环境验证；Mac Finder 启动、Gatekeeper 确认和真实摄像头需要在 Mac 上实测。
''', encoding='utf-8')
    output = ROOT / 'downloads/fingertip-bloom-mac.zip'
    output.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(package.rglob('*')):
            if file.is_file():
                archive.write(file, Path(package.name) / file.relative_to(package))
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        for name in ['启动花园.command', 'runtime/arm64/node', 'runtime/x64/node']:
            info = archive.getinfo(f'{package.name}/{name}')
            assert (info.external_attr >> 16) & 0o111, f'Missing executable mode: {name}'
    with output.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    sums_path = ROOT / 'downloads/SHA256SUMS'
    current = sums_path.read_text() if sums_path.exists() else ''
    current = ''.join(line + '\n' for line in current.splitlines() if not line.endswith('  ' + output.name))
    sums_path.write_text(current + f'{digest}  {output.name}\n')
    print(f'Package: {output}', flush=True)
    print(f'Size: {output.stat().st_size / 1024 / 1024:.1f} MiB', flush=True)
    if output.stat().st_size >= 100 * 1024 * 1024:
        raise RuntimeError('Package exceeds GitHub file size limit; split architectures before delivery.')
