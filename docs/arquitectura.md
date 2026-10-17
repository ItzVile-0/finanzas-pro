# Arquitectura — Finanzas Pro

> Leer al instalar dependencias, tocar navegación, tema/tipografía, animaciones, base de datos o al no saber dónde va un archivo.

## Tecnologías

| Pieza | Elección | Motivo |
|---|---|---|
| Framework | React Native + **Expo** SDK 57 (expo 57.0.28, expo-router 57.0.26). React Compiler habilitado | Nativo multiplataforma, prueba inmediata con Expo Go |
| Lenguaje | **TypeScript** (strict) | Tipos para reglas financieras |
| Navegación | **Expo Router**. Pestañas nativas en `src/app/(tabs)/` (`NativeTabs`, `labelVisibilityMode="labeled"`); Stack raíz con formularios modales | Rutas por archivos |
| Base de datos | **expo-sqlite** ~57.0.4 (`finanzas.db`, `SQLiteProvider` + `onInit={migrate}` en `src/app/_layout.tsx`; pantallas usan `useSQLiteContext`/`useLedger`). Escrituras multi-paso con `db.withTransactionAsync`. IDs con `randomUUID` de **expo-crypto** ~57.0.4 | Local, persistente, transacciones reales |
| Calendario | Propio en JS: `CalendarModal` (`src/components/calendar-modal.tsx`), cuadrícula en `src/domain/calendar.ts` | Usa el tema de la app; el nativo de Android seguía el del sistema |
| Gráficos | **react-native-svg** 15.15.4 (`src/components/charts/`), datos en `src/domain/charts.ts` | Módulo del SDK 57: viene en Expo Go y se enlaza solo en el APK |
| Vibración | **expo-haptics** 57.0.3 (`src/components/haptics.ts`) | Motor háptico del sistema; respeta su ajuste |
| Hoja inferior | Propia: `BottomSheet` (Modal + Reanimated + react-native-gesture-handler); `GestureHandlerRootView` en `_layout.tsx` | Sin dependencias nuevas |
| Migraciones | `PRAGMA user_version` + lista ordenada en `src/db/migrations.ts` | Sin ORM: SQL explícito |
| Validación | Hoy a mano en `src/domain` con tests; **zod** en Fase 6 (respaldos importados) | YAGNI |
| Gráficos | Barras propias con `View`; si hace falta más: `react-native-gifted-charts` + `react-native-svg` | YAGNI |
| Seguridad | `expo-local-authentication` + `expo-secure-store` | Fase 6 |
| Respaldo | `expo-file-system` + `expo-sharing` + `expo-document-picker` | Fase 6 |
| Pruebas | **Jest** + `jest-expo` (jest ~29.7.0, jest-expo ~57.0.6, @types/jest 29.5.14; preset en `package.json`). `tsconfig.json` declara `"types": ["jest"]` (TS 6) | Lógica de `src/domain` testeable sin teléfono |
| Íconos | Pestañas: `NativeTabs.Trigger.Icon md="…" sf="…"`. Pantallas: `SymbolView` de `expo-symbols` con `name={{ ios, android }}` | Sin PNG ni dependencias |
| Tema | `src/constants/theme.ts`. Tokens por modo: `text`, `background`, `backgroundElement`, `backgroundSelected`, `textSecondary`, `border`, `primary`, `income`, `expense`, `business`, `highlight` (tarjeta de saldo), `separator`, `track` (fondo de barras). Fondos tintados = color + `'26'` (≈ 15 %) | Sin dependencias |
| Tipografía y tamaños | **Inter** (`@expo-google-fonts/inter` ^0.4.2 + `expo-font`), 400/500/600/700 con `useFonts` en `_layout.tsx`. Tokens en `src/constants/tokens.ts` (`buildTokens`: `font`, `type` display…link, `input`, `amount`, `space`, `radius`, `border`, `icon`, `avatar`, `size`), leídos con `useTokens()` y `makeStyles((t) => …)` (`src/hooks/use-tokens.ts`); `ThemedText type=`. Test guardián `no-hardcoded.test.ts`. En Android el peso lo da la familia. Importes con `fontVariant: ['tabular-nums']` | Etiquetas de la barra nativa: fuente del sistema |
| Animación | `react-native-reanimated`. `pressable-scale.tsx` (0,97 con spring), `use-count-up.ts` (≤ 700 ms), `FadeInDown` escalonado | Sin dependencias nuevas |
| Lint | `eslint` ^9 + `eslint-config-expo` ~57.0.2, `eslint.config.js` | Plantilla |
| APK | Ver `docs/apk.md` | |

Entorno verificado 2026-10-13: Node v24.15.0 · npm 11.12.1 · Git 2.54.0 · VS Code 1.141.1.

## Estructura de carpetas

```
finanzas-pro/
├─ src/
│  ├─ app/                   # Pantallas (Expo Router). Solo UI.
│  │  ├─ _layout.tsx         # Raíz: fuentes, tema, SQLiteProvider, Stack
│  │  ├─ (tabs)/             # _layout (AppTabs) + index (Panel), movimientos, eroselle, informes, ajustes
│  │  ├─ cuenta-nueva.tsx    # Formulario (modal)
│  │  └─ movimiento-nuevo.tsx
│  ├─ components/            # app-tabs, themed-text, titled-screen, animated-icon (copia del splash), breathing, pressable-scale, form, icon-circle, movement-row, panel (Enter/Screen/Figure/Line), period-header, fit-text, greeting, grow, animated-row, day-list, undo-toast
│  ├─ constants/             # theme + colors (paleta y acentos), tokens (buildTokens), font-files (fuentes por peso)
│  ├─ hooks/                 # use-color-scheme, use-theme, use-appearance, use-tokens, use-motion, use-draw, use-hide-on-scroll, use-screen-reader, use-count-up, use-ledger, use-settings
│  ├─ domain/                # Lógica PURA + tests: money, dates, ledger (validación y saldos), summary, eroselle (inversión y venta), backup, csv
│  └─ db/                    # migrations, ledger (repositorio SQL, también EROSELLE), ledger-cache (caché con total_changes), backup, settings, seed (datos [PRUEBA] y extremos, solo __DEV__)
├─ docs/                     # arquitectura, modelo-datos, decisiones, apk
├─ assets/ · app.json · package.json
└─ Instrucciones.md
```

- La barra inferior está en `src/components/app-tabs.tsx` (+ `.web.tsx`). Inspeccionar antes de modificar.
- `*.web.tsx` / `*.module.css`: versión web (no es objetivo), no borrarlos sin revisar quién los importa.
- `scripts/reset-project.js` (plantilla): NO ejecutarlo sin revisar qué borra.
- Tipos de rutas (`.expo/types/router.d.ts`) los genera el servidor de Expo: tras crear una pantalla nueva, `tsc` falla con la ruta nueva hasta arrancar el servidor una vez. Si `tsc` falla en `app-tabs.web.tsx` con rutas raras (`/../domain/...`), reiniciar `npx expo start --tunnel`.
