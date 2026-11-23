
import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure EJS
app.set("view engine", "ejs");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Open Library API configuration
const openLibrary = axios.create({
  baseURL: "https://openlibrary.org",
  timeout: 10000
});

// HOME PAGE: Display all books (READ)
app.get("/", async (req, res) => {
  const sortOptions = {
    title: "title ASC",
    rating: "rating DESC NULLS LAST",
    date: "date_read DESC NULLS LAST"
  };

  const sort = sortOptions[req.query.sort]
    ? req.query.sort
    : "date";

  try {
    const result = await pool.query(
      `SELECT * FROM books
       ORDER BY ${sortOptions[sort]}, id DESC`
    );

    res.render("index", {
      books: result.rows,
      sort,
      error: null
    });

  } catch (error) {
    console.error("Database error:", error);

    res.status(500).render("index", {
      books: [],
      sort,
      error: "Could not load books. Check your database connection."
    });
  }
});

// SEARCH BOOKS USING OPEN LIBRARY API
app.get("/search", async (req, res) => {
  const title = (req.query.title || "").trim();

  let results = [];
  let error = null;

  if (title) {
    try {
      const response = await openLibrary.get("/search.json", {
        params: {
          title: title,
          limit: 10,
          fields: "key,title,author_name,first_publish_year,cover_i,isbn"
        }
      });

      results = (response.data.docs || []).map(book => ({
        title: book.title || "Untitled",
        author: (book.author_name || ["Unknown author"])
          .slice(0, 2).join(", "),
        year: book.first_publish_year || "",
        coverId: book.cover_i || "",
        isbn: (book.isbn || [""])[0]
      }));

    } catch (error) {
      console.error("API error:", error.message);
      error = "Book search is currently unavailable.";
    }
  }

  res.render("search", {
    title,
    results,
    error
  });
});

// ADD NEW BOOK (CREATE)
app.post("/books", async (req, res) => {
  const { title, author, year, coverId, isbn } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).send("Book title is required.");
  }

  const parsedYear = year ? Number.parseInt(year, 10) : null;
  const parsedCover = coverId
    ? Number.parseInt(coverId, 10)
    : null;

  try {
    await pool.query(
      `INSERT INTO books
       (title, author, published_year, isbn, cover_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        title.trim(),
        author || "Unknown author",
        Number.isInteger(parsedYear) ? parsedYear : null,
        isbn || null,
        Number.isInteger(parsedCover) ? parsedCover : null
      ]
    );

    res.redirect("/");

  } catch (error) {
    console.error("Add book error:", error);
    res.status(500).send("Could not save the book.");
  }
});

// SHOW EDIT PAGE
app.get("/books/:id/edit", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM books WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Book not found.");
    }

    res.render("edit", {
      book: result.rows[0]
    });

  } catch (error) {
    console.error("Edit page error:", error);
    res.status(500).send("Could not load book.");
  }
});

// UPDATE BOOK (UPDATE)
app.post("/books/:id/edit", async (req, res) => {
  const { rating, date_read, notes } = req.body;

  const parsedRating = rating === ""
    ? null
    : Number.parseInt(rating, 10);

  if (
    parsedRating !== null &&
    (!Number.isInteger(parsedRating) ||
     parsedRating < 1 ||
     parsedRating > 5)
  ) {
    return res.status(400).send("Rating must be between 1 and 5.");
  }

  try {
    const result = await pool.query(
      `UPDATE books
       SET rating = $1,
           date_read = $2,
           notes = $3
       WHERE id = $4
       RETURNING id`,
      [
        parsedRating,
        date_read || null,
        notes || "",
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).send("Book not found.");
    }

    res.redirect("/");

  } catch (error) {
    console.error("Update error:", error);
    res.status(500).send("Could not update book.");
  }
});

// DELETE BOOK (DELETE)
app.post("/books/:id/delete", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM books WHERE id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).send("Book not found.");
    }

    res.redirect("/");

  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).send("Could not delete book.");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`BookNotes running at http://localhost:${PORT}`);
});
