# Library Books REST API

Design for the `books` resource of a library system.

- Base path: `/books`
- Data format: JSON
- A book looks like this:

```json
{
  "id": 7,
  "title": "Weep Not, Child",
  "author": "Ngugi wa Thiong'o",
  "isbn": "9780435908300",
  "year": 1964
}
```

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns every book in the library.
- **Request body:** none
- **Success status:** `200 OK`

### 2. Get one book

- **Method:** `GET`
- **Path:** `/books/{id}`
- **Description:** Returns the single book with the given id.
- **Request body:** none
- **Success status:** `200 OK`

### 3. Create a book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the library.
- **Example request body:**

```json
{
  "title": "The River Between",
  "author": "Ngugi wa Thiong'o",
  "isbn": "9780435905484",
  "year": 1965
}
```

- **Success status:** `201 Created`

### 4. Update a book

- **Method:** `PUT`
- **Path:** `/books/{id}`
- **Description:** Replaces the details of an existing book.
- **Example request body:**

```json
{
  "title": "The River Between",
  "author": "Ngugi wa Thiong'o",
  "isbn": "9780435905484",
  "year": 1966
}
```

- **Success status:** `200 OK`

### 5. Delete a book

- **Method:** `DELETE`
- **Path:** `/books/{id}`
- **Description:** Removes the book with the given id from the library.
- **Request body:** none
- **Success status:** `204 No Content`

### 6. List books by an author

- **Method:** `GET`
- **Path:** `/books?author={name}`
- **Description:** Returns only the books written by the given author, using a query parameter.
- **Example:** `GET /books?author=Chinua%20Achebe`
- **Request body:** none
- **Success status:** `200 OK`

## Error codes

### 400 Bad Request

- The request is invalid, so the server cannot process it.
- **Example:** `POST /books` with a body that has no `title`, or where `year` is the text `"nineteen sixty"` instead of a number.

### 404 Not Found

- The requested resource does not exist.
- **Example:** `GET /books/9999` when no book has the id `9999`.
- **Example:** `DELETE /books/9999` for a book that was already deleted.
