"use client";

import * as React from "react";
import { Building2, Filter, Users } from "lucide-react";
import { Select } from "@/components/ui/select";
import {
  DateRangePicker,
  resolvePreset,
  type DateRange,
  type PresetKey,
} from "@/components/ui/date-range-picker";
import { useHouses, useTenant } from "@/lib/queries";
import { GATE_TYPE_LABEL, type GateType } from "@/lib/gates";

/**
 * Scope bar — DESIGN_SYSTEM.md §4.5 toolbar, in the §7.2 item-1 role:
 * "entity + date range + one or two dimension filters. Always visible, always
 * at the top, never inside a drawer."
 *
 * A single row, gap-2, every control 32px, scope controls left and actions
 * right, separated by justify-between rather than a divider.
 */
export interface Scope {
  range: DateRange;
  preset: PresetKey;
  gateType: string;
  houseId: string;
}

export function useScope(initialPreset: PresetKey = "last30") {
  const [preset, setPreset] = React.useState<PresetKey>(initialPreset);
  const [range, setRange] = React.useState<DateRange>(() => resolvePreset(initialPreset));
  const [gateType, setGateType] = React.useState("all");
  const [houseId, setHouseId] = React.useState("all");

  return {
    scope: { range, preset, gateType, houseId } as Scope,
    setRange: (r: DateRange, p: PresetKey) => {
      setRange(r);
      setPreset(p);
    },
    setGateType,
    setHouseId,
  };
}

export function ScopeBar({
  scope,
  onRangeChange,
  onGateTypeChange,
  onHouseChange,
  showGateType = false,
  actions,
}: {
  scope: Scope;
  onRangeChange: (range: DateRange, preset: PresetKey) => void;
  onGateTypeChange?: (value: string) => void;
  onHouseChange: (value: string) => void;
  showGateType?: boolean;
  actions?: React.ReactNode;
}) {
  const tenant = useTenant();
  const houses = useHouses();

  const houseOptions = [
    { value: "all", label: "All houses" },
    ...(houses.data ?? []).map((h) => ({ value: h.id, label: h.name })),
  ];

  // All four are real since `gate_type` was added, so the filter narrows on
  // the row's actual type.
  const gateTypeOptions = [
    { value: "all", label: "All gate types" },
    ...(Object.keys(GATE_TYPE_LABEL) as GateType[]).map((t) => ({
      value: t,
      label: GATE_TYPE_LABEL[t],
    })),
  ];

  return (
    <div className="my-3 flex shrink-0 items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Select
          className="w-[180px]"
          value="entity"
          onChange={() => undefined}
          icon={<Users />}
          options={[{ value: "entity", label: tenant.data?.name ?? "Noor" }]}
        />
        <DateRangePicker value={scope.range} preset={scope.preset} onChange={onRangeChange} />
        {showGateType && onGateTypeChange && (
          <Select
            className="w-[168px]"
            value={scope.gateType}
            onChange={onGateTypeChange}
            icon={<Filter />}
            options={gateTypeOptions}
          />
        )}
        <Select
          className="w-[168px]"
          value={scope.houseId}
          onChange={onHouseChange}
          icon={<Building2 />}
          options={houseOptions}
        />
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
