// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const LOCAL_STORAGE_KEY = 'lendwise_loans';
let loans = [];

// DOM Elements
const viewDashboardBtn = document.getElementById('viewDashboardBtn');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const homeLink = document.getElementById('homeLink');
const saveLoanBtn = document.getElementById('saveLoanBtn');
const loanForm = document.getElementById('loanForm');
const loansTable = document.getElementById('loansTable')?.getElementsByTagName('tbody')[0];
const darkModeToggle = document.getElementById('darkModeToggle');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  setupEventListeners();
  loadLoans();
  setInitialDate();
});

function setInitialDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('startDate').value = today;
  document.getElementById('startDate').min = today;
}

function initDarkMode() {
  const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
  
  if (darkModeToggle) {
    darkModeToggle.checked = darkModeEnabled;
    toggleDarkMode(darkModeEnabled);
    
    darkModeToggle.addEventListener('change', (e) => {
      const isDark = e.target.checked;
      localStorage.setItem('darkMode', isDark);
      toggleDarkMode(isDark);
    });
  }
}

function toggleDarkMode(enable) {
  document.body.classList.toggle('dark-mode', enable);
}

function setupEventListeners() {
  // Navigation
  if (viewDashboardBtn) {
    viewDashboardBtn.addEventListener('click', showDashboard);
  }

  if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', showHome);
  }

  if (homeLink) {
    homeLink.addEventListener('click', showHome);
  }
  
  // Loan Management
  if (saveLoanBtn) {
    saveLoanBtn.addEventListener('click', saveLoan);
  }
  
  // Form validation
  if (loanForm) {
    loanForm.addEventListener('submit', (e) => e.preventDefault());
  }
}

async function loadLoans() {
  try {
    // Try to fetch from backend first
    try {
      const response = await fetch(`${API_BASE_URL}/loans`);
      if (response.ok) {
        loans = await response.json();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans));
      } else {
        throw new Error('Backend not available');
      }
    } catch (err) {
      // Fallback to localStorage
      console.log('Using localStorage fallback:', err.message);
      const savedLoans = localStorage.getItem(LOCAL_STORAGE_KEY);
      loans = savedLoans ? JSON.parse(savedLoans) : [];
    }
    
    updateDashboard();
    updateStats();
  } catch (error) {
    showToast('Failed to load loans', 'danger');
    console.error('Error loading loans:', error);
  }
}

function updateDashboard() {
  if (!loansTable) return;
  
  // Clear existing rows efficiently
  while (loansTable.firstChild) {
    loansTable.removeChild(loansTable.firstChild);
  }
  
  // Create document fragment for better performance
  const fragment = document.createDocumentFragment();
  
  loans.forEach(loan => {
    const row = document.createElement('tr');
    
    // Calculate total amount
    const totalAmount = calculateTotalAmount(
      loan.principal,
      loan.interestRate,
      loan.interestMethod,
      loan.duration
    );
    
    // Format dates
    const formattedStartDate = formatDate(loan.startDate);
    const dueDate = calculateDueDate(loan.startDate, loan.duration);
    const formattedDueDate = formatDate(dueDate);
    
    // Determine status
    const status = getLoanStatus(loan, dueDate);
    
    row.innerHTML = `
      <td>${loan.borrowerName}</td>
      <td>${formatPhoneNumber(loan.phoneNumber)}</td>
      <td>₹${loan.principal.toLocaleString()}</td>
      <td>${loan.interestMethod.charAt(0).toUpperCase() + loan.interestMethod.slice(1)}</td>
      <td>${loan.interestRate}%</td>
      <td>₹${totalAmount.toFixed(2)}</td>
      <td>${formattedStartDate}</td>
      <td>${formattedDueDate}</td>
      <td>${truncateText(loan.address, 15)}</td>
      <td><span class="badge bg-${status.class}">${status.text}</span></td>
      <td>
        <button class="btn btn-sm btn-primary edit-btn" data-id="${loan.id}">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-success notify-btn" data-id="${loan.id}">
          <i class="bi bi-bell"></i>
        </button>
      </td>
    `;
    
    fragment.appendChild(row);
  });
  
  loansTable.appendChild(fragment);
  
  // Add event listeners to new buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const loanId = e.currentTarget.getAttribute('data-id');
      editLoan(loanId);
    });
  });
  
  document.querySelectorAll('.notify-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const loanId = e.currentTarget.getAttribute('data-id');
      sendReminder(loanId);
    });
  });
}

