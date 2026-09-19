# Gastos familiares · Panel financiero

Panel privado conectado a Neon Auth y Neon Data API.

## Desarrollo local

```bash
npm install
npm run build
```

El Worker generado queda en `dist/server/index.js`. Para desplegarlo en Sites se usa la configuración de `.openai/hosting.json`.

La aplicación usa autenticación con Google a través de Neon Auth y consulta los datos mediante el endpoint interno `/api/finance`.
