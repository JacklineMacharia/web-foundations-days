let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// Search notes using filter, toLowerCase and includes
const searchNotes = (keyword) => {
    return notes.filter((note) => note.text.toLowerCase().includes(keyword.toLowerCase()));
};

// Find the longest note
const longestNote = () => {
    if (notes.length === 0) {
        return null;
    }

    let longest = notes[0];

    for (let note of notes) {
        if (note.text.length > longest.text.length) {
            longest = note;
        }
    }
    
    return longest;
};

// Count notes by category
const countByCategory = () => {
    let counts = {};

    for (let note of notes) {
        if (counts[note.category]) {
            counts[note.category]++;
        }else {
            counts[note.category] = 1;
        }
    }
    return counts;
};

// Get summary
const getSummary = () => {
    let counts = countByCategory();
    let total = notes.length;

    let noteWord = total === 1 ? "note" : "notes";

  return `You have ${total} ${noteWord}: ${counts.personal || 0} personal, ${counts.study || 0} study, ${counts.work || 0} work.`;
};

// Check for duplicate notes
const isDuplicate = (text) => {
    return notes.some((note) => 
    note.text.trim().toLowerCase() === text.trim().toLowerCase());
};

// Add a new note
const addNote = (text, category) => {
    if (isDuplicate(text)) {
        return "Duplicate note";
    }

    if (text.trim().length === 0) {
        return "Note text cannot be empty";
    }

    if (!["personal", "study", "work"].includes(category)) {
        return "Invalid category";
    }

    const newNote = {
        id: notes.length + 1,
        text: text.trim(),
        category: category
    };
    notes.push(newNote);
};

// searchNotes
console.log(searchNotes("javascript"));

console.log(searchNotes("football"));


// longestNote
console.log(longestNote());

console.log(longestNote());


// countByCategory
console.log(countByCategory());

console.log(countByCategory()["work"]);


// getSummary
console.log(getSummary());

console.log(notes.length);


// isDuplicate
console.log(isDuplicate("Buy milk and bread"));

console.log(isDuplicate("Buy eggs"));


// addNote
console.log(addNote("Go for a walk", "personal"));

console.log(addNote("Buy milk and bread", "personal"));