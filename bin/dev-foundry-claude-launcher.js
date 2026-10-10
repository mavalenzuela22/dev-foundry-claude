#!/usr/bin/env node
// Works without a package.json or an active adapter tree. Copy this file and
// src/runtime/launcher.js together into the separately authorized B4 host root.
(async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const crypto = await import('node:crypto');
  // The verified manager fills only this data literal during host preparation.
  const hostPinSha256 = 'unbound';
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const safeHostPath = value => {
    if (!path.isAbsolute(value) || value.split(path.sep).includes('..')) throw new Error('Stable host path must be canonical.');
    let cursor = path.parse(value).root;
    for (const part of value.slice(cursor.length).split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Stable host path must not contain symlinks.');
    }
    return value;
  };
  const entry = safeHostPath(process.argv[1]);
  if (!entry || fs.lstatSync(entry).isSymbolicLink()) throw new Error('Stable launcher path must be canonical, not a symlink.');
  const resolver = safeHostPath(path.resolve(path.dirname(entry), '../src/runtime/launcher.js'));
  if (fs.lstatSync(resolver).isSymbolicLink()) throw new Error('Stable resolver must not be a symlink.');
  const hostRoot = path.resolve(path.dirname(entry), '..');
  const config = path.join(hostRoot, 'host-pin.json');
  let host;
  if (hostPinSha256 !== 'unbound') {
    const bytes = fs.readFileSync(safeHostPath(config));
    if (hash(bytes) !== hostPinSha256) throw new Error('Stable host pin byte mismatch.');
    host = JSON.parse(bytes);
    if (host.hostRoot !== hostRoot || hash(fs.readFileSync(resolver)) !== host.launcherSha256 ||
        hash(fs.readFileSync(entry, 'utf8').replace(`const hostPinSha256 = '${hostPinSha256}';`, "const hostPinSha256 = 'unbound';")) !== host.binTemplateSha256) throw new Error('Stable host code/root mismatch.');
  } else {
    try { fs.lstatSync(config); throw new Error('Sealed host cannot downgrade to an unbound launcher.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // A data-module keeps this tiny Node-only resolver independent of host ESM
  // configuration, including Node 20 stand-alone installations.
  const api = await import('data:text/javascript;base64,' + fs.readFileSync(resolver).toString('base64'));
  process.exitCode = await api.stableLaunch(process.argv.slice(2), host ? { hostRoot, hostPinSha256 } : {});
})().catch(error => { console.error(error.message); process.exitCode = 2; });
