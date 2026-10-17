# Modelo de datos — Finanzas Pro

> Leer al crear o cambiar tablas, migraciones, repositorios (`src/db`) o respaldos.
> Esquema REAL vigente: `src/db/migrations.ts` (manda sobre este documento si difieren).

## Tablas previstas

`transactions.scope`: `personal` = movimiento personal; `business` = registro de la tienda (inversión o venta). Todas las cuentas son `personal` desde la migración 5.

| Tabla | Campos clave |
|---|---|
| `accounts` | id, scope, name, type (cash/bank/savings/wallet/other), opening_balance, allow_negative, archived |
| `categories` | id, scope, kind (income/expense), name, parent_id, archived |
| `transactions` | id, scope, kind (income/expense/transfer/capital_contribution/owner_withdrawal), amount (>0), date, account_id, to_account_id?, category_id?, source?, payment_method?, expense_type? (fixed/variable/occasional/extraordinary), recurring_id?, note, reversal_of_id UNIQUE?, created_at |
| `recurring_payments` | id, scope, concept, estimated_amount, frequency (weekly/biweekly/monthly/yearly), anchor_date, next_due_date, account_id, category_id, active, created_at |
| `budgets` | id, category_id UNIQUE, amount, alert_pct (1–100, por defecto 80), created_at — el mismo monto todos los meses |
| `channels` | id, name, sort_order, archived — canales de venta de la tienda (migración 6) |
| `settings` | key, value (tema, nombre app, última copia, ocultar cifras, etc.) |

- Tienda: inversiones (`expense`, `cat-b-inversion`) y ventas (`income`, `cat-b-venta`, `channel_id`) en `transactions` con `scope='business'`. Tabla propia solo para los canales.

## Estado actual (migración 4, 2026-10-14)

- Creadas: `accounts`, `categories` (18 categorías personales con IDs fijos `cat-p-…`; `cat-p-nomina` = Nómina), `transactions` (los 5 `kind` en el CHECK; columnas `source`, `payment_method`, `expense_type`, `recurring_id`, `reversal_of_id` se agregarán con `ALTER TABLE ADD COLUMN` cuando se usen).
- Migración 2: `settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`, sin filas iniciales. Claves: `theme` (`system`/`light`/`dark`), `hide_amounts` (`1`/`0`), `period` (`current_month`, `previous_month`, `last_3_months`, `last_6_months`, `current_year` o `custom:AAAA-MM-DD:AAAA-MM-DD`). Se validan al leer (`parseSettings`): valor faltante o inválido → valor por defecto. Se guardan con `INSERT … ON CONFLICT(key) DO UPDATE`. Clave `last_accounts`: JSON `{kind: {from, to}}` (registro rápido), validado entrada por entrada. Clave `last_backup_at`: instante ISO de la última copia exportada en este teléfono (`Settings.lastBackupAt`; inválido → null); no viaja en la copia. Clave `accent`: `gold`/`silver`/`emerald`/`copper`/`sapphire` (otro valor → `gold`). Apariencia (4g): `font` (`inter`, `manrope`, `poppins`, `dm-sans`, `nunito`, `space-grotesk`, `lora`), `text_scale` (`small`/`normal`/`large`/`xlarge`), `density` (`compact`/`normal`/`comfortable`), `corners` (`rounded`/`soft`/`straight`), `animations` (`full`/`soft`/`off`), `haptics` (`1`/`0`), `week_start` (`sunday`/`monday`), `user_name` (texto normalizado, máx. 30 caracteres) y `home_cards` (JSON `[{id, visible}]`, ids `store` (antes de la migración 6 se llamaba distinto; la migración lo renombra), `budgets`, `upcoming`, `income`, `accounts`, `recent`). Inválido o faltante → por defecto (copias viejas se restauran igual). Clave `last_channel`: id del canal de la última venta (se usa solo si sigue activo). Tienda (migración 6): `store_enabled` (`1`/`0`), `store_name` (máx. 30; vacío → "Mi tienda"). Del teléfono (no viajan en la copia): `onboarding_done` (`1` = bienvenida vista o saltada) y `notifications` (JSON `{recurring, daily, backup, weekly: {on, time "HH:MM"}, showAmounts}`, validado entrada por entrada).
- Migración 3: `categories.icon` y `categories.color` (`TEXT NOT NULL`, por defecto `'tag'`/`'slate'`), claves del catálogo de `src/domain/category-style.ts`; las 18 base reciben su ícono y color (`BASE_CATEGORY_STYLE`). Al leer, una clave desconocida usa la de por defecto.
- Migración 4: `budgets` (un presupuesto por categoría de gasto, mismo monto todos los meses; el gasto del mes se calcula, no se guarda) y `recurring_payments` (plantillas: no afectan el saldo). `anchor_date` = primera cuota (de ella sale el día del mes: un pago del 31 vuelve al 31 tras febrero); editar la fecha reinicia el ancla. `transactions.recurring_id` + `recurring_due`: plantilla y cuota que pagó cada gasto; al eliminar el gasto de la última cuota pagada, la plantilla vuelve a esa cuota. Eliminar una plantilla deja sus gastos (con `recurring_id = NULL`).
- Migraciones: nunca editar una publicada; agregar una nueva al final de `MIGRATIONS` (índice + 1 = `user_version`).
- **Regla de compatibilidad con las copias (2026-10-16):** las migraciones solo **agregan** columnas (con valor por defecto o NULL) y tablas. Así una copia de una versión anterior se restaura tal cual: lo que falta queda por defecto o vacío. Una migración que renombre, quite o transforme datos debe traer su propia conversión en el restaurador (`checkBackup`/`restoreStatements`) y un test con una copia de la versión anterior.

