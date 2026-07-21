import nextConfig from "eslint-config-next";

const eslintConfig = [
  { ignores: ["legacy/**", ".next/**", "node_modules/**"] },
  ...nextConfig,
];

export default eslintConfig;
