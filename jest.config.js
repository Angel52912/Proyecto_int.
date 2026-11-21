/** Jest con módulos ES. Se ejecuta con `node --experimental-vm-modules` (ver package.json). */
export default {
  transform: {},
  // 60 s por prueba (debe ir aquí: dentro de `projects` Jest lo ignora y quedan 5 s). Con una base remota cada consulta
  // tarda decenas de milisegundos y varias pruebas de RLS hacen decenas de consultas; si una prueba se pasa de tiempo
  // sigue corriendo sobre la misma conexión y arrastra a las siguientes.
  testTimeout: 60000,
  projects: [
    {
      displayName: "unit",
      testEnvironment: "jsdom",
      transform: {},
      testMatch: ["<rootDir>/front/tests/unit/**/*.test.js"],
    },
    {
      // Requiere un proyecto de Supabase de pruebas (TEST_DATABASE_URL en .env.test) o Supabase local (`npm run db:start`).
      displayName: "rls",
      testEnvironment: "node",
      transform: {},
      testMatch: ["<rootDir>/back/tests/rls/**/*.test.js"],
    },
  ],
};
