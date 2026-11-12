/** Jest con módulos ES. Se ejecuta con `node --experimental-vm-modules` (ver package.json). */
export default {
  transform: {},
  projects: [
    {
      displayName: "unit",
      testEnvironment: "jsdom",
      transform: {},
      testMatch: ["<rootDir>/tests/unit/**/*.test.js"],
    },
    {
      // Requiere Docker y Supabase local (`npm run db:start`).
      displayName: "rls",
      testEnvironment: "node",
      transform: {},
      testMatch: ["<rootDir>/tests/rls/**/*.test.js"],
    },
  ],
};
