// Metro config for a pnpm-workspace monorepo (Expo's own documented pattern,
// adapted for pnpm's symlinked node_modules rather than yarn/npm workspaces'
// hoisted layout). Without this, Metro cannot resolve `@ngc/services`/`@ngc/db`
// (workspace:* packages one level up, outside this app's own node_modules
// tree) or the hoisted copies of shared deps (react, etc.) that pnpm places
// in the workspace root's node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits to packages/services etc. trigger a
// re-bundle, not just edits inside apps/mobile itself.
config.watchFolders = [workspaceRoot];

// Look in this app's own node_modules first, then fall back to the
// workspace root's — mirrors pnpm's own resolution order.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules"), path.resolve(workspaceRoot, "node_modules")];

// pnpm stores packages in a content-addressed `.pnpm` store and symlinks
// them into place — Metro must follow those symlinks (off by default).
//
// Deliberately NOT setting `disableHierarchicalLookup: true` here, despite
// that being part of Expo's own documented Yarn/npm-workspace monorepo
// recipe: that flag disables Metro's normal "walk up from the requiring
// file, checking each ancestor's own node_modules" resolution and replaces
// it with ONLY the `nodeModulesPaths` list above. Under pnpm's strict,
// symlinked layout, a package's OWN transitive dependencies live nested
// inside its own `node_modules` inside the `.pnpm` store (e.g.
// `expo-router`'s dependency on `@expo/metro-runtime` resolves via
// `.pnpm/expo-router@.../node_modules/@expo/metro-runtime`, not via
// anything hoisted to this app's or the workspace root's `node_modules`).
// Turning off hierarchical lookup breaks exactly that case — confirmed by
// actually running `expo export` with it on and hitting "Unable to resolve
// module @expo/metro-runtime". Leaving hierarchical lookup on lets Metro
// find both: local per-package deps (via the normal walk-up, now that
// symlinks are followed) and the cross-workspace `@ngc/*` packages (via
// `watchFolders` + `nodeModulesPaths` above, since those aren't reachable
// by walking up from apps/mobile alone).
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
