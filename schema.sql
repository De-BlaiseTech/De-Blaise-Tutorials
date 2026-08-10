-- 1. Create Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL
);

-- Seed Initial Subjects
INSERT OR IGNORE INTO subjects (id, name, category) VALUES
(1, 'Mathematics', 'Science'),
(2, 'English Language', 'General'),
(3, 'Physics', 'Science'),
(4, 'Chemistry', 'Science'),
(5, 'Biology', 'Science'),
(6, 'Agricultural Science', 'Science'),
(7, 'Civic Education', 'General'),
(8, 'Economics', 'Commercial'),
(9, 'Financial Accounting', 'Commercial'),
(10, 'Commerce', 'Commercial'),
(11, 'Government', 'Arts'),
(12, 'Literature in English', 'Arts'),
(13, 'Christian Religious Studies', 'Arts');

-- 2. Create Topics Table
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Seed Topics for All Subjects
INSERT INTO topics (subject_id, title) VALUES
-- Mathematics (1)
(1, 'Number Bases'), (1, 'Fractions, Decimals, & Percentages'), (1, 'Indices & Logarithms'), (1, 'Surds'), (1, 'Sets & Venn Diagrams'), (1, 'Modular Arithmetic'), (1, 'Algebraic Processes & Factorization'), (1, 'Linear Equations & Inequalities'), (1, 'Quadratic Equations'), (1, 'Simultaneous Equations'), (1, 'Variation (Direct, Inverse, Joint)'), (1, 'Sequence & Series (AP & GP)'), (1, 'Matrices & Determinants'), (1, 'Trigonometry & Bearings'), (1, 'Mensuration & Plane Geometry'), (1, 'Circle Theorems'), (1, 'Coordinate Geometry'), (1, 'Statistics & Data Presentation'), (1, 'Probability'), (1, 'Introductory Calculus (Differentiation & Integration)'),

-- English Language (2)
(2, 'Nouns & Pronouns'), (2, 'Verbs, Tenses & Agreement (Concord)'), (2, 'Adjectives & Adverbs'), (2, 'Prepositions & Conjunctions'), (2, 'Phrases & Clauses'), (2, 'Sentence Types & Structure'), (2, 'Grammatical Functions'), (2, 'Direct & Indirect Speech'), (2, 'Active & Passive Voice'), (2, 'Synonyms & Antonyms'), (2, 'Idioms & Idiomatic Expressions'), (2, 'Register & Vocabulary Development'), (2, 'Comprehension Strategies'), (2, 'Summary Writing Techniques'), (2, 'Narrative & Descriptive Essays'), (2, 'Expository & Argumentative Essays'), (2, 'Formal & Informal Letters'), (2, 'Article & Speech Writing'), (2, 'Oral English: Vowels & Consonants'), (2, 'Oral English: Stress & Intonation'),

-- Physics (3)
(3, 'Units, Dimensions & Measurement'), (3, 'Position, Distance & Displacement'), (3, 'Speed, Velocity & Acceleration'), (3, 'Projectiles & Motion Curves'), (3, 'Newton''s Laws of Motion'), (3, 'Work, Energy & Power'), (3, 'Friction & Circular Motion'), (3, 'Simple Harmonic Motion (SHM)'), (3, 'Density & Relative Density'), (3, 'Pressure in Fluids & Atmospheric Pressure'), (3, 'Thermal Expansion & Thermometry'), (3, 'Heat Capacity & Latent Heat'), (3, 'Gas Laws (Boyle''s, Charles''s, Pressure)'), (3, 'Waves: Types & Properties'), (3, 'Sound Waves & Echoes'), (3, 'Light Reflection & Mirrors'), (3, 'Light Refraction & Lenses'), (3, 'Electrostatics & Electric Fields'), (3, 'Current Electricity & Ohm''s Law'), (3, 'Electromagnetism & Transformers'),

-- Chemistry (4)
(4, 'Separation Techniques & Purity'), (4, 'Atomic Structure & Chemical Bonding'), (4, 'Periodic Table & Periodicity'), (4, 'Chemical Symbols, Formulae & Equations'), (4, 'The Mole Concept & Stoichiometry'), (4, 'States of Matter & Kinetic Theory'), (4, 'Gas Laws & Ideal Gas Equation'), (4, 'Acids, Bases & Salts'), (4, 'pH Scale & Volumetric Analysis (Titration)'), (4, 'Oxidation & Reduction (Redox)'), (4, 'Electrolysis & Faraday''s Laws'), (4, 'Energy Changes & Thermochemistry'), (4, 'Rates of Chemical Reactions'), (4, 'Chemical Equilibrium'), (4, 'Non-Metals: Carbon & Its Compounds'), (4, 'Non-Metals: Oxygen, Hydrogen & Nitrogen'), (4, 'Metals & Their Extraction'), (4, 'Introduction to Organic Chemistry'), (4, 'Hydrocarbons: Alkanes, Alkenes & Alkynes'), (4, 'Alkanols, Organic Acids & Esters'),

