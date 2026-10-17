# Finanzas Pro

Aplicación móvil de finanzas personales para Android, hecha con Expo y React Native. Registra cuentas, ingresos, gastos y transferencias en pesos colombianos, y guarda todo **en el teléfono** (SQLite), sin servidores ni conexión a internet.

Incluye un módulo opcional de **tienda** para llevar un control sencillo de inversión y ventas de un pequeño negocio, separado de las finanzas personales.

## Funciones principales

- **Cuentas y movimientos**: gastos, ingresos y transferencias con fecha contable. El saldo se valida al cierre de cada día, así que ningún cambio (crear, editar o eliminar) puede dejar una cuenta en negativo en el pasado.
- **Categorías** con ícono y color, que se pueden crear, renombrar, archivar o eliminar.
- **Presupuestos** mensuales por categoría, con alertas cuando se acercan al límite.
- **Pagos recurrentes** (semanales, quincenales, mensuales…) que solo afectan el saldo al confirmarlos.
- **Panel e informes**: ingresos, gastos y ahorro por periodo, comparación con el periodo anterior, gráfico de dona por categoría y evolución de los últimos 6 meses.
- **Tienda opcional**: inversiones y ventas por canal (WhatsApp, Instagram, etc.), ganancia del periodo y acumulada.
- **Búsqueda y filtros** de movimientos por texto, tipo, categoría, cuenta y periodo.
- **Eliminar con deshacer** y opción para **ocultar cifras**.
- **Copia de seguridad cifrada** (`.fpbak`, AES-256-GCM con clave derivada por scrypt) y restauración con vista previa.
- **Exportación a CSV** para abrir en Excel.
- **Notificaciones locales**: recordatorio de registrar gastos, pagos próximos, copia de seguridad y resumen semanal.
- **Apariencia personalizable**: tema claro/oscuro, color de acento, 7 fuentes, tamaño de letra, densidad, esquinas y nivel de animaciones (respeta "reducir animaciones" del sistema).

## Tecnologías

| Pieza | Uso |
|---|---|
| [Expo SDK 57](https://docs.expo.dev) | Plataforma y herramientas de compilación (EAS Build) |
| React Native + React | Interfaz nativa |
| TypeScript (strict) | Tipado de toda la lógica, en especial las reglas de dinero |
| Expo Router | Navegación basada en archivos (`src/app/`) |
| expo-sqlite | Base de datos local con migraciones (`PRAGMA user_version`) |
| React Native Reanimated | Animaciones |
| react-native-svg | Gráficos |
| Jest + jest-expo | Pruebas de la lógica de dominio y de la base de datos |

## Requisitos

- [Node.js](https://nodejs.org) LTS
- La app **Expo Go** en un teléfono Android, o un emulador

## Instalación y ejecución

```bash
npm install
npx expo start
```

Escanea el código QR con Expo Go. Si el teléfono y el computador no están en la misma red, usa `npx expo start --tunnel`.

> Las notificaciones necesitan la app instalada (APK o build de desarrollo): Expo Go no incluye ese módulo nativo.

## Pruebas y calidad

```bash
npx jest            # pruebas
npx tsc --noEmit    # verificación de tipos
npx expo lint       # lint
```

## Estructura de carpetas

```
finanzas-pro/
├─ src/
│  ├─ app/          # Pantallas (Expo Router); (tabs)/ contiene las pestañas
│  ├─ components/   # Componentes reutilizables y gráficos
│  ├─ constants/    # Colores, tokens de diseño y fuentes
│  ├─ hooks/        # Hooks de tema, apariencia, animación y datos
│  ├─ domain/       # Lógica pura en TypeScript (dinero, saldos, periodos, presupuestos…) con sus pruebas
│  └─ db/           # Migraciones, repositorio SQLite, copias de seguridad, ajustes y notificaciones
├─ assets/          # Íconos, splash e imágenes
├─ design/          # Fuentes de diseño del ícono
├─ plugins/         # Config plugins de Expo
├─ scripts/         # Scripts auxiliares (generación de íconos)
├─ docs/            # Arquitectura, modelo de datos, decisiones técnicas y guía del APK
├─ Instrucciones.md # Manual paso a paso para instalar, probar y generar el APK
└─ VERIFICACION.md  # Lista de verificación manual
```

## Generar el APK

El APK se compila en la nube con EAS Build (perfil `preview`):

```bash
npx eas-cli@latest build -p android --profile preview
```

Los detalles (cuenta, clave de firma y actualizaciones sin perder datos) están en [`docs/apk.md`](docs/apk.md).
