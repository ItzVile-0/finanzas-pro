import { useState } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { CalendarField, ChipGroup, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { todayLocal } from '@/domain/dates';
import { PERIOD_OPTIONS, periodRange, validateCustomRange, type Period } from '@/domain/periods';
import { useTheme } from '@/hooks/use-theme';

type Choice = Period['key'];

/**
 * Hoja inferior del periodo del Panel. Un periodo fijo se aplica al tocarlo; "Personalizado" pide Desde/Hasta y Aplicar.
 * `onApply` guarda (el Panel es dueño de los ajustes) y devuelve true si se guardó; si no, el error viene en `error`.
 */
export function PeriodSheet({
  visible,
  period,
  onApply,
  onClose,
  error,
}: {
  visible: boolean;
  period: Period;
  onApply: (p: Period) => Promise<boolean>;
  onClose: () => void;
  error: string | null;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Periodo">
      <PeriodPicker period={period} onApply={onApply} error={error} />
    </BottomSheet>
  );
}

/** Se monta cada vez que se abre la hoja: arranca siempre con el periodo guardado. */
function PeriodPicker({ period, onApply, error }: { period: Period; onApply: (p: Period) => Promise<boolean>; error: string | null }) {
  const theme = useTheme();
  const today = todayLocal();
  const initial = periodRange(period, today);
  const [choice, setChoice] = useState<Choice>(period.key);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [errors, setErrors] = useState<{ from?: string; to?: string }>({});
  const [saving, setSaving] = useState(false);

  async function apply(p: Period): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    try {
      return await onApply(p);
    } finally {
      setSaving(false);
    }
  }

  async function choose(key: Choice) {
    const previous = choice;
    setChoice(key);
    setErrors({});
    // Si no se guardó, el chip vuelve al periodo anterior: nada de fingir que se aplicó.
    if (key !== 'custom' && !(await apply({ key }))) setChoice(previous);
  }

  function applyCustom() {
    const e = validateCustomRange(from, to, today);
    setErrors(e);
    if (Object.keys(e).length === 0) apply({ key: 'custom', from, to });
  }

  return (
    <>
      <ChipGroup
        label="Periodo"
        options={PERIOD_OPTIONS.map((o) => ({ value: o.key, label: o.label, disabled: saving }))}
        value={choice}
        onChange={choose}
        hint='"Últimos 3 meses" = este mes hasta hoy + los 2 meses completos anteriores. El saldo total no cambia con el periodo.'
      />
      {choice === 'custom' ? (
        <>
          <CalendarField label="Desde" value={from} onChange={setFrom} error={errors.from} />
          <CalendarField label="Hasta" value={to} onChange={setTo} error={errors.to} />
          <PrimaryButton label="Aplicar" onPress={applyCustom} busy={saving} />
        </>
      ) : null}
      {error ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{error}</ThemedText>
      ) : null}
    </>
  );
}