-- Biology (5)
(5, 'Living & Non-Living Things'), (5, 'Cell Structure & Functions'), (5, 'Classification of Living Things'), (5, 'Cellular Transport: Diffusion & Osmosis'), (5, 'Plant & Animal Nutrition'), (5, 'Enzymes & Metabolism'), (5, 'Human Digestive System'), (5, 'Transport System in Plants & Animals'), (5, 'Circulatory System & Blood'), (5, 'Respiratory System & Gaseous Exchange'), (5, 'Excretory System'), (5, 'Skeletal System & Movement'), (5, 'Nervous System & Sense Organs'), (5, 'Hormonal Coordination (Endocrine System)'), (5, 'Plant & Animal Reproduction'), (5, 'Genetics & Heredity'), (5, 'Ecology & Ecosystem Dynamics'), (5, 'Adaptations for Survival'), (5, 'Pollution & Conservation of Resources'), (5, 'Microorganisms & Disease Control'),

-- Agricultural Science (6)
(6, 'Meaning & Branches of Agriculture'), (6, 'Importance of Agriculture'), (6, 'Land Use in Agriculture'), (6, 'Agricultural Ecology & Ecosystems'), (6, 'Rock Formation & Weathering'), (6, 'Soil Profile, Properties & Chemistry'), (6, 'Plant Nutrients & Soil Fertility'), (6, 'Farm Power & Machinery'), (6, 'Farm Surveying & Land Measurement'), (6, 'Anatomy & Physiology of Farm Animals'), (6, 'Animal Feeds & Feeding'), (6, 'Livestock Management (Poultry, Ruminants)'), (6, 'Animal Reproduction & Insemination'), (6, 'Animal Diseases & Pest Control'), (6, 'Agronomy of Major Crops (Cereals, Legumes)'), (6, 'Crop Pests & Disease Management'), (6, 'Forestry & Forest Products'), (6, 'Fisheries & Aquaculture Management'), (6, 'Agricultural Economics & Farm Records'), (6, 'Agricultural Extension & Marketing'),

-- Civic Education (7)
(7, 'Values & Civic Responsibilities'), (7, 'Community Development & Self-Reliance'), (7, 'Citizenship & Rights'), (7, 'Duties & Obligations of Citizens'), (7, 'Capitalist, Socialist & Mixed Systems'), (7, 'Human Rights & Universal Declaration'), (7, 'Human Trafficking & Prevention'), (7, 'HIV/AIDS Awareness & Prevention'), (7, 'Youth Empowerment Skills'), (7, 'Democracy & Democratic Processes'), (7, 'Rule of Law & Constitutionalism'), (7, 'Pillars of Democracy'), (7, 'Public Service & Civil Service Reforms'), (7, 'Civil Society Organizations'), (7, 'Popular Participation in Governance'), (7, 'Electoral Process & Voting System'), (7, 'Nationalistic Roles & Patriotism'), (7, 'Orderliness & Society'), (7, 'Drug Abuse & Cultism Prevention'), (7, 'National Security & Defence'),

-- Economics (8)
(8, 'Basic Concepts: Scarcity, Choice & Scale of Preference'), (8, 'Economic Tools of Analysis'), (8, 'Production & Division of Labour'), (8, 'Business Organizations'), (8, 'Demand, Supply & Market Equilibrium'), (8, 'Elasticity of Demand & Supply'), (8, 'Price Determination & Market Structures'), (8, 'Theory of Costs & Revenue'), (8, 'Money, Banking & Financial Institutions'), (8, 'Inflation & Deflation'), (8, 'Public Finance & Taxation'), (8, 'National Income Accounting'), (8, 'Economic Systems'), (8, 'International Trade & Balance of Payments'), (8, 'Economic Integration & Globalization'), (8, 'Population & Labour Market'), (8, 'Agriculture & Industrialization in West Africa'), (8, 'Economic Development & Growth'), (8, 'Petroleum & the Nigerian Economy'), (8, 'International Economic Organizations (ECOWAS, IMF, World Bank)'),

-- Financial Accounting (9)
(9, 'Introduction to Accounting & Principles'), (9, 'Books of Original Entry'), (9, 'The Ledger & Double Entry System'), (9, 'Trial Balance & Error Correction'), (9, 'Cash Book & Bank Reconciliation Statement'), (9, 'Final Accounts of Sole Trader'), (9, 'Adjustments in Final Accounts'), (9, 'Control Accounts'), (9, 'Single Entry & Incomplete Records'), (9, 'Accounts of Non-Profit Making Organizations'), (9, 'Partnership Accounts: Admission & Goodwill'), (9, 'Partnership Accounts: Dissolution'), (9, 'Company Accounts: Issue of Shares & Debentures'), (9, 'Company Accounts: Final Financial Statements'), (9, 'Manufacturing Accounts'), (9, 'Departmental & Branch Accounts'), (9, 'Joint Venture & Consignment Accounts'), (9, 'Public Sector & Government Accounting'), (9, 'Interpretation of Financial Ratios'), (9, 'Information Technology in Accounting'),

