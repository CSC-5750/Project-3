/* eslint-env node */
/* global process */
import express from "express";
import mysql from "mysql2";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Define our six time slots 
const timeSlots = [
  "4/19/2070, 6:00 PM – 7:00 PM",
  "4/19/2070, 7:00 PM – 8:00 PM",
  "4/19/2070, 8:00 PM – 9:00 PM",
  "4/19/2070, 9:00 PM – 10:00 PM",
  "4/20/2070, 6:00 PM – 7:00 PM",
  "4/20/2070, 7:00 PM – 8:00 PM"
];

// Maximum number of students per time slot
const MAX_SEATS = 6;

// MySQL Connection 
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',      
  password: 'P@ssw0rd',      // add MySQL password
  database: 'demo_registration'
});

db.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL Database.');
});

// Helper function to get remaining seats for each slot
function getSlotsAvailability(callback) {
  // Query counts for each time slot
  const query = `SELECT time_slot, COUNT(*) AS count FROM registrations GROUP BY time_slot`;
  db.query(query, (err, results) => {
    if (err) return callback(err);
    // Build an object with remaining seats per time slot
    let availability = {};
    timeSlots.forEach(slot => {
      availability[slot] = MAX_SEATS; // start with max seats
    });
    results.forEach(row => {
      if (Object.prototype.hasOwnProperty.call(availability, row.time_slot)) {
        availability[row.time_slot] = MAX_SEATS - row.count;
      }
    });
    callback(null, availability);
  });
}

// GET: Registration page
app.get('/', (req, res) => {
  getSlotsAvailability((err, availability) => {
    if (err) return res.send("Error fetching availability");
    res.render('index', { availability });
  });
});


app.post('/register', (req, res) => {
  const { id, first_name, last_name, project_title, email, phone, time_slot, confirm } = req.body;

  const idRegex = /^\d{8}$/;
  const nameRegex = /^[A-Za-z]+$/;
  // Email: starts with alphanumerics, then '@', then domain parts (each 1-20 alphanumerics) separated by dots, total max 80 characters.
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\d{3}-\d{3}-\d{4}$/;
  
  if (!idRegex.test(id)) return res.send("Invalid ID. Must be exactly 8 digits.");
  if (!nameRegex.test(first_name) || !nameRegex.test(last_name))
    return res.send("Invalid name. Only alphabetic characters allowed.");
  if (!emailRegex.test(email))
    return res.send("Invalid email format.");
  if (!phoneRegex.test(phone))
    return res.send("Invalid phone number format. Use 999-999-9999.");

  // First, check available seats for the chosen time slot
  const seatQuery = 'SELECT COUNT(*) AS count FROM registrations WHERE time_slot = ?';
  db.query(seatQuery, [time_slot], (err, results) => {
    if (err) return res.send("Database error (seat check).");
    const count = results[0].count;
    if (count >= MAX_SEATS) {
      return res.send("Selected time slot is fully booked. Please choose another time slot.");
    }
    // Check if student already registered
    const checkQuery = 'SELECT * FROM registrations WHERE id = ?';
    db.query(checkQuery, [id], (err, rows) => {
      if (err) return res.send("Database error (check registration).");

      if (rows.length > 0 && !confirm) {
        // Student is already registered and hasn't confirmed change.
        // Render a confirmation page prompting the change.
        return res.render('confirm', { 
          currentSlot: rows[0].time_slot,
          newSlot: time_slot,
          student: { id, first_name, last_name, project_title, email, phone, time_slot }
        });
      }

      if (rows.length > 0) {
        const updateQuery = 'UPDATE registrations SET first_name = ?, last_name = ?, project_title = ?, email = ?, phone = ?, time_slot = ? WHERE id = ?';
        db.query(updateQuery, [first_name, last_name, project_title, email, phone, time_slot, id], err => {
          if (err) return res.send("Database error (update).");
          return res.send("Registration updated successfully. <a href='/'>Back</a>");
        });
      } else {
        // Insert new registration
        const insertQuery = 'INSERT INTO registrations (id, first_name, last_name, project_title, email, phone, time_slot) VALUES (?, ?, ?, ?, ?, ?, ?)';
        db.query(insertQuery, [id, first_name, last_name, project_title, email, phone, time_slot], err => {
          if (err) return res.send("Database error (insert).");
          return res.send("Registration successful. <a href='/'>Back</a>");
        });
      }
    });
  });
});

app.get('/students', (req, res) => {
  const query = 'SELECT * FROM registrations ORDER BY last_name ASC, first_name ASC';
  db.query(query, (err, results) => {
    if (err) return res.send("Database error (students list).");
    res.render('students', { students: results });
  });
});

// DELETE: Remove a student by ID
app.post('/delete', (req, res) => {
  const { id } = req.body;

  if (!id) return res.send("Student ID is required to delete a record.");

  const deleteQuery = 'DELETE FROM registrations WHERE id = ?';

  db.query(deleteQuery, [id], (err, result) => {
      if (err) return res.send("Database error (delete).");
      if (result.affectedRows === 0) {
          return res.send("No student found with this ID.");
      }
      res.redirect('/students'); // Redirect back to student list after deletion
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
