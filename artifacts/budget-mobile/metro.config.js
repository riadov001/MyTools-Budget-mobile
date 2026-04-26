const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// ---------------------------------------------------------------------------
// Cross-artifact /shared folder support (zero-regression overlay)
// ---------------------------------------------------------------------------
// The mobile app may import from `@mytools/shared/*`. These resolve to the
// monorepo-root `/shared` directory. We intercept ONLY this specific
// namespace in Metro's resolver — every other import keeps the default
// behavior so existing modules continue to work untouched.
const MONOREPO_ROOT = path.resolve(__dirname, "../..");
const SHARED_ROOT = path.resolve(MONOREPO_ROOT, "shared");
const SHARED_NAMESPACE = "@mytools/shared";

const previousResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === SHARED_NAMESPACE ||
    moduleName.startsWith(SHARED_NAMESPACE + "/")
  ) {
    const sub = moduleName.slice((SHARED_NAMESPACE + "/").length);
    const target = sub ? path.join(SHARED_ROOT, sub) : SHARED_ROOT;
    return context.resolveRequest(
      { ...context, resolveRequest: previousResolveRequest ?? null },
      target,
      platform,
    );
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Metro must watch /shared so changes hot-reload while developing.
config.watchFolders = [...(config.watchFolders ?? []), SHARED_ROOT];

module.exports = config;
