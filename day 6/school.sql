-- day6/school.sql
-- School database: students, courses and enrolments (SQLite)

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------

CREATE TABLE students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT NOT NULL,
    credits   INTEGER NOT NULL
);

CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL,
    course_id    INTEGER NOT NULL,
    grade        TEXT,  -- NULL until the student has been graded
    FOREIGN KEY (student_id) REFERENCES students (student_id),
    FOREIGN KEY (course_id)  REFERENCES courses (course_id),
    -- the same student cannot enrol on the same course twice
    UNIQUE (student_id, course_id)
);

-- ---------------------------------------------------------
-- 2. Sample data
-- ---------------------------------------------------------

INSERT INTO students (name, email) VALUES
    ('Amina Wanjiru', 'amina.wanjiru@school.ac.ke'),
    ('Brian Otieno',  'brian.otieno@school.ac.ke'),
    ('Cynthia Njeri', 'cynthia.njeri@school.ac.ke'),
    ('David Kamau',   'david.kamau@school.ac.ke');

INSERT INTO courses (title, credits) VALUES
    ('Databases',       4),
    ('Web Development', 3),
    ('Python Basics',   3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 'A'),
    (1, 2, 'B'),
    (2, 1, 'B'),
    (2, 3, 'C'),
    (3, 1, 'A'),
    (3, 2, NULL),
    (3, 3, 'B');
-- David (student 4) has no enrolments on purpose, to test query 4.

-- ---------------------------------------------------------
-- 3. Queries
-- ---------------------------------------------------------

-- Query 1: all courses for one student (by name)
SELECT s.name, c.title, e.grade
FROM students s
JOIN enrolments e ON e.student_id = s.student_id
JOIN courses c    ON c.course_id  = e.course_id
WHERE s.name = 'Amina Wanjiru';

-- Query 2: all students on one course
SELECT c.title, s.name, s.email
FROM courses c
JOIN enrolments e ON e.course_id  = c.course_id
JOIN students s   ON s.student_id = e.student_id
WHERE c.title = 'Databases';

-- Query 3: number of students per course
-- (LEFT JOIN so a course with no students would still show 0)
SELECT c.title, COUNT(e.enrolment_id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON e.course_id = c.course_id
GROUP BY c.course_id, c.title;

-- Query 4: students who have no enrolments
SELECT s.student_id, s.name
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.student_id
WHERE e.enrolment_id IS NULL;

-- Query 5: update one enrolment's grade
-- (Cynthia's grade for Web Development was empty; now she gets a B)
UPDATE enrolments
SET grade = 'B'
WHERE student_id = 3 AND course_id = 2;

-- Check the update worked
SELECT s.name, c.title, e.grade
FROM enrolments e
JOIN students s ON s.student_id = e.student_id
JOIN courses c  ON c.course_id  = e.course_id
WHERE e.student_id = 3 AND e.course_id = 2;