function updateStats() {
  const activeLoans = loans.filter(loan => loan.status !== 'paid');
  const paidLoans = loans.filter(loan => loan.status === 'paid');
  const totalRecovered = paidLoans.reduce((sum, loan) => sum + parseFloat(loan.principal), 0);
  const totalActiveAmount = activeLoans.reduce((sum, loan) => sum + parseFloat(loan.principal), 0);
  
  // Calculate upcoming payments (due in the next 7 days)
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  
  const upcomingPayments = activeLoans.filter(loan => {
    const dueDate = calculateDueDate(loan.startDate, loan.duration);
    return dueDate > today && dueDate <= nextWeek;
  });
  
  // Calculate overdue loans
  const overdueLoans = activeLoans.filter(loan => {
    const dueDate = calculateDueDate(loan.startDate, loan.duration);
    return dueDate < today;
  });
  
  // Update UI
  document.getElementById('activeLoansCount').textContent = `${activeLoans.length} ${activeLoans.length === 1 ? 'Loan' : 'Loans'}`;
  document.getElementById('amountRecovered').textContent = `₹${totalRecovered.toFixed(2)} / ₹${totalActiveAmount.toFixed(2)}`;
  document.getElementById('upcomingPayments').textContent = `${upcomingPayments.length} Due This Week`;
  document.getElementById('overdueLoans').textContent = `${overdueLoans.length} ${overdueLoans.length === 1 ? 'Loan' : 'Loans'}`;
}

async function saveLoan() {
  if (!validateLoanForm()) return;

  try {
    const loanData = {
      borrowerName: document.getElementById('borrowerName').value.trim(),
      phoneNumber: document.getElementById('phoneNumber').value.trim(),
      address: document.getElementById('address').value.trim(),
      principal: parseFloat(document.getElementById('loanAmount').value),
      interestMethod: document.getElementById('interestMethod').value,
      interestRate: parseFloat(document.getElementById('interestRate').value),
      startDate: document.getElementById('startDate').value,
      duration: parseInt(document.getElementById('duration').value),
      notes: document.getElementById('notes').value.trim(),
      status: 'unpaid'
    };

    // Generate ID only if not from backend
    if (!loanData.id) {
      loanData.id = Date.now().toString();
    }
    
    // Try to save to backend first
    try {
      const response = await fetch(`${API_BASE_URL}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanData)
      });
      
      if (response.ok) {
        const newLoan = await response.json();
        loans.push(newLoan);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans));
      } else {
        throw new Error('Backend save failed');
      }
    } catch (err) {
      // Fallback to localStorage
      console.log('Using localStorage fallback:', err.message);
      loans.push(loanData);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans));
    }
    
    // Close modal and reset form
    const modal = bootstrap.Modal.getInstance(document.getElementById('addLoanModal'));
    if (modal) modal.hide();
    
    if (loanForm) loanForm.reset();
    setInitialDate();
    
    // Update UI
    updateDashboard();
    updateStats();
    
    showToast('Loan added successfully!', 'success');
    triggerConfetti();
  } catch (error) {
    showToast('Failed to save loan', 'danger');
    console.error('Error saving loan:', error);
  }
}

function validateLoanForm() {
  const phoneNumber = document.getElementById('phoneNumber').value;
  if (!/^\d{10}$/.test(phoneNumber)) {
    showToast('Please enter a valid 10-digit phone number', 'warning');
    return false;
  }

  const loanAmount = parseFloat(document.getElementById('loanAmount').value);
  if (isNaN(loanAmount)) {
    showToast('Please enter a valid loan amount', 'warning');
    return false;
  }

  return true;
}


function editLoan(loanId) {
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  // Populate modal with loan data
  document.getElementById('borrowerName').value = loan.borrowerName;
  document.getElementById('phoneNumber').value = loan.phoneNumber;
  document.getElementById('address').value = loan.address;
  document.getElementById('loanAmount').value = loan.principal;
  document.getElementById('interestMethod').value = loan.interestMethod;
  document.getElementById('interestRate').value = loan.interestRate;
  document.getElementById('startDate').value = loan.startDate;
  document.getElementById('duration').value = loan.duration;
  document.getElementById('notes').value = loan.notes || '';
  
  // Change save button to update
  if (saveLoanBtn) {
    saveLoanBtn.textContent = 'Update Loan';
    saveLoanBtn.onclick = () => updateLoan(loanId);
  }
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('addLoanModal'));
  modal.show();
}

async function updateLoan(loanId) {
  if (!validateLoanForm()) return;

  try {
    const loanIndex = loans.findIndex(l => l.id === loanId);
    if (loanIndex === -1) return;
    
    const updatedLoan = {
      ...loans[loanIndex],
      borrowerName: document.getElementById('borrowerName').value.trim(),
      phoneNumber: document.getElementById('phoneNumber').value.trim(),
      address: document.getElementById('address').value.trim(),
      principal: parseFloat(document.getElementById('loanAmount').value),
      interestMethod: document.getElementById('interestMethod').value,
      interestRate: parseFloat(document.getElementById('interestRate').value),
      startDate: document.getElementById('startDate').value,
      duration: parseInt(document.getElementById('duration').value),
      notes: document.getElementById('notes').value.trim()
    };
    
    // Try to update in backend first
    try {
      const response = await fetch(`${API_BASE_URL}/loans/${loanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLoan)
      });
      
      if (response.ok) {
        loans[loanIndex] = updatedLoan;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans));
      } else {
        throw new Error('Backend update failed');
      }
    } catch (err) {
      // Fallback to localStorage
      console.log('Using localStorage fallback:', err.message);
      loans[loanIndex] = updatedLoan;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans));
    }
    
    // Close modal and reset form
    const modal = bootstrap.Modal.getInstance(document.getElementById('addLoanModal'));
    if (modal) modal.hide();
    
    if (loanForm) loanForm.reset();
    setInitialDate();
    
    // Reset save button
    if (saveLoanBtn) {
      saveLoanBtn.textContent = 'Save Loan';
      saveLoanBtn.onclick = saveLoan;
    }
    
    // Update UI
    updateDashboard();
    updateStats();
    
    showToast('Loan updated successfully!', 'success');
  } catch (error) {
    showToast('Failed to update loan', 'danger');
    console.error('Error updating loan:', error);
  }
}

