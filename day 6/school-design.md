# School Database Design

This database keeps track of which students are taking which courses, and what grade they got.

## Tables

### students

- Stores one row per student.
- `student_id` is the primary key.
- `name` and `email` are required (`NOT NULL`).
- `email` is `UNIQUE`, so two students cannot share the same email address.

### courses

- Stores one row per course.
- `course_id` is the primary key.
- `title` and `credits` are required.

### enrolments

- Stores one row per student-on-a-course, and holds the `grade`.
- `enrolment_id` is the primary key.
- `student_id` is a foreign key to `students`, and `course_id` is a foreign key to `courses`.
- `grade` can be `NULL` because a student has no grade until the course is marked.
- A `UNIQUE (student_id, course_id)` rule stops the same student enrolling on the same course twice.

## Relationships

- **students to enrolments: one-to-many.** One student can have many enrolments, but each enrolment belongs to exactly one student.
- **courses to enrolments: one-to-many.** One course can have many enrolments, but each enrolment belongs to exactly one course.
- **students to courses: many-to-many.** A student can take many courses, and a course can have many students. This relationship is made from the two one-to-many relationships above.

### Why a join table is needed

- A relational table cannot store a list of values in one cell. Putting `course_ids` inside `students` (or `student_ids` inside `courses`) would break the rules of a clean design and make queries hard.
- The `enrolments` table solves this by turning the many-to-many relationship into two one-to-many relationships.
- It is also the natural place to keep data that belongs to the pair, not to either side alone. The grade belongs to "this student on this course", so it lives in `enrolments`.

## Index

- **Index:** `CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);`
- **Reason:** The `UNIQUE (student_id, course_id)` rule already creates an index that helps when searching by student. Searching by course alone ("all students on this course" or "students per course") cannot use that index efficiently, so it would scan the whole table. An index on `course_id` makes these queries fast as the number of enrolments grows.

## SQL or NoSQL?

I would choose SQL (a relational database such as SQLite, PostgreSQL or MySQL) for this system. The data is structured and has clear relationships between students, courses and enrolments, and it needs to stay correct: foreign keys make sure an enrolment cannot point to a student or course that does not exist, and the unique rule prevents duplicate enrolments. Questions such as "how many students are on each course" or "which students have no enrolments" are joins and aggregates, which SQL handles very well. A NoSQL database such as MongoDB would be a better fit if the data had no fixed shape, or if the system had to scale across many servers with very high write volumes, but a school's records are small, structured and highly connected, so SQL is the simpler and safer choice.
