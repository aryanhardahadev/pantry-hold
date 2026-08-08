import { readFile } from "node:fs/promises";
import type { InventoryItem, TypedIdentifier } from "./types.js";

const identifierTypes = new Set<TypedIdentifier["type"]>([
  "product_code",
  "upc",
  "lot",
]);

export async function loadDemoInventory(
  fixturePath: string,
): Promise<InventoryItem[]> {
  const parsed: unknown = JSON.parse(await readFile(fixturePath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Demo inventory fixture must be an array.");
  }

  return parsed.map((value, index) => parseInventoryItem(value, index));
}

function parseInventoryItem(value: unknown, index: number): InventoryItem {
  if (!isObject(value)) {
    throw new Error(`Demo inventory item ${index} must be an object.`);
  }

  const identifiers = value.identifiers;
  if (!Array.isArray(identifiers)) {
    throw new Error(`Demo inventory item ${index} must include identifiers.`);
  }

  if (value.demoData !== true) {
    throw new Error(
      `Demo inventory item ${index} must be marked as demo data.`,
    );
  }

  return {
    id: requireString(value.id, `inventory[${index}].id`),
    name: requireString(value.name, `inventory[${index}].name`),
    shelf: requireString(value.shelf, `inventory[${index}].shelf`),
    quantity: requireNumber(value.quantity, `inventory[${index}].quantity`),
    unit: requireString(value.unit, `inventory[${index}].unit`),
    estimatedMealPortions: requireNumber(
      value.estimatedMealPortions,
      `inventory[${index}].estimatedMealPortions`,
    ),
    identifiers: identifiers.map((identifier, identifierIndex) =>
      parseIdentifier(identifier, `${index}].identifiers[${identifierIndex}`),
    ),
    demoData: true,
  };
}

function parseIdentifier(value: unknown, path: string): TypedIdentifier {
  if (!isObject(value)) {
    throw new Error(`inventory[${path}] must be an object.`);
  }

  const type = requireString(value.type, `inventory[${path}].type`);
  if (!identifierTypes.has(type as TypedIdentifier["type"])) {
    throw new Error(`inventory[${path}].type is unsupported.`);
  }

  return {
    type: type as TypedIdentifier["type"],
    value: requireString(value.value, `inventory[${path}].value`),
    displayValue: requireString(
      value.displayValue,
      `inventory[${path}].displayValue`,
    ),
    evidence: requireString(value.evidence, `inventory[${path}].evidence`),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value;
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`);
  }
  return value;
}
