import { runtimeIdentity } from './identity.js';

export const OFFICIAL_REPOSITORY = 'mavalenzuela22/dev-foundry-claude';
const digest = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

// Attestation is supplied by a trusted caller/Operator, never manufactured from
// a target manifest or same-release SHA256SUMS. This does not authenticate a
// publisher: it retains the caller's independently selected trust disposition.
// No network, archive parsing, extraction or target code execution exists in B1.
export function acquisitionPlan({ kind, expect, provenance, transition } = {}) {
  const blocked = (code) => ({ status: 'blocked', runnable: false, code });
  try {
    const identity = runtimeIdentity(expect);
    if (kind !== 'unpacked-local') return blocked('offline-unpacked-only');
    const p = provenance;
    if (p?.format !== 'dev-foundry.runtime-attestation.v1' || p.repository !== OFFICIAL_REPOSITORY ||
        p.tag !== `v${identity.version}` || ![ `dev-foundry-claude-adapter-${identity.version}.tgz`, 'dev-foundry-claude-adapter.tgz' ].includes(p.asset) ||
        p.url !== `https://github.com/${OFFICIAL_REPOSITORY}/releases/download/${p.tag}/${p.asset}` ||
        !digest(p.observedAssetSha256) || p.payloadSelfPin !== expect) return blocked('release-provenance-incomplete');
    const trust = p.trust;
    if (!trust || trust.assetSha256 !== p.observedAssetSha256 || trust.payloadSelfPin !== expect ||
        typeof trust.evidence !== 'string' || !trust.evidence.trim() ||
        !['independent-digest', 'operator-origin-and-hash'].includes(trust.kind) ||
        (trust.kind === 'operator-origin-and-hash' && trust.approved !== true)) return blocked('release-unapproved');
    runtimeIdentity(transition?.source);
    if (transition?.target !== expect || transition?.supported !== true ||
        typeof transition.declaration !== 'string' || !transition.declaration.trim() ||
        trust.transitionDeclaration !== transition.declaration) return blocked('transition-unapproved');
    // A declaration is attested input, not a migration implementation or approval
    // to adopt target authority. B2 must reconcile shipped migration material.
    return { status: 'approved-local-stage', runnable: false, identity,
      provenance: structuredClone(p), transition: structuredClone(transition) };
  } catch { return blocked('identity-or-transition-invalid'); }
}
