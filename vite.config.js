import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

/**
 * @swisseph/browser ships a broken ESM bundle: it references `exports` without
 * defining it (CommonJS leftover). Reassign `exports` to each virtual module's
 * `*_exports` object where esbuild would have wrapped per-module scope.
 */
function applySwissephCjsFix(code) {
  if (!code.includes("var enums_exports = {}")) {
    return code;
  }

  let out = code.replace(
    "var enums_exports = {};",
    `var enums_exports = {};
var index_exports = {};
var exports = enums_exports;`
  );

  out = out.replace(
    `// ../core/dist/index.js
Object.defineProperty(exports, "__esModule", { value: true });`,
    `// ../core/dist/index.js
exports = index_exports;
Object.defineProperty(exports, "__esModule", { value: true });`
  );

  out = out.replace(
    "var enums_js_13 = (init_enums(), __toCommonJS(enums_exports));",
    `exports = enums_exports;
var enums_js_13 = (init_enums(), __toCommonJS(enums_exports));`
  );

  out = out.replace(
    "var implementations_js_1 = (init_implementations(), __toCommonJS(implementations_exports));",
    `exports = implementations_exports;
var implementations_js_1 = (init_implementations(), __toCommonJS(implementations_exports));`
  );

  out = out.replace(
    "var flags_js_1 = (init_flags(), __toCommonJS(flags_exports));",
    `exports = flags_exports;
var flags_js_1 = (init_flags(), __toCommonJS(flags_exports));`
  );

  out = fixSwissephVoidReferences(out);

  return out;
}

function fixSwissephVoidReferences(code) {
  if (!code.includes("(void 0).Gregorian") && !code.includes("(void 0)(flags)")) {
    return code;
  }

  let out = code;

  const replacements = [
    ["(void 0).Gregorian", "1"],
    ["(void 0).DefaultMoshier", "260"],
    ["(void 0).MoshierEphemeris", "4"],
    ['(void 0).Placidus', '"P"'],
    ["(void 0).Ascendant", "0"],
    ["(void 0).MC", "1"],
    ["(void 0).ARMC", "2"],
    ["(void 0).Vertex", "3"],
    ["(void 0).EquatorialAscendant", "4"],
    ["(void 0).CoAscendant1", "5"],
    ["(void 0).CoAscendant2", "6"],
    ["(void 0).PolarAscendant", "7"],
  ];

  for (const [from, to] of replacements) {
    out = out.replaceAll(from, to);
  }

  out = out.replaceAll("(void 0)(flags)", "flags");
  out = out.replaceAll("(void 0)(eclipseType)", "eclipseType");
  out = out.replace(
    "return new (void 0)(year, month, day, hour, calendarType);",
    "return { year, month, day, hour, calendarType };"
  );
  out = out.replace(
    `    return new (void 0)(
      retflag,
      tret[0],
      tret[1],
      tret[2],
      tret[3],
      tret[4],
      tret[5],
      tret[6]
    );
  }
  /**
   * Find next solar eclipse globally`,
    `    return {
      type: retflag,
      times: tret.slice(0, 7)
    };
  }
  /**
   * Find next solar eclipse globally`
  );
  out = out.replace(
    `    return new (void 0)(
      retflag,
      tret[0],
      tret[1],
      tret[2],
      tret[3],
      tret[4],
      tret[5],
      tret[6]
    );
  }
  /**
   * Calculate house cusps and angles`,
    `    return {
      type: retflag,
      times: tret.slice(0, 7)
    };
  }
  /**
   * Calculate house cusps and angles`
  );

  return out;
}

function swissephFixCjsExports() {
  return {
    name: "swisseph-fix-cjs-exports",
    enforce: "pre",
    transform(code, id) {
      const normalized = id.replace(/\\/g, "/");
      if (!normalized.includes("@swisseph/browser/dist/swisseph-browser.js")) {
        return null;
      }

      const fixed = applySwissephCjsFix(code);
      if (fixed === code) {
        return null;
      }

      return { code: fixed, map: null };
    },
  };
}

function swissephOptimizeDepsFix() {
  return {
    name: "swisseph-fix-cjs-exports-opt",
    setup(build) {
      build.onLoad({ filter: /swisseph-browser\.js$/ }, (args) => {
        if (!args.path.replace(/\\/g, "/").includes("@swisseph/browser/dist/")) {
          return null;
        }

        const contents = applySwissephCjsFix(readFileSync(args.path, "utf8"));
        return { contents, loader: "js" };
      });
    },
  };
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  base: "./",
  plugins: [swissephFixCjsExports()],
  optimizeDeps: {
    esbuildOptions: {
      plugins: [swissephOptimizeDepsFix()],
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },
  preview: {
    port: 4173,
    strictPort: false,
    open: true,
  },
});