-- Commerce (10)
(10, 'Meaning & Scope of Commerce'), (10, 'Occupation & Human Wants'), (10, 'Home Trade: Wholesale & Retail'), (10, 'Foreign Trade: Export, Import & Entrepôt'), (10, 'Documents Used in Trade'), (10, 'Warehousing & Storage'), (10, 'Capital & Profits in Business'), (10, 'Business Units & Ownership Types'), (10, 'Stock Exchange & Capital Market'), (10, 'Commercial Banks & Central Bank Services'), (10, 'Insurance: Principles & Types'), (10, 'Transport Systems in Commerce'), (10, 'Communication & Postal Services'), (10, 'Advertising & Sales Promotion'), (10, 'Consumer Protection & Rights'), (10, 'Business Law: Contract & Agency'), (10, 'Turnover & Financial Calculations'), (10, 'E-Commerce & Digital Banking'), (10, 'Commercial Associations & Chambers of Commerce'), (10, 'International Trade Organizations'),

-- Government (11)
(11, 'Basic Concepts: State, Nation & Society'), (11, 'Power, Authority & Legitimacy'), (11, 'Sovereignty & Constitutionalism'), (11, 'Political Ideas: Capitalism, Socialism & Communism'), (11, 'Democracy, Autocracy & Totalitarianism'), (11, 'Organs of Government: Legislature, Executive & Judiciary'), (11, 'Types of Constitution: Written, Unwritten, Rigid, Flexible'), (11, 'Structures of Governance: Unitary, Federal, Confederal'), (11, 'Presidential & Parliamentary Systems'), (11, 'Political Parties & Electoral Systems'), (11, 'Pressure Groups & Public Opinion'), (11, 'Civil Service & Public Corporations'), (11, 'Local Government System'), (11, 'Pre-Colonial Political Systems in Nigeria'), (11, 'Colonial Administration in West Africa'), (11, 'Nationalism & Constitutional Development in Nigeria'), (11, 'Post-Independence Constitutions (1960, 1963, 1979, 1999)'), (11, 'Nigerian Federalism: Issues & Revenue Allocation'), (11, 'Foreign Policy of Nigeria'), (11, 'International Organizations (UN, AU, Commonwealth, ECOWAS)'),

-- Literature in English (12)
(12, 'Literary Terms & Devices'), (12, 'Types of Drama & Dramatic Techniques'), (12, 'Poetic Forms & Devices'), (12, 'Prose Fiction: Narrative Techniques & Themes'), (12, 'Analysis of African Drama Texts'), (12, 'Analysis of Non-African Drama Texts'), (12, 'Analysis of African Prose Texts'), (12, 'Analysis of Non-African Prose Texts'), (12, 'African Poetry: Themes & Stanzaic Structures'), (12, 'Non-African Poetry: Themes & Stylistic Features'), (12, 'Characterization & Plot Analysis'), (12, 'Setting, Atmosphere & Tone'), (12, 'Symbolism & Imagery in Literature'), (12, 'Irony, Satire & Comedy in Literature'), (12, 'Tragedy & Tragic Flaw Concepts'), (12, 'Oral Literature & Folklore Elements'), (12, 'Unseen Prose & Poetry Analysis'), (12, 'Critical Appreciation Skills'), (12, 'Colonial & Post-Colonial Themes in African Literature'), (12, 'Gender & Social Issues in Literature'),

-- Christian Religious Studies (13)
(13, 'Sovereignty & Creation Story of God'), (13, 'Leadership: Moses, Joshua, Deborah & Gideon'), (13, 'Parental Responsibility: Eli & Samuel'), (13, 'Obedience & Faith: Abraham & Joseph'), (13, 'Kingship in Israel: Saul, David & Solomon'), (13, 'Division of the Kingdom & Religious Reform'), (13, 'Concern for Nation: Nehemiah & Ezra'), (13, 'Prophetic Messages: Amos, Hosea, Isaiah & Jeremiah'), (13, 'The Supremacy of God: Elijah on Mount Carmel'), (13, 'Baptism & Temptation of Jesus'), (13, 'The Call & Mission of the Twelve Apostles'), (13, 'Miracles of Jesus Christ'), (13, 'Sermon on the Mount & Parables of Jesus'), (13, 'The Transfiguration & Triumphal Entry'), (13, 'The Last Supper, Trial & Crucifixion'), (13, 'The Resurrection & Ascension of Jesus'), (13, 'The Holy Spirit & Holy Ghost at Pentecost'), (13, 'The Early Church: Fellowship, Persecution & Stephen'), (13, 'Missionary Journeys of St. Paul'), (13, 'Christian Living: Faith, Works, Love & Hope (Epistles)');

-- 3. Student Progress Tracking
CREATE TABLE IF NOT EXISTS student_progress (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  completed INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
