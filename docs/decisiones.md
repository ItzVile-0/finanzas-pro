# Decisiones técnicas — Finanzas Pro

> Leer antes de cambiar algo ya decidido o cuando surja la duda "¿por qué se hizo así?".
> Agregar una fila por cada decisión nueva.

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-10-13 | Expo + TS + Expo Router + expo-sqlite | Ruta más corta a un APK desde Windows sin perder arquitectura nativa ni iOS |
| 2026-10-13 | Sin ORM; migraciones con `user_version` | Menos dependencias, SQL explícito y auditable |
| 2026-10-13 | Dinero en pesos enteros | Evitar errores de punto flotante |
| 2026-10-13 | Costo promedio ponderado | Más simple que FIFO por lotes y suficiente para el negocio; el historial por lote se conserva en `purchase_items` |
| 2026-10-13 | Anulación en vez de edición para operaciones de inventario | Trazabilidad e impedir alteraciones silenciosas del costo histórico |
| 2026-10-13 | Desarrollo vía túnel (`--tunnel`) con `@expo/ngrok` como devDependency | El PC va por cable; LAN no se usó. Túnel funciona siempre |
| 2026-10-13 | Reutilizar `src/components`, `src/constants/theme.ts`, `src/hooks` de la plantilla | YAGNI: no duplicar estructura |
| 2026-10-13 | EAS Build perfil `preview` → APK | Windows no admite `eas build --local`; EAS compila en la nube |
| 2026-10-13 | `android.package` = `com.camilocabrera.finanzaspro` — **DEFINITIVO, NO CAMBIAR NUNCA** | Cambiarlo crea otra app: no se podría actualizar la instalada y se perderían los datos |
| 2026-10-13 | Convención de archivos `kebab-case.tsx` (aprobada por el usuario) | Coincide con la plantilla |
| 2026-10-13 | Lint de `use-color-scheme.web.ts` silenciado con `eslint-disable-next-line` | Código de la plantilla, solo web, no es objetivo del proyecto |
| 2026-10-13 | Íconos de pestañas con `md`/`sf` de NativeTabs | Sin PNG propios ni dependencias nuevas |
| 2026-10-13 | Tema sigue al del sistema; selector manual en Ajustes = "Próximamente" | Requiere tabla `settings` |
| 2026-10-13 | `formatCOP`/`sum` lanzan error con valores no enteros seguros | Nunca redondear dinero en silencio |
| 2026-10-13 | Panel suma solo `scope='personal'`; transferencias no cuentan como ingreso/gasto | Separación personal/EROSELLE |
| 2026-10-13 | `formatShortDate` con meses fijos en español, no `Intl` | Intl da "10 de oct"/"sept" en Node y puede variar en Hermes |
| 2026-10-13 | El Panel personal no muestra cuentas `business` | EROSELLE tiene su propia pestaña; la exclusión está cubierta por test |
| 2026-10-13 | Jest en devDependencies + `"types": ["jest"]` en tsconfig | TS 6 no incluye `@types/*` por defecto |
| 2026-10-14 | Ingresos personales: Nómina = `income`/"Nómina"; EROSELLE = `owner_withdrawal`; aportes aparte | Regla del usuario; EROSELLE nunca es ingreso personal operativo |
| 2026-10-14 | Inter vía `@expo-google-fonts/inter` | Tipografía premium; funciona en Expo Go |
| 2026-10-14 | Sin padding inferior extra en pantallas con pestañas | NativeTabs ya deja el contenido sobre la barra; el extra creaba un hueco doble |
| 2026-10-14 | `formatMonthYear` con nombres de mes fijos y fecha local | Mismo motivo que `formatShortDate` (Intl varía) |
| 2026-10-14 | Sin categoría "Gastos relacionados con EROSELLE": lo que se pone en el negocio es `capital_contribution` | Regla del usuario; evita mezclar módulos |
| 2026-10-14 | Categorías personales iniciales en la migración 1 con IDs fijos (`cat-p-…`); categorías business en la fase EROSELLE | Respaldos estables; `cat-p-nomina` identifica la Nómina |
| 2026-10-14 | Saldo negativo bloqueado en toda cuenta salvo `allow_negative` (antes solo efectivo/ahorros) | Corrección del usuario |
| 2026-10-14 | `withTransactionAsync` en vez de `withExclusiveTransactionAsync` | La conexión exclusiva no tiene `foreign_keys = ON`; el doble envío ya se evita deshabilitando el botón |
| 2026-10-14 | Fecha por defecto = `todayLocal()`, nunca `toISOString()` | En UTC−5 después de las 7 p. m. daría el día siguiente |
| 2026-10-14 | Importes escritos se convierten con `parseCOP` (acepta 1.500.000 / $ 1.500.000 / 1500000; rechaza decimales) | Nunca redondear en silencio |
| 2026-10-14 | Pestañas en `src/app/(tabs)/` + Stack raíz con formularios modales | Patrón estándar de Expo Router para pantallas fuera de la barra |
| 2026-10-14 | Datos [PRUEBA] con IDs fijos `prueba-…`, idempotentes, mismo `saveMovement` que la app, solo `__DEV__` | Probar sin ensuciar el APK |
| 2026-10-14 | Libro completo en memoria para calcular saldos (`loadLedger`) | Volumen personal pequeño; `shortcut:` anotado para pasar a SUM en SQL |
| 2026-10-14 | Documentación técnica en `docs/` (arquitectura, modelo-datos, decisiones, apk) | Cada tema en su archivo |
| 2026-10-14 | Miles en vivo con `formatCOPInput(next, prev)`: solo agrupa dígitos; deja intacto lo no numérico y los pegados que terminan en ".5"/".50" | Nunca leer otro número en silencio: parseCOP muestra el error |
| 2026-10-14 | `MoneyField` fija el cursor al final (`selection`) | Al insertar puntos el cursor saltaba al medio; editar en medio del número queda fuera (`shortcut:`) |
| 2026-10-14 | `ComingSoon` con prop `soon` en vez de otro componente | Reutilizar; Ajustes ya tiene contenido |
| 2026-10-14 | Saldo validado al **cierre de cada fecha contable** de las cuentas afectadas (origen y destino, viejas y nuevas), al crear, editar y eliminar (`checkHistory`) | Borrar un ingreso ya gastado o un gasto con fecha pasada dejaba días en negativo; el orden dentro del día no es confiable |
| 2026-10-14 | Datos viejos ya en negativo: solo se rechaza el cambio que empeora el peor punto | Poder corregir esos datos sin quedar bloqueado |
| 2026-10-14 | Sin fechas futuras en movimientos (calendario con `maximumDate` + `validateMovement`) | Lo programado irá en el módulo de pagos recurrentes |
| 2026-10-14 | Editar no cambia el `kind` (chips deshabilitados + `UPDATE … WHERE kind = ?`) | Cambiar tipo cambia categoría/destino/reglas; se elimina y se crea de nuevo |
| 2026-10-14 | Editar reutiliza `movimiento-nuevo.tsx` con `?id=` | Mismo formulario y validaciones; sin pantalla duplicada |
| 2026-10-14 | Archivar cuenta solo con saldo $ 0 | El saldo total solo suma cuentas activas; archivar con saldo haría "desaparecer" dinero |
| 2026-10-14 | Ajustes → Cuentas lista personales, EROSELLE y archivadas | El Panel solo muestra personales activas: sin esto no se podría desarchivar ni editar una cuenta de EROSELLE |
| 2026-10-14 | Quitar `allow_negative` exige que ningún día quede bajo 0 (sin regla de "no empeorar") | Mientras tenía el permiso no había un piso que respetar |
| 2026-10-14 | Categoría base = ID con prefijo `cat-` (fijos de la migración); no se eliminan | Datos [PRUEBA], respaldos y el resumen dependen de esos IDs; las del usuario tienen UUID |
| 2026-10-14 | Nombres de categoría únicos por scope y tipo, sin importar mayúsculas, incluidas las archivadas | Evitar dos "Transporte" en el selector |
| 2026-10-14 | Editar un movimiento acepta la cuenta/categoría archivada que ya tenía | Si no, un movimiento antiguo no se podría corregir tras archivar su cuenta |
| 2026-10-14 | `ListSection`/`ListRow` (`src/components/list-row.tsx`) para Ajustes, Cuentas y Categorías | Tres pantallas con la misma lista del Panel |
| 2026-10-14 | Ajustes en tabla `settings` clave/valor, claves y valores en inglés; se validan al leer y un valor inválido usa el de por defecto | Convención SQL en inglés (§5); un dato dañado no debe impedir abrir la app |
| 2026-10-14 | Tema con `Appearance.setColorScheme` (RN 0.86) en vez de un proveedor propio; `StatusBar style="auto"`; aplicado en `onInit` tras las migraciones | Todo `useColorScheme` (pantallas, navegación, barra inferior) se actualiza solo; en Android cambia también el modo noche nativo. Plan B si algo nativo no lo sigue: pasarle el tema directamente |
| 2026-10-14 | Guardar un ajuste aplica el cambio al instante y, si falla, vuelve al valor anterior con el error en pantalla | Nunca fingir que se guardó |
| 2026-10-14 | Periodos por meses de calendario: "Últimos N meses" = mes actual hasta hoy + N − 1 meses completos; "hasta" = hoy (salvo Mes anterior) | Comparable mes a mes y sin fechas futuras |
| 2026-10-14 | El saldo total y "Últimos movimientos" no dependen del periodo | El saldo es el de hoy; los últimos movimientos son un acceso rápido a lo reciente |
| 2026-10-14 | `openCalendar` compartido por `DateField` y `CalendarField` | Un solo punto para el calendario nativo y su `maximumDate` |
| 2026-10-14 | `ConfirmDialog` propio (Modal + Reanimated, respeta reducir movimiento) en lugar de `Alert.alert` | El Alert nativo de Android sigue el tema del sistema, no el de la app |
| 2026-10-14 | Calendario: `onValueChange`/`onDismiss` en vez de `onChange` (obsoleto en 9.1.0) | Lo indica el aviso de la librería |
| 2026-10-14 | Calendario Android sigue el tema del sistema: limitación aceptada | 9.1.0 solo tiene `themeVariant` en iOS; los diálogos (default y Material) usan el tema de la actividad. Alternativa futura: calendario propio en JS |
| 2026-10-14 | Ícono y color de categoría como claves de un catálogo cerrado (`category-style.ts`); migración 3 con sus propios datos para las 18 base | Validar es trivial, el modo oscuro tiene su tono y la migración no cambia si el catálogo cambia |
| 2026-10-14 | `tsc` valida los nombres de ícono Android (`AndroidSymbol` es una unión cerrada) | Un ícono mal escrito falla al compilar, no en el teléfono |
| 2026-10-14 | Gráficos con `react-native-svg` 15.15.4; agregación en `src/domain/charts.ts` con las mismas reglas del resumen (`isPersonalIncome`/`isPersonalExpense`) | La dona suma exactamente el gasto del periodo; la evolución siempre son los últimos 6 meses |
| 2026-10-14 | Paleta negro y dorado; tokens `primaryText`, `onPrimary`, `overlay`; tonos claros ajustados (#86651D, #237A4B, #B8433A, #A8406F) | Los propuestos no llegaban a 4,5:1 sobre la tarjeta de saldo o el fondo; `contrast.test.ts` lo verifica |
| 2026-10-14 | Paleta en `src/constants/colors.ts` (sin CSS), reexportada por `theme.ts` | Jest no carga `global.css`; así el test de contraste importa la paleta real |
| 2026-10-14 | Calendario propio (`CalendarModal`, cuadrícula en `src/domain/calendar.ts`) y se desinstala `@react-native-community/datetimepicker` | El nativo de Android seguía el tema del sistema; el propio usa los colores de la app y funciona igual en iOS |
| 2026-10-14 | `PressableScale` = `Animated.createAnimatedComponent(Pressable)`: estilo y escala en el mismo Pressable | Con el estilo en una vista interior, el área tocable no coincidía con lo visible (botón + sin respuesta, columnas desalineadas) |
| 2026-10-14 | `PrimaryButton` con `variant` primary/secondary/danger; un solo relleno por pantalla | Jerarquía visual clara; eliminar con contorno rojo |
| 2026-10-14 | Cuadrícula de categorías de 3 columnas y tamaño de letra calculado (`labelFontSize`, 10–13 px) | Con 4 columnas "Entretenimiento" no cabía en 360 dp sin bajar de 10 px; `adjustsFontSizeToFit` no es confiable en Android |
| 2026-10-14 | Registro rápido: `settings.last_accounts` (JSON validado entrada por entrada) guardado al crear un movimiento | Preselecciona la última cuenta por tipo; si ya no sirve, la primera disponible; guardarlo es una comodidad y no bloquea |
| 2026-10-14 | Hoja inferior propia (`BottomSheet`: Modal + Reanimated + gesture-handler) y `GestureHandlerRootView` en la raíz y dentro del Modal | Sin dependencias nuevas; en Android el Modal es otra raíz de gestos |
| 2026-10-14 | Vibración con `performAndroidHapticsAsync` (expo-haptics); sin interruptor propio | Respeta el ajuste de respuesta táctil del sistema y no pide permiso VIBRATE; "reducir animaciones" no aplica a vibración |
| 2026-10-14 | Fecha con chips Hoy/Ayer/Otra fecha; "Otra fecha" usa `DateTimePickerAndroid.open` de `@react-native-community/datetimepicker` | Incluido en el SDK 57 (Expo Go y APK); API imperativa sin componente en pantalla. iOS deshabilitado (`shortcut:`) |
| 2026-10-14 | Presupuesto = un monto por categoría de gasto para todos los meses (sin `month`); alerta por porcentaje (por defecto 80 %) | Lo más simple que cubre el uso real; editarlo cambia también los meses anteriores (se avisa en pantalla) |
| 2026-10-14 | Alertas de presupuesto y "Próximos pagos" del Inicio no dependen del periodo del Panel (mes actual / vencidos + 7 días) | Son avisos de hoy, no un informe |
| 2026-10-14 | Pago recurrente con `anchor_date` + `next_due_date`; quincenal = el 15 y el último día del mes | Fin de mes y bisiestos correctos; quincenas como se pagan en Colombia |
| 2026-10-14 | Pagar = formulario de movimiento con `?recurrente=` (gasto prellenado, monto real editable, tipo bloqueado) y `confirmRecurring` en una transacción | Reutiliza la validación del gasto (historia sin negativos); la cuota avanza solo si el gasto se guarda |
| 2026-10-14 | Omitir avanza la cuota sin crear gasto; eliminar el gasto de la última cuota pagada la devuelve a pendiente | Deshacer un pago por error no deja la plantilla adelantada |
| 2026-10-14 | Cuenta/categoría usada por un recurrente activo no se archiva; por cualquier recurrente, no se elimina | Una plantilla no puede quedar apuntando a algo inutilizable |
| 2026-10-14 | `FormScroll` (KeyboardAvoidingView `padding` en Android con el desfase medido en ventana + `automaticallyAdjustKeyboardInsets` en iOS) en todos los formularios | Con edge-to-edge (SDK 57) Android ya no encoge la ventana con el teclado; sin dependencias nuevas |
| 2026-10-14 | Monto arriba y grande (`AmountField`) en formularios de dinero | El teclado no lo tapa y es lo primero que se escribe |
| 2026-10-14 | Editar recurrente: Pagar/Omitir con cambios sin guardar pregunta Guardar y continuar / Descartar / Cancelar (`ConfirmDialog` con `otherLabel`) | No perder cambios en silencio; Descartar vuelve a lo último guardado |
| 2026-10-16 | Respaldo `.fpbak` cifrado desde el principio (AES-256-GCM + scrypt con `@noble/ciphers`/`@noble/hashes`, JS puro) en lugar de JSON legible | La copia va a Drive; JS puro funciona en Expo Go y Jest sin módulos nativos nuevos |
| 2026-10-16 | Sin zod: la copia se revisa contra `PRAGMA table_info`, y SQLite hace cumplir el resto dentro de la transacción | Evita una dependencia; las restricciones de la base ya son la fuente de verdad |
| 2026-10-16 | Contraseña de la copia de 12 caracteres o más | Pedido del usuario: la copia vive en la nube |
| 2026-10-16 | Migraciones solo agregan columnas y tablas (o traen su propia conversión en el restaurador) | Las copias de versiones anteriores se restauran sin código de conversión |
| 2026-10-16 | Los ajustes viajan en la copia; `last_backup_at` es local | Restaurar devuelve la app como estaba; la fecha de la última copia es de este teléfono |
| 2026-10-16 | Tests de restauración con `node:sqlite` (SQLite real en Node 24) y las migraciones de verdad | La prueba 14 corre contra el esquema real, no contra un simulacro |
| 2026-10-16 | PIN o huella al abrir: en otra etapa, fuera de la Fase 6 | Alcance de la Fase 6 = respaldo, restauración y CSV |
| 2026-10-16 | scrypt N=2^12 (r=8, p=1) | Medido en el teléfono (Expo Go): 2^14 = 7,8 s, 2^15 = 15,6 s → 2^12 ≈ 2 s. JS puro es lento en Hermes; la contraseña de 12+ compensa; N va en cada archivo (se puede subir sin romper copias viejas) |
| 2026-10-16 | `scryptAsync` | Cede el hilo de JS: se ve "Cifrando…" sin congelar la pantalla |
| 2026-10-16 | `android.allowBackup: false` + plugin `plugins/with-no-data-extraction.js` (`dataExtractionRules` que excluye todo de `cloud-backup` y `device-transfer`) | §1 sin nube: en Android 12+ `allowBackup=false` no frena la transferencia entre teléfonos; solo la copia `.fpbak` saca los datos. Verificado con `expo prebuild` temporal (borrado). Entra en la próxima build |
| 2026-10-16 | Elegir archivo con `File.pickFileAsync` de `expo-file-system`, sin `expo-document-picker` | Ya viene en una dependencia instalada |
| 2026-10-16 | Archivos a compartir en la caché; se borran al exportar la vez siguiente, no al cerrar el menú | Drive puede seguir leyendo el archivo después de cerrar el menú de compartir |
| 2026-10-16 | Copia previa automática `antes-de-restaurar.json` (sin cifrar, carpeta privada, solo la última) antes de restaurar; si no se puede escribir, no se restaura | Poder deshacer una restauración equivocada; la base ya está sin cifrar en la misma carpeta |
| 2026-10-16 | `last_backup_at` se guarda cuando el menú de compartir se cierra sin error | Android no dice si de verdad se guardó: la app dice "exportada" |
| 2026-10-16 | `last_backup_at` dentro de `Settings` (`lastBackupAt`), guardado con `saveSettings` | Se lee al ganar el foco igual que el resto de ajustes, en el Inicio y en Respaldo |
| 2026-10-16 | Recordatorio de copia en el Inicio: más de 7 días por fecha local, o nunca, y solo si ya hay movimientos (`backupReminder`) | Sin datos no hay nada que respaldar; sin botón de descartar: se quita exportando |
| 2026-10-16 | EROSELLE pasa a ser solo inversión y venta; se revierte la 5a (productos, inventario, compras, categorías de productos) | Decisión del usuario: quiere un control sencillo de cuánto invierte y cuánto gana; la 5a nunca llegó al APK |
| 2026-10-16 | Inversión y venta como filas de `transactions` (`scope='business'`, categorías fijas `cat-b-…`, columna `channel`), sin tablas nuevas | Saldos e historia sin días negativos ya funcionan; el resumen personal ya filtra por `scope` |
| 2026-10-16 | Sin cuentas de EROSELLE ni aporte/retiro: la migración 5 los convierte (cuentas → personales, aporte/retiro → transferencias) | Nada se pierde y los saldos no cambian; el restaurador hace lo mismo con copias v4 |
| 2026-10-16 | Canales: solo WhatsApp, Instagram, Marketplace (Facebook) y Página web | Pedido del usuario; sin "Otro" |
| 2026-10-16 | Registros de EROSELLE en la pestaña Movimientos con etiqueta; no en "Últimos movimientos" del Inicio | Mueven el saldo de las cuentas: el historial de una cuenta debe cuadrar |
| 2026-10-16 | Un solo periodo para el Inicio y EROSELLE | Pedido del usuario; un solo ajuste |
| 2026-10-16 | Ganancia acumulada además de la del periodo | Invertir un mes y vender el siguiente hace engañosa la ganancia de un solo periodo |
| 2026-10-17 | "Nueva venta" preselecciona el último canal (`settings.last_channel`) | Pedido del usuario; mismo patrón que `last_accounts` (registro rápido) |
| 2026-10-17 | Sin la palabra "EROSELLE" en filas de pantallas que ya son de EROSELLE | Redundante ahí; en Movimientos sigue para distinguirlas |
| 2026-10-17 | Periodo anterior = el mismo tramo corrido hacia atrás (1–17 oct → 1–17 sep; día inexistente → último del mes; personalizado → los mismos días justo antes) | Aprobado por el usuario; comparar un mes a medias con uno completo engaña |
| 2026-10-17 | CSV (personales y EROSELLE) solo en Informes; Respaldo solo para copias | Pedido del usuario |
| 2026-10-17 | Informes: presupuestos siempre del mes actual, evoluciones siempre de 6 meses; el resto sigue el periodo | Los presupuestos son mensuales; las barras necesitan meses fijos |
| 2026-10-17 | Dona y evolución mensual salen del Inicio a Informes | Inicio más enfocado (antes en la 4g) |
| 2026-10-17 | Acento "Rosa vino" reemplazado por "Cobre"; EROSELLE conserva siempre su rosa vino (`business`) | No confundir el acento de la app con el color del negocio |
| 2026-10-17 | La tarjeta "Haz una copia de seguridad" no se puede ocultar desde los ajustes del Inicio | Evita perder datos |
| 2026-10-17 | Fuentes con el plugin de `expo-font` (incrustadas en el APK) o con `useFonts`: se decide tras medir en el APK de prueba | Tamaño y arranque medidos, no supuestos |
| 2026-10-17 | Nombre para el saludo en `settings.user_name` (máx. 30, sin espacios a los lados), nunca en el código | Sin datos personales en el repositorio |
| 2026-10-17 | Tokens de tamaño calculados (`buildTokens`) y leídos con `useTokens`/`makeStyles`, con test guardián contra números, fuentes y colores a mano | Apariencia en vivo (4g-1c) sin tocar cada pantalla otra vez |
| 2026-10-17 | Acento global como el tema (`setAccent` + `useSyncExternalStore` en `useTheme`), no por pantalla | Cambia toda la app al instante sin un proveedor nuevo; se aplica al iniciar, al restaurar y al deshacer |
| 2026-10-17 | Selector "Color de acento" provisional en Ajustes hasta la pantalla Apariencia (4g-1c) | Poder verificar la 4g-1b en el teléfono |
| 2026-10-17 | Cobre claro con `highlight` #F9EEE6 (no #F7EADF) | Con el más oscuro, el verde de ingresos quedaba en 4,50:1 justo en el límite |
| 2026-10-17 | Esmeralda inclinado al turquesa (#1FA396 / #3EC6BC) | No se confunde con el verde de ingresos |
| 2026-10-17 | `TINT` como token y test del texto del chip elegido sobre el tinte (`blend`) en 5 acentos × 2 temas | El fondo tintado no estaba en el test de contraste |
| 2026-10-17 | Fuentes importadas por peso (`…/400Regular`) | La raíz del paquete pide 18 pesos con cursivas: Inter sola eran 6,0 MB; las 7 fuentes × 4 pesos suman ≈ 4 MB (el APK debería bajar ≈ 2 MB) |
| 2026-10-17 | Al iniciar se carga solo la fuente elegida; Inter siempre como respaldo; Apariencia carga las 7 para mostrar cada opción en su fuente | Arranque igual que antes; si una fuente no carga, la app no se queda sin texto |
| 2026-10-17 | Apariencia en un store global (`use-appearance.ts`, `useSyncExternalStore`) y tokens cacheados por combinación (`tokensFor`) | Mismo patrón que el tema; cada cambio redibuja todo sin un proveedor por pantalla |
| 2026-10-17 | Alto de línea ≥ alto natural de cada fuente (`lineRatio`) | Poppins, Nunito y Manrope se cortaban arriba en Android con los altos de Inter |
| 2026-10-17 | Escala total de letra (app × teléfono) con tope 2,0 (`maxFontSizeMultiplier`) | Muy grande + letra del sistema al máximo desbordaba pantallas |
| 2026-10-17 | `FitText`/`useFitSize` para saldo, ganancia y monto del formulario | Android no hace bien `adjustsFontSizeToFit`; un monto de 10 cifras con fuente ancha se salía |
| 2026-10-17 | Corrección: etiquetas de la cuadrícula de categorías incluyen la escala del sistema en su cálculo (`allowFontScaling={false}`) | Se escalaban dos veces y podían desbordar la celda con letra grande del teléfono |
| 2026-10-17 | Tema y acento pasan de Ajustes a Apariencia; Restablecer apariencia no toca nombre, animaciones ni vibración | Todo lo visual junto; las otras son preferencias de comodidad/accesibilidad |
| 2026-10-17 | Nombre del saludo se guarda en cada tecla, normalizado (sin controles, espacios juntos, máx. 30 caracteres contando emojis enteros) | Sin botón Guardar que olvidar; validado al leer y al guardar |
| 2026-10-17 | `useMotion()`: Suaves = solo desvanecer al 60 % de duración (sin escala, sin manita, sin deslizar) | Una opción intermedia real; "reducir animaciones" del sistema siempre manda |
| 2026-10-17 | Vibración desactivable sin tocar las llamadas (`haptics.ts` lee el store) | Un solo punto de control |
| 2026-10-17 | Dona dibujada con una tapa del color de la tarjeta que se retira (solo `strokeDashoffset`); barras con escala (`Grow`) | Animar `strokeDasharray` de varias porciones no es confiable con react-native-svg + Reanimated |
| 2026-10-17 | Botón + oculto al bajar en el hilo de UI; con TalkBack nunca se oculta | Es la acción principal; con lector de pantalla se busca por gestos |
| 2026-10-17 | Filas animadas con `LayoutAnimationConfig skipEntering` | La primera carga no se anima; solo lo nuevo y lo eliminado |
| 2026-10-17 | Tarjetas del Inicio en `home_cards` (JSON): desconocidas fuera, faltantes al final visibles; orden con botones subir/bajar | Compatibles con versiones futuras; accesible y sin dependencia de arrastre |
| 2026-10-17 | El aviso de copia de seguridad va justo debajo del saldo (antes, después de EROSELLE) | Es fijo y evita perder datos |
| 2026-10-17 | Primer día de la semana (`week_start`) en el store global | El calendario se abre desde varios formularios |
| 2026-10-17 | Deshacer = volver a insertar la misma fila (id, created_at, cuota, canal) validada con `validateRestore` (misma regla de ningún día en negativo); la cuota del recurrente solo vuelve si nadie la movió | No cambia reglas de dinero; con tests |
| 2026-10-17 | Aviso de Deshacer global (6 s, 12 s con TalkBack) y `notifyLedgerChanged` para recargar la pantalla con foco | El formulario se cierra al eliminar; la lista debe mostrar el movimiento devuelto sin salir y volver |
| 2026-10-17 | Movimientos y Registros de EROSELLE en `SectionList` por día, cada día una tarjeta | Consistente con las listas del Inicio |
| 2026-10-17 | Corrección: Movimientos no respetaba "Ocultar cifras" | Registros de EROSELLE sí lo hacía |
| 2026-10-17 | Categorías por `Map` en las listas | Antes un recorrido por fila |
| 2026-10-17 | Chips y enlaces "Ver todos" con mínimo 44 dp | Medían ≈ 36 y ≈ 40 dp |
| 2026-10-17 | Datos [PRUEBA] extremos (botón de desarrollo) | Probar las combinaciones extremas de apariencia con datos reales |
| 2026-10-17 | `ComingSoon` → `TitledScreen` (sin la prop `soon`) | Código muerto: ya nada era "Próximamente" |
| 2026-10-17 | Aviso de Deshacer dibujado dentro de la pantalla con foco (`UndoHost`), pegado al borde inferior del contenido, en vez de una altura fija de 80 dp | `NativeTabs` es nativa y no da `useBottomTabBarHeight`; el contenido de cada pestaña ya termina en el borde real de la barra, en cualquier teléfono. Sin pestañas se suma el margen inferior del sistema |
| 2026-10-17 | El botón + sube por encima del aviso mientras se ve (`lift` = alto medido del aviso + espacio, animado según Animaciones) | El aviso tapaba el botón + durante 6 s |
| 2026-10-17 | APK solo `arm64-v8a` con `buildArchs` de `expo-build-properties` (no con la variable de Gradle en `eas.json`) | El universal con 4 arquitecturas pesó > 100 MB; la variable de entorno puede perder contra `gradle.properties` |
| 2026-10-17 | R8 y reducción de recursos en release, con reglas `-keep` conservadoras para RN, Expo y librerías nativas | Menos tamaño sin arriesgar clases que se llaman por nombre desde JS/C++ |
| 2026-10-17 | Fuentes como assets de JS, no incrustadas con el plugin de `expo-font` | Mismo tamaño; al iniciar solo se carga la elegida. Revisar con el arranque medido en el APK |
| 2026-10-17 | Quitadas `@expo/ui`, `expo-device`, `expo-glass-effect` (sin uso), `expo-image` y `expo-web-browser` (solo en código muerto o de web), `react-dom` y `react-native-web` (web no es objetivo), los archivos `*.web.tsx`, `global.css`, `themed-view`, `external-link` y el ícono animado de la plantilla con `logo-glow.png` y `expo-logo.png` | Se buscó cada una en el código antes de quitarla; las imágenes entraban al bundle de Android sin mostrarse nunca |
| 2026-10-17 | Se quedan `expo-constants`, `expo-linking`, `react-native-screens` (las pide expo-router) y `expo-system-ui` (aplica el tema en Android) | No se importan en `src` pero son necesarias |
| 2026-10-17 | Caché del libro validado con `SELECT total_changes()` (sube con cada escritura de la conexión) | Antes cada pestaña releía todo al ganar el foco; ahora reutiliza el mismo objeto y el React Compiler no recalcula resúmenes ni gráficos. Sin cambiar reglas de dinero (no se pasaron cálculos a SQL); con test |
| 2026-10-17 | Sin migración de índices nueva | Ya existen índices por fecha, cuenta+fecha, destino y recurrente; con el caché la lectura completa solo ocurre tras una escritura |
| 2026-10-17 | La base se abre en paralelo con la carga de Inter; la copia del splash espera a que la app esté lista (también si la migración falla, para que se vea el error) | Antes el splash se iba y se veía un fondo vacío mientras se abría la base |
| 2026-10-17 | Listas por día: `initialNumToRender` 12, `windowSize` 9, `removeClippedSubviews`; se montan con los datos ya leídos (aparición suave, sin animar cada fila) | Memoria y primera pintura; filas de alto variable, sin `getItemLayout` |
| 2026-10-17 | Transiciones de pantalla: Completas desliza (formularios desde abajo), Suaves desvanece, Desactivadas ninguna | Mismo ajuste de Animaciones para toda la app |
| 2026-10-17 | Confirmación al guardar con check animado (reutiliza el aviso de Deshacer) | Antes el formulario se cerraba sin señal visible |
| 2026-10-17 | Estados vacíos con un ícono que "respira" (solo Completas) | Un poco de vida sin distraer |
| 2026-10-17 | Arranque con topes: cada fuente 6 s (`loadFont` con `withTimeout`), Inter 6 s en `_layout`, y la copia del splash se quita a los 10 s pase lo que pase; cada paso (base, fuentes) se marca aparte y, si vence un tope, la terminal dice cuál faltó | En Expo Go la app quedó en el splash para siempre: ningún paso del arranque tenía tiempo máximo y la copia del splash esperaba una señal que podía no llegar nunca (fuente por el túnel) |
| 2026-10-17 | Tienda opcional: el nombre y los canales son datos del usuario (`settings.store_name`, tabla `channels`); el nombre real solo queda en `migrations.ts` (test `no-store-name.test.ts`) | Pedido del usuario: la app sirve a quien no tiene tienda o tiene otra |
| 2026-10-17 | Migración 6 agrega `transactions.channel_id` y deja de usar `channel` (CHECK con 4 canales fijos) en vez de reconstruir la tabla | Quitar el CHECK exige reconstruir `transactions`: riesgo de perder datos; agregar una columna es todo o nada y las copias viejas siguen sirviendo |
| 2026-10-17 | Base con cuentas al migrar = base en uso: tienda activada con su nombre, sin bienvenida y tarjeta del Inicio renombrada en el JSON; base sin cuentas = bienvenida | Distingue la base del usuario de una instalación nueva sin pedir nada |
| 2026-10-17 | Copias v5 al restaurar: nombre de la tienda sacado de la categoría de venta ("Venta <nombre>"); v4 → "Mi tienda" | El nombre ya vive en los datos de la copia; no se escribe en el código |
| 2026-10-17 | Canal con ventas no se elimina (se archiva); nunca se archiva ni elimina el último activo; al editar una venta se conserva su canal archivado | Mismas reglas que cuentas y categorías; una venta necesita canal |
| 2026-10-17 | `onboarding_done` y `notifications` son ajustes del teléfono (no viajan en la copia) | Restaurar una copia no debe volver a mostrar la bienvenida ni cambiar los avisos de otro teléfono |
| 2026-10-17 | Filtros de Movimientos con su propio periodo (no el del Inicio); texto sin tildes ni mayúsculas, cada palabra | El periodo del Inicio es compartido con la tienda e Informes; buscar no debe cambiarlo |
| 2026-10-17 | Notificaciones locales: se reprograman todas (cancelar y programar) al abrir, al salir de la app y tras pagar/omitir/pausar/eliminar/guardar un recurrente, exportar o restaurar | Los datos solo cambian dentro de la app: así el resumen calculado al programar es el correcto cuando llega |
| 2026-10-17 | Recurrentes: todos los vencimientos de los próximos 60 días, tope de 50 avisos en total con los más cercanos primero; registro diario con disparador diario (cuenta como uno) | Pedido del usuario: no quedarse sin avisos tras semanas sin abrir la app; Android limita las alarmas por app |
| 2026-10-17 | Sin montos en los avisos por defecto (opción "Mostrar montos") | Los avisos se ven en la pantalla de bloqueo |
| 2026-10-17 | Bloqueo con huella o PIN: no se hace por ahora (decisión del usuario); queda pendiente | El usuario lo quitó del plan antes de implementar |
| 2026-10-17 | Tocar un aviso abre su pantalla: el destino viaja en `data.url` y se valida al abrir (`notificationTarget`: solo pantallas de la app; un pago que ya no existe → lista); con la app cerrada se usa el último toque guardado y se borra al abrirlo | Pedido del usuario; borrarlo evita que la app vuelva a saltar a esa pantalla al reabrirse |
| 2026-10-17 | Al restaurar, una copia sin `home_cards` no pisa las tarjetas del Inicio del teléfono | Pedido del usuario: copias anteriores a la 4g no traen esa configuración |
| 2026-10-17 | `expo-notifications` se carga con `require` diferido y protegido solo fuera de Expo Go; en Expo Go Ajustes → Notificaciones avisa que solo funcionan en el APK y deshabilita los controles; reprogramar no hace nada | En Expo Go (SDK 57, Android) importarlo falla con "Cannot find native module 'ExpoTopicSubscriptionModule'" y la app no cargaba: la suposición de que los avisos locales se podían probar en Expo Go era falsa |
