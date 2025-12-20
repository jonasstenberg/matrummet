-- Seed data for units table
-- Swedish measurement units with plural forms and abbreviations

INSERT INTO units (name, plural, abbreviation) VALUES
  ('tesked', 'teskedar', 'tsk'),
  ('matsked', 'matskedar', 'msk'),
  ('kopp', 'koppar', 'c'),
  ('milliliter', 'milliliter', 'ml'),
  ('centiliter', 'centiliter', 'cl'),
  ('deciliter', 'deciliter', 'dl'),
  ('liter', 'liter', 'l'),
  ('gram', 'gram', 'g'),
  ('hekto', 'hekto', 'hg'),
  ('kilogram', 'kilogram', 'kg'),
  ('milligram', 'milligram', 'mg'),
  ('pund', 'pund', 'lb'),
  ('ounce', 'ounces', 'oz'),
  ('skvätt', 'skvättar', ''),
  ('stänk', 'stänk', ''),
  ('nypa', 'nypor', ''),
  ('kryddmått', 'kryddmått', 'krm'),
  ('portion', 'portioner', ''),
  ('burk', 'burkar', ''),
  ('paket', 'paket', ''),
  ('påse', 'påsar', ''),
  ('bunt', 'buntar', ''),
  ('knippe', 'knippen', ''),
  ('klyfta', 'klyftor', ''),
  ('huvud', 'huvuden', ''),
  ('bit', 'bitar', ''),
  ('skiva', 'skivor', ''),
  ('kruka', 'krukor', ''),
  ('kvist', 'kvistar', ''),
  ('blad', 'blad', ''),
  ('stjälk', 'stjälkar', ''),
  ('stycken', 'stycken', 'st')
ON CONFLICT (name) DO NOTHING;

-- Total: 32 units
