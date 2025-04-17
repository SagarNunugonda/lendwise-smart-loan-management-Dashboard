const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// In-memory database (replace with real database in production)
let loansDB = [];

// Load initial data if exists
const dataPath = path.join(__dirname, 'data.json');
try {
  if (fs.existsSync(dataPath)) {
    loansDB = JSON.parse(fs.readFileSync(dataPath));
  }
} catch (err) {
  console.error('Error loading data:', err);
}

// Helper function to save data
function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify(loansDB, null, 2));
}

// API Endpoints
app.get('/api/loans', (req, res) => {
  res.json(loansDB);
});

app.post('/api/loans', (req, res) => {
  const newLoan = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  loansDB.push(newLoan);
  saveData();
  res.status(201).json(newLoan);
});

app.put('/api/loans/:id', (req, res) => {
  const index = loansDB.findIndex(loan => loan.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Loan not found' });
  
  loansDB[index] = { ...loansDB[index], ...req.body };
  saveData();
  res.json(loansDB[index]);
});

app.post('/api/loans/:id/remind', (req, res) => {
  const loan = loansDB.find(loan => loan.id === req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  
  res.json({ message: `Reminder sent to ${loan.borrowerName}` });
});

app.delete('/api/loans/:id', (req, res) => {
  const index = loansDB.findIndex(loan => loan.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ 
      success: false,
      error: 'Loan not found' 
    });
  }
  
  loansDB.splice(index, 1);
  saveData();
  
  res.json({ 
    success: true,
    message: 'Loan deleted successfully',
    deletedId: req.params.id
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});