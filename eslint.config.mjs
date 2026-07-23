import nextConfig from "eslint-config-next";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = [
  { ignores: ["legacy/**", ".next/**", "node_modules/**"] },
  ...nextConfig,
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "bc", pattern: "src/bcs/*", capture: ["category"] },
        { type: "shared", pattern: "src/shared" },
        { type: "app", pattern: "src/app" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              disallow: {
                to: { element: { type: "bc", fileInternalPath: "!index.ts" } },
              },
              message:
                "{{to.element.captured.category}} is a bounded-context boundary — import via its barrel (src/bcs/{{to.element.captured.category}}/index.ts) or see src/bcs/{{to.element.captured.category}}/CONTRACT.md",
            },
            {
              allow: {
                dependency: { relationship: { to: "internal" } },
              },
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
