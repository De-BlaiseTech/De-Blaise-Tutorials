-- Create Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL -- Science, Commercial, Arts, Technology/Vocational
);

-- Create Tutorials Table
CREATE TABLE IF NOT EXISTS tutorials (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  chalkboard_script TEXT NOT NULL,
  audio_url TEXT,
  quiz_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Create Student Progress Table
CREATE TABLE IF NOT EXISTS student_progress (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES tutorials(id)
);

-- Seed All WAEC & NECO Subjects
INSERT OR REPLACE INTO subjects (id, name, category) VALUES
-- General / Compulsory
('mathematics', 'General Mathematics', 'General'),
('english-language', 'English Language', 'General'),
('civic-education', 'Civic Education', 'General'),
('trade-subjects', 'Marketing & Trade Studies', 'General'),

-- Science Stream
('physics', 'Physics', 'Science'),
('chemistry', 'Chemistry', 'Science'),
('biology', 'Biology', 'Science'),
('further-mathematics', 'Further Mathematics', 'Science'),
('agricultural-science', 'Agricultural Science', 'Science'),
('health-education', 'Health Education', 'Science'),
('computer-studies', 'Computer Studies', 'Science'),

-- Commercial Stream
('financial-accounting', 'Financial Accounting', 'Commercial'),
('commerce', 'Commerce', 'Commercial'),
('economics', 'Economics', 'Commercial'),
('office-practice', 'Office Practice', 'Commercial'),
('insurance', 'Insurance', 'Commercial'),

-- Arts / Humanities Stream
('government', 'Government', 'Arts'),
('literature-in-english', 'Literature-in-English', 'Arts'),
('christian-religious-studies', 'Christian Religious Studies (CRS)', 'Arts'),
('islamic-studies', 'Islamic Religious Studies (IRS)', 'Arts'),
('history', 'History', 'Arts'),
('visual-arts', 'Visual Arts', 'Arts'),
('hausa', 'Hausa Language', 'Arts'),
('igbo', 'Igbo Language', 'Arts'),
('yoruba', 'Yoruba Language', 'Arts'),

-- Technology / Vocational Stream
('technical-drawing', 'Technical Drawing', 'Technology'),
('data-processing', 'Data Processing', 'Technology'),
('catering-craft-practice', 'Catering Craft Practice', 'Technology'),
('clothing-and-textiles', 'Clothing and Textiles', 'Technology');

-- Seed Initial Test Lesson
INSERT OR REPLACE INTO tutorials (id, subject_id, title, chalkboard_script, audio_url, quiz_url)
VALUES (
  'quadratic-equations',
  'mathematics',
  'Solving Quadratic Equations by Factorization',
  '[{"spokenText":"Welcome to de-blaise-tutorials! Today we will solve quadratic equations using factorization.","chalkboardAction":"Solve: x² + 5x + 6 = 0"},{"spokenText":"First, find two numbers that multiply to give 6 and add up to 5. These are 2 and 3.","chalkboardAction":"Factors: (x + 2)(x + 3) = 0"},{"spokenText":"Therefore, set each factor equal to zero to find x.","chalkboardAction":"x = -2 OR x = -3"}]',
  'https://assets.example.com/audio/quadratic.mp3',
  'https://your-quiz-website.com/practice?subject=mathematics&topic=quadratic-equations'
);
