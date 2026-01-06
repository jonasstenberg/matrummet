-- V35: Fix common_pantry_category updates that were blocked by RLS
-- The V34 migration ran but the UPDATE statements were blocked by RLS
-- because flyway runs as 'recept' user which doesn't pass is_admin() check

-- Temporarily disable RLS to allow the updates
ALTER TABLE foods DISABLE ROW LEVEL SECURITY;

-- Basics (most kitchens have these)
UPDATE foods SET common_pantry_category = 'basic' WHERE LOWER(name) IN (
  -- Water, fats, dairy basics
  'vatten', 'salt', 'olivolja', 'rapsolja', 'solrosolja', 'sesamolja', 'kokosolja', 'smör',
  'mjölk', 'ägg',
  -- Sugars
  'socker', 'strösocker', 'florsocker', 'farinsocker', 'muscovadosocker', 'honung', 'sirap',
  -- Dairy products
  'grädde', 'vispgrädde', 'matlagningsgrädde', 'crème fraiche', 'gräddfil', 'filmjölk',
  'kesella', 'kvarg', 'cream cheese', 'färskost',
  -- Cheese
  'ost', 'riven ost', 'parmesan', 'mozzarella', 'fetaost', 'cheddar',
  -- Flour and baking
  'vetemjöl', 'bakpulver', 'bikarbonat', 'maizena', 'potatismjöl',
  -- Bread products
  'ströbröd', 'panko', 'kornflakes',
  -- Vinegar
  'vinäger', 'vitvinsvinäger', 'balsamvinäger', 'äppelcidervinäger', 'rödvinsvinäger',
  -- Condiments
  'soja', 'senap', 'dijonsenap', 'grovkornig senap', 'ketchup', 'majonnäs',
  -- Tomato products
  'tomatpuré', 'krossade tomater', 'passerade tomater',
  -- Coconut products
  'kokosmjölk', 'kokosgrädde',
  -- Grains and cereals
  'ris', 'risgryn', 'pasta', 'spagetti', 'makaroner', 'nudlar', 'couscous', 'bulgur', 'quinoa',
  'havregryn', 'müsli',
  -- Legumes
  'bönor', 'kidneybönor', 'svarta bönor', 'vita bönor', 'kikärtor', 'linser', 'röda linser'
);

-- Herbs (fresh and dried)
UPDATE foods SET common_pantry_category = 'herb' WHERE LOWER(name) IN (
  'basilika', 'oregano', 'timjan', 'rosmarin', 'persilja', 'dill', 'gräslök',
  'koriander', 'mynta', 'salvia', 'dragon', 'lagerblad', 'citronmeliss',
  'mejram', 'körvel', 'citrongräs'
);

-- Spices (dried/ground - NOT vegetables like paprika/bell pepper)
UPDATE foods SET common_pantry_category = 'spice' WHERE LOWER(name) IN (
  -- Peppers
  'svartpeppar', 'vitpeppar', 'cayennepeppar',
  -- Paprika powder (NOT paprika which is a vegetable)
  'paprikapulver', 'rökt paprikapulver',
  -- Sweet spices
  'kanel', 'kardemumma', 'muskot', 'muskotnöt', 'nejlika', 'kryddnejlika',
  'vanilj', 'vaniljsocker', 'saffran', 'allkrydda', 'kryddpeppar',
  -- Seeds
  'anis', 'stjärnanis', 'fänkålsfrö', 'korianderfrö', 'senapsfrö',
  -- Ground spices
  'gurkmeja', 'spiskummin', 'kummin', 'chilipulver', 'chiliflingor',
  -- Spice blends
  'curry', 'currypulver', 'garam masala', 'tandoori', 'ras el hanout',
  -- Garlic/onion powders
  'vitlökspulver', 'lökpulver', 'krossad vitlök', 'vitlökspasta',
  -- Other
  'ingefära', 'pepparrot', 'jalapeño'
);

-- Seasonings (flavor enhancers, fresh aromatics, sauces)
UPDATE foods SET common_pantry_category = 'seasoning' WHERE LOWER(name) IN (
  -- Fresh alliums
  'vitlök', 'lök', 'gul lök', 'rödlök', 'röd lök', 'schalottenlök', 'purjolök',
  'salladslök', 'vårlök',
  -- Citrus
  'citron', 'lime', 'citronsaft', 'limesaft',
  -- Stocks and broths
  'buljong', 'hönsbuljong', 'grönsaksbuljong', 'köttbuljong', 'fond',
  'fiskbuljong',
  -- Hot sauces
  'sambal oelek', 'sriracha', 'tabasco', 'chipotle',
  -- Fermented/umami
  'worcestershiresås', 'fisksås', 'miso', 'misopasta',
  -- Asian sauces
  'hoisinsås', 'ostronsås', 'teriyakisås',
  -- Pastes and spreads
  'tahini', 'kapris',
  -- Olives
  'oliver', 'svarta oliver', 'gröna oliver',
  -- Preserved vegetables
  'soltorkade tomater'
);

-- Re-enable RLS
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods FORCE ROW LEVEL SECURITY;
