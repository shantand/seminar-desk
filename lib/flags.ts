import { FEATURE_FLAG_DEFS, type FeatureFlags } from './types';

// Deployment-level feature flags. Unlike a per-admin database setting,
// these are set once per deployment via an env var (a Cloudflare
// Worker `var`/secret, a `.env` file, a Docker `-e`, a host's
// dashboard env-var setting - whatever the target platform calls it)
// and read fresh on every request via process.env - there is no admin
// UI to flip them. Changing one means editing the var for that
// deployment and redeploying, which is the point: different
// self-hosted instances can ship with different defaults, but nobody
// signed in to one instance can toggle it for everyone else.
//
// Reads process.env rather than Cloudflare's `cloudflare:workers` env
// import so this file has no Cloudflare-specific dependency. On this
// project's Cloudflare deployment, process.env is populated from the
// Worker's configured vars/secrets because the `nodejs_compat`
// compatibility flag is enabled (see wrangler.json); on any other
// Node-compatible host, process.env works the normal way.
//
// Env var name is FEATURE_<KEY_UPPERCASED>, e.g. the flag
// "registrations_table_view" reads FEATURE_REGISTRATIONS_TABLE_VIEW.
// Accepted values (case-insensitive): "1"/"0", "true"/"false",
// "on"/"off", "yes"/"no". Anything else (including unset) falls back
// to the flag's built-in default in lib/types.ts.
function parseFlagVar(raw: string | undefined): boolean | undefined {
    if (raw === undefined) return undefined;
    const v = raw.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
    return undefined;
}

export function getDeploymentFlags(): FeatureFlags {
    const flags = {} as FeatureFlags;
    for (const def of FEATURE_FLAG_DEFS) {
        const envKey = `FEATURE_${def.key.toUpperCase()}`;
        const override = parseFlagVar(process.env[envKey]);
        flags[def.key] = override !== undefined ? override : def.default;
    }
    return flags;
}