async function sendReminder(loanId) {
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  try {
    // Try to send via backend first
    try {
      const response = await fetch(`${API_BASE_URL}/loans/${loanId}/remind`, { 
        method: 'POST' 
      });
      
      if (!response.ok) {
        throw new Error('Backend reminder failed');
      }
    } catch (err) {
      console.log('Using frontend-only reminder:', err.message);
    }
    
    showToast(`Reminder sent to ${loan.borrowerName}`, 'success');
    
    // Button animation
    const btn = document.querySelector(`.notify-btn[data-id="${loanId}"]`);
    if (btn) {
      btn.innerHTML = '<i class="bi bi-check"></i>';
      setTimeout(() => {
        btn.innerHTML = '<i class="bi bi-bell"></i>';
      }, 1000);
    }
  } catch (error) {
    showToast('Failed to send reminder', 'danger');
    console.error('Error sending reminder:', error);
  }
}

// Helper Functions
function calculateTotalAmount(principal, rate, method, duration) {
  const months = parseInt(duration);
  rate = parseFloat(rate) / 100;
  principal = parseFloat(principal);
  
  if (method === 'simple') {
    return principal * (1 + rate * months / 12);
  } else { // compound
    return principal * Math.pow(1 + rate/12, months);
  }
}

function calculateDueDate(startDate, duration) {
  const dueDate = new Date(startDate);
  dueDate.setMonth(dueDate.getMonth() + parseInt(duration));
  return dueDate;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPhoneNumber(phone) {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}

function truncateText(text, maxLength) {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

function getLoanStatus(loan, dueDate) {
  const today = new Date();
  
  if (loan.status === 'paid') {
    return { text: 'Paid', class: 'success' };
  } else if (dueDate < today) {
    return { text: 'Overdue', class: 'danger' };
  } else if (dueDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
    return { text: 'Due Soon', class: 'warning' };
  } else {
    return { text: 'Active', class: 'primary' };
  }
}

// UI Functions
function showDashboard() {
  document.getElementById('homeSection').style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'block';
  
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
}

function showHome() {
  document.getElementById('dashboardSection').style.display = 'none';
  document.getElementById('homeSection').style.display = 'block';
  
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  if (homeLink) homeLink.classList.add('active');
}

function showToast(message, type = 'success') {
  const toastEl = document.getElementById('liveToast');
  const toastBody = toastEl?.querySelector('.toast-body');
  
  if (toastEl && toastBody) {
    toastBody.textContent = message;
    toastEl.className = `toast show align-items-center text-white bg-${type}`;
    
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 5000);
  }
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}