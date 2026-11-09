import React from 'react';
import { BottomSheet } from './BottomSheet';
import { MonthGrid } from './MonthGrid';
import type { Month } from '../lib/months';

interface Props {
  visible: boolean;
  title: string;
  value: Month | null;
  onPick: (m: Month) => void;
  onClose: () => void;
  marked?: Set<Month>;
  max?: Month;
}

/** Bottom sheet with a month grid. Picking a month calls `onPick`; the caller closes it. */
export function MonthPicker({ visible, title, value, onPick, onClose, marked, max }: Props) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <MonthGrid value={value} onPick={onPick} marked={marked} max={max} />
    </BottomSheet>
  );
}
