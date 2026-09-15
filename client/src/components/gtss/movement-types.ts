export interface MovementTypeOption {
  value: string;
  label: string;
}

export function getMovementTypeOptions(isLht: boolean): MovementTypeOption[] {
  const crossingTurn = isLht ? "Right" : "Left";
  const nearSideTurn = isLht ? "Left" : "Right";

  return [
    { value: "Through", label: "Through (T)" },
    { value: "Left Turn", label: `${crossingTurn} Turn (L)` },
    {
      value: "Left Protected-Permissive",
      label: `${crossingTurn} Protected-Permissive (LPP)`,
    },
    { value: "Left Through Shared", label: `${crossingTurn} Through Shared (LT)` },
    { value: "Permissive Phase", label: `${crossingTurn} Permissive (TL)` },
    { value: "Flashing Yellow Arrow", label: `${crossingTurn} Flashing Yellow Arrow (FYA)` },
    { value: "U-Turn", label: "U-Turn (U)" },
    { value: "Right Turn", label: `${nearSideTurn} Turn (R)` },
    { value: "Through-Right", label: `Through-${nearSideTurn} (TR)` },
    { value: "Pedestrian", label: "Pedestrian (PED)" },
  ];
}
