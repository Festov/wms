export type PutawayRuleCode = "same_product" | "empty_cell";

export type PutawayRuleDefinition = {
  code: PutawayRuleCode;
  title: string;
  description: string;
  defaultPriority: number;
  defaultEnabled: boolean;
};

export const PUTAWAY_RULE_REGISTRY: PutawayRuleDefinition[] = [
  {
    code: "same_product",
    title: "К такому же товару",
    description:
      "Ячейка хранения, где уже есть хотя бы один из товаров на ТН.",
    defaultPriority: 10,
    defaultEnabled: true,
  },
  {
    code: "empty_cell",
    title: "В пустую ячейку",
    description: "Свободная ячейка хранения без остатков.",
    defaultPriority: 20,
    defaultEnabled: true,
  },
];

export function getPutawayRule(code: string) {
  return PUTAWAY_RULE_REGISTRY.find((r) => r.code === code);
}
