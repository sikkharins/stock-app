import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/react-vite",
  // Strip the PWA plugin from Vite when building Storybook — VitePWA's Workbox precache
  // step balks on Storybook's giant globals-runtime.js asset. We don't need PWA in a
  // component catalog anyway. VitePWA returns nested arrays of internal plugins; recurse.
  viteFinal: async (cfg) => {
    const stripPwa = (plugins: unknown): unknown => {
      if (!Array.isArray(plugins)) return plugins;
      return plugins
        .map((p) => (Array.isArray(p) ? stripPwa(p) : p))
        .filter((p) => {
          if (!p) return false;
          if (Array.isArray(p)) return p.length > 0;
          const name = (p as { name?: string }).name ?? "";
          return !name.includes("pwa") && !name.includes("workbox");
        });
    };
    cfg.plugins = stripPwa(cfg.plugins) as typeof cfg.plugins;
    return cfg;
  },
};
export default config;