## Seguridad y respaldo (Fase 6)

Decidido el 2026-10-16 (cambia lo anterior: ya no hay JSON legible ni zod; el PIN o la huella van en otra etapa).

- **Archivo `.fpbak`** (`src/domain/backup.ts`): JSON con la cabecera `{ format: 'finanzas-pro-backup', v: 1, schema_version, exported_at, kdf: { N, r, p, salt } }` en claro pero autenticada (AAD), más `nonce` y `data` en hex. `data` = JSON de las tablas `accounts, categories, recurring_payments, budgets, channels, transactions, settings`, cifrado con **AES-256-GCM** (`@noble/ciphers`). La clave sale de la contraseña con **scrypt** (`@noble/hashes`; parámetros en el archivo, con tope al leerlo; N=2^12, r=8, p=1 medido en el teléfono, con `scryptAsync`). El salt (16 bytes) y el nonce (12 bytes) los pone quien llama, con `expo-crypto`.
- Contraseña de **12 caracteres o más**, escrita dos veces y sin forma de recuperarla. Una contraseña incorrecta y un archivo alterado dan el mismo error: "Contraseña incorrecta o archivo dañado."
- **Revisión antes de tocar nada** (`checkBackup`, sin zod): se rechazan una versión de la base más nueva, una tabla o columna que no exista en la base actual (según `PRAGMA table_info`) y valores que no sean texto, entero o null. Los obligatorios, los CHECK y las llaves foráneas los hace cumplir SQLite.
- **Restaurar** (`restoreStatements`) en **una** transacción: `PRAGMA defer_foreign_keys = ON`, borrado en orden inverso e inserción en orden. Antes de confirmar se corre `PRAGMA foreign_key_check`: si hay algo roto, ROLLBACK y no cambia nada.
- **Ajustes:** el tema, ocultar cifras, el periodo, `last_accounts`, `last_channel`, `accent` y todas las claves de apariencia, nombre y tarjetas del Inicio viajan en la copia y se restauran (el tema se aplica al instante). `last_backup_at`, `onboarding_done` y `notifications` son propios del teléfono: no viajan y no se pisan.
- Antes de restaurar se guarda una copia automática sin cifrar de los datos actuales en `Paths.document/antes-de-restaurar.json` (solo la última; si no se puede escribir, no se restaura). "Volver a los datos de antes" la aplica igual que una copia y la borra. SQL y archivos en `src/db/backup.ts`.
- **CSV** (`src/domain/csv.ts`): movimientos personales, separador `;`, UTF-8 con BOM, CRLF, monto entero y fórmulas neutralizadas con `'`. No va cifrado: la app lo advierte. Más adelante, CSV de ventas, gastos de EROSELLE e inventario.

## EROSELLE sencillo (migración 5, 2026-10-16)

- Decisión del usuario: control sencillo de inversión y venta. La versión con productos, inventario y compras (5a) se revirtió sin llegar al APK.
- **Migración 5:** `transactions.channel TEXT` (CHECK: NULL o `whatsapp`/`instagram`/`marketplace`/`web`); categorías fijas `cat-b-inversion` (business, expense) y `cat-b-venta` (business, income); conversión de datos v4: `capital_contribution`/`owner_withdrawal` → `transfer` con `scope='personal'` y cuentas `business` → `personal`. Los saldos no cambian (aporte, retiro y transferencia mueven el dinero igual).
- **Copias v4:** el restaurador aplica la misma conversión antes de insertar (`upgradeBackup`), y agrega las categorías `cat-b-…` si faltan.
- Venta: `channel` obligatorio; inversión: `channel` NULL. El CHECK de la tabla y `validateRecord` lo aseguran.

## Tienda opcional (migración 6, 2026-10-17)

- **Migración 6** (solo agrega): tabla `channels (id, name, sort_order, archived)` con los 4 canales de siempre (`whatsapp`, `instagram`, `marketplace`, `web`: los mismos ids); `transactions.channel_id TEXT REFERENCES channels(id)` con índice, y `channel_id = channel` en cada venta. La columna `channel` (CHECK con 4 canales fijos) **ya no se escribe**: solo se conserva al deshacer una eliminación. Las categorías fijas pasan a "Inversión de la tienda" / "Venta de la tienda" (no se muestran).
- Si la base tiene cuentas (ya estaba en uso): `store_enabled = 1`, `store_name` = el nombre de la tienda del usuario, `onboarding_done = 1`, y en `home_cards` la tarjeta pasa a `store`. Base sin cuentas: nada de eso (bienvenida, tienda desactivada).
- **Copias v4 y v5** (`upgradeBackup`): se crean los 4 canales si la copia no trae `channels`, `channel_id = channel`, categorías renombradas y, si hay registros de la tienda y la copia no trae sus ajustes, la tienda activada con el nombre de la categoría de venta ("Venta <nombre>"; v4 → "Mi tienda"). En `home_cards` de una copia v5, el id que ya no existe (el de la tienda) pasa a `store`, con su orden y visibilidad. Una copia sin `home_cards` no pisa las del teléfono (`restoreStatements` las conserva).
- Venta: `channel_id` obligatorio, de un canal activo (al editar se acepta el archivado que ya tenía). Canal con ventas no se elimina; el último activo no se archiva ni elimina (`channelRemoval`).
