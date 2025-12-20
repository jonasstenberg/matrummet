// Swedish unit names from Mealie seed data
// Source: https://github.com/mealie-recipes/mealie/blob/mealie-next/mealie/repos/seed/resources/units/locales/sv-SE.json

export interface Unit {
  name: string;
  plural: string;
  abbreviation: string;
}

export const SWEDISH_UNITS: Unit[] = [
  { name: 'tesked', plural: 'teskedar', abbreviation: 'tsk' },
  { name: 'matsked', plural: 'matskedar', abbreviation: 'msk' },
  { name: 'kopp', plural: 'koppar', abbreviation: 'c' },
  { name: 'milliliter', plural: 'milliliter', abbreviation: 'ml' },
  { name: 'deciliter', plural: 'deciliter', abbreviation: 'dl' },
  { name: 'liter', plural: 'liter', abbreviation: 'l' },
  { name: 'gram', plural: 'gram', abbreviation: 'g' },
  { name: 'hekto', plural: 'hekto', abbreviation: 'hg' },
  { name: 'kilogram', plural: 'kilogram', abbreviation: 'kg' },
  { name: 'milligram', plural: 'milligram', abbreviation: 'mg' },
  { name: 'pund', plural: 'pund', abbreviation: 'lb' },
  { name: 'ounce', plural: 'ounces', abbreviation: 'oz' },
  { name: 'skvätt', plural: 'skvättar', abbreviation: '' },
  { name: 'stänk', plural: 'stänk', abbreviation: '' },
  { name: 'nypa', plural: 'nypor', abbreviation: '' },
  { name: 'portion', plural: 'portioner', abbreviation: '' },
  { name: 'burk', plural: 'burkar', abbreviation: '' },
  { name: 'paket', plural: 'paket', abbreviation: '' },
  { name: 'bunt', plural: 'knippen', abbreviation: '' },
  { name: 'klyfta', plural: 'klyftor', abbreviation: '' },
  { name: 'huvud', plural: 'huvuden', abbreviation: '' },
  { name: 'bit', plural: 'bitar', abbreviation: '' },
  { name: 'skiva', plural: 'skivor', abbreviation: '' },
  { name: 'kruka', plural: 'krukor', abbreviation: '' },
  { name: 'kvist', plural: 'kvistar', abbreviation: '' },
  { name: 'blad', plural: 'blad', abbreviation: '' },
  { name: 'stjälk', plural: 'stjälkar', abbreviation: '' },
];

// Flat list of all unit names and abbreviations for autocomplete
export const UNIT_SUGGESTIONS: string[] = [
  ...SWEDISH_UNITS.map(u => u.name),
  ...SWEDISH_UNITS.filter(u => u.abbreviation).map(u => u.abbreviation),
].sort((a, b) => a.localeCompare(b, 'sv'));

export default SWEDISH_UNITS;
