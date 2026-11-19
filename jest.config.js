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
      // Requiere un proyecto de Supabase de pruebas (TEST_DATABASE_URL en .env.test) o Supabase local (`npm run db:start`).
      // 60 s por prueba: con una base remota cada consulta tarda decenas de milisegundos y varias pruebas hacen decenas.
      displayName: "rls",
      testEnvironment: "node",
      testTimeout: 60000,
      transform: {},
      testMatch: ["<rootDir>/tests/rls/**/*.test.js"],
    },
  ],
};
