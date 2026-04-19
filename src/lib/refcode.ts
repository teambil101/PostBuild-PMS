/**
 * Reference code generators.
 * Format examples:
 *   Building: BLD-7K3X9
 *   Unit:     UNT-A4F2P
 *   Person:   PSN-3Q8M1
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
const rand = (n: number) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

export const newBuildingCode = () => `BLD-${rand(5)}`;
export const newUnitCode = () => `UNT-${rand(5)}`;
export const newPersonCode = () => `PSN-${rand(5)}`;
