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
  if (viewDashboardBtn) viewDashboardBtn.addEventListener('click', showDashboard);
  if (backToHomeBtn) backToHomeBtn.addEventListener('click', showHome);
  if (homeLink) homeLink.addEventListener('click', showHome);
  
  // Loan Management
  if (saveLoanBtn) saveLoanBtn.addEventListener('click', saveLoan);
  
  // Form validation
  if (loanForm) loanForm.addEventListener('submit', (e) => e.preventDefault());
  
  // Filter and sort event listeners
  document.getElementById('searchInput')?.addEventListener('input', updateDashboard);
  document.getElementById('statusFilter')?.addEventListener('change', updateDashboard);
  document.getElementById('methodFilter')?.addEventListener('change', updateDashboard);
  document.getElementById('sortBy')?.addEventListener('change', updateDashboard);
}

async function loadLoans() {
  try {
    // Try to fetch from backend first
    try {
      const response = await fetch(`${API_BASE_URL}/loans`);
      if (response.ok) {
        loans = await response.json();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans));
        updateDashboard();
        updateStats();
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (err) {
      console.log('Using localStorage fallback:', err.message);
    }
    
    // Fallback to localStorage
    const savedLoans = localStorage.getItem(LOCAL_STORAGE_KEY);
    loans = savedLoans ? JSON.parse(savedLoans) : [];
    
    updateDashboard();
    updateStats();
  } catch (error) {
    console.error('Error loading loans:', error);
    if (!localStorage.getItem(LOCAL_STORAGE_KEY)) {
      showToast('Failed to load loans', 'danger');
    }
  }
}

function updateDashboard() {
  if (!loansTable) return;
  
  // Get filter values
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('statusFilter')?.value || '';
  const methodFilter = document.getElementById('methodFilter')?.value || '';
  const sortBy = document.getElementById('sortBy')?.value || 'name-asc';
  
  // Filter loans
  let filteredLoans = loans.filter(loan => {
    const matchesSearch = 
      loan.borrowerName.toLowerCase().includes(searchTerm) || 
      loan.phoneNumber.includes(searchTerm);
    
    const dueDate = calculateDueDate(loan.startDate, loan.duration);
    const status = getLoanStatus(loan, dueDate).text;
    const matchesStatus = statusFilter === '' || status === statusFilter;
    const matchesMethod = methodFilter === '' || loan.interestMethod === methodFilter;
    
    return matchesSearch && matchesStatus && matchesMethod;
  });
  
  // Sort loans
  filteredLoans = sortLoans(filteredLoans, sortBy);
  
  // Clear and rebuild table
  loansTable.innerHTML = '';
  
  if (filteredLoans.length === 0) {
    loansTable.innerHTML = `<tr><td colspan="11" class="text-center">No loans found</td></tr>`;
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  filteredLoans.forEach(loan => {
    const row = document.createElement('tr');
    const totalAmount = calculateTotalAmount(
      loan.principal,
      loan.interestRate,
      loan.interestMethod,
      loan.duration
    );
    
    const formattedStartDate = formatDate(loan.startDate);
    const dueDate = calculateDueDate(loan.startDate, loan.duration);
    const formattedDueDate = formatDate(dueDate);
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
        <button class="btn btn-sm btn-danger delete-btn" data-id="${loan.id}">
          <i class="bi bi-trash"></i>
        </button>
        <button class="btn btn-sm btn-success notify-btn" data-id="${loan.id}">
          <i class="bi bi-bell"></i>
        </button>
        <button class="btn btn-sm btn-info view-doc-btn" data-id="${loan.id}" ${!loan.stampPaper ? 'disabled' : ''}>
          <i class="bi bi-file-earmark-text"></i>
        </button>
      </td>
    `;
    
    fragment.appendChild(row);
  });
  
  loansTable.appendChild(fragment);
  addTableButtonListeners();
}

function addTableButtonListeners() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const loanId = e.currentTarget.getAttribute('data-id');
      editLoan(loanId);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const loanId = e.currentTarget.getAttribute('data-id');
      deleteLoan(loanId);
    });
  });
  
  document.querySelectorAll('.notify-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const loanId = e.currentTarget.getAttribute('data-id');
      sendReminder(loanId);
    });
  });

  document.querySelectorAll('.view-doc-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const loanId = e.currentTarget.getAttribute('data-id');
      viewDocument(loanId);
    });
  });
}

function updateStats() {
  const activeLoans = loans.filter(loan => loan.status !== 'paid');
  const paidLoans = loans.filter(loan => loan.status === 'paid');
  const totalRecovered = paidLoans.reduce((sum, loan) => sum + parseFloat(loan.principal), 0);
  const totalActiveAmount = activeLoans.reduce((sum, loan) => sum + parseFloat(loan.principal), 0);
  
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  
  const upcomingPayments = activeLoans.filter(loan => {
    const dueDate = calculateDueDate(loan.startDate, loan.duration);
    return dueDate > today && dueDate <= nextWeek;
  });
  
  const overdueLoans = activeLoans.filter(loan => {
    const dueDate = calculateDueDate(loan.startDate, loan.duration);
    return dueDate < today;
  });
  
  document.getElementById('activeLoansCount').textContent = `${activeLoans.length} ${activeLoans.length === 1 ? 'Loan' : 'Loans'}`;
  document.getElementById('amountRecovered').textContent = `₹${totalRecovered.toFixed(2)} / ₹${totalActiveAmount.toFixed(2)}`;
  document.getElementById('upcomingPayments').textContent = `${upcomingPayments.length} Due This Week`;
  document.getElementById('overdueLoans').textContent = `${overdueLoans.length} ${overdueLoans.length === 1 ? 'Loan' : 'Loans'}`;
  
  updateProfitStats();
}

function updateProfitStats() {
  const paidLoans = loans.filter(loan => loan.status === 'paid');
  
  const totalProfit = paidLoans.reduce((sum, loan) => {
    const totalPaid = calculateTotalAmount(loan.principal, loan.interestRate, loan.interestMethod, loan.duration);
    return sum + (totalPaid - loan.principal);
  }, 0);
  
  const currentYear = new Date().getFullYear();
  const currentYearProfit = paidLoans.reduce((sum, loan) => {
    const paymentYear = new Date(loan.paymentDate || loan.dueDate).getFullYear();
    if (paymentYear === currentYear) {
      const totalPaid = calculateTotalAmount(loan.principal, loan.interestRate, loan.interestMethod, loan.duration);
      return sum + (totalPaid - loan.principal);
    }
    return sum;
  }, 0);
  
  document.getElementById('totalProfit').textContent = `₹${totalProfit.toFixed(2)}`;
  document.getElementById('currentYearProfit').textContent = `₹${currentYearProfit.toFixed(2)}`;
  
  renderProfitChart();
}

function renderProfitChart() {
  const ctx = document.getElementById('profitChart')?.getContext('2d');
  if (!ctx) return;

  // Destroy previous chart if exists and is a valid Chart instance
  if (window.profitChart && typeof window.profitChart.destroy === 'function') {
    window.profitChart.destroy();
  }

  // Rest of your chart rendering code...
  const paidLoans = loans.filter(loan => loan.status === 'paid');
  const profitsByYear = {};
  
  paidLoans.forEach(loan => {
    const year = new Date(loan.paymentDate || loan.dueDate).getFullYear();
    const profit = calculateTotalAmount(loan.principal, loan.interestRate, loan.interestMethod, loan.duration) - loan.principal;
    
    profitsByYear[year] = (profitsByYear[year] || 0) + profit;
  });
  
  const years = Object.keys(profitsByYear).sort();
  const profits = years.map(year => profitsByYear[year]);
  
  window.profitChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Annual Profit (₹)',
        data: profits,
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Profit (₹)' }
        },
        x: {
          title: { display: true, text: 'Year' }
        }
      }
    }
  });
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

    const stampPaperFile = document.getElementById('stampPaper').files[0];
    if (stampPaperFile) {
      loanData.stampPaper = {
        fileName: stampPaperFile.name,
        fileType: stampPaperFile.type,
        lastModified: stampPaperFile.lastModified
      };
    }

    if (!loanData.id) {
      loanData.id = Date.now().toString();
    }
    
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
      console.log('Using localStorage fallback:', err.message);
      loans.push(loanData);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans));
    }
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('addLoanModal'));
    if (modal) modal.hide();
    
    if (loanForm) loanForm.reset();
    setInitialDate();
    
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
  
  document.getElementById('borrowerName').value = loan.borrowerName;
  document.getElementById('phoneNumber').value = loan.phoneNumber;
  document.getElementById('address').value = loan.address;
  document.getElementById('loanAmount').value = loan.principal;
  document.getElementById('interestMethod').value = loan.interestMethod;
  document.getElementById('interestRate').value = loan.interestRate;
  document.getElementById('startDate').value = loan.startDate;
  document.getElementById('duration').value = loan.duration;
  document.getElementById('notes').value = loan.notes || '';
  
  if (saveLoanBtn) {
    saveLoanBtn.textContent = 'Update Loan';
    saveLoanBtn.onclick = () => updateLoan(loanId);
  }
  
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

    const stampPaperFile = document.getElementById('stampPaper').files[0];
    if (stampPaperFile) {
      updatedLoan.stampPaper = {
        fileName: stampPaperFile.name,
        fileType: stampPaperFile.type,
        lastModified: stampPaperFile.lastModified
      };
    }
    
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
      console.log('Using localStorage fallback:', err.message);
      loans[loanIndex] = updatedLoan;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans));
    }
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('addLoanModal'));
    if (modal) modal.hide();
    
    if (loanForm) loanForm.reset();
    setInitialDate();
    
    if (saveLoanBtn) {
      saveLoanBtn.textContent = 'Save Loan';
      saveLoanBtn.onclick = saveLoan;
    }
    
    updateDashboard();
    updateStats();
    
    showToast('Loan updated successfully!', 'success');
  } catch (error) {
    showToast('Failed to update loan', 'danger');
    console.error('Error updating loan:', error);
  }
}

async function deleteLoan(loanId) {
  if (!confirm('Are you sure you want to delete this loan?')) return;

  try {
    // Try to delete from backend first
    let backendSuccess = false;
    try {
      const response = await fetch(`${API_BASE_URL}/loans/${loanId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        backendSuccess = true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Backend delete failed');
      }
    } catch (err) {
      console.log('Using localStorage fallback:', err.message);
    }
    
    // Remove from local array regardless of backend success
    loans = loans.filter(loan => loan.id !== loanId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans));
    
    // Update UI
    updateDashboard();
    updateStats();
    
    // Safely update the profit chart
    try {
      updateProfitStats();
    } catch (chartError) {
      console.error('Error updating profit chart:', chartError);
    }
    
    showToast('Loan deleted successfully!', 'success');
  } catch (error) {
    showToast(error.message || 'Failed to delete loan', 'danger');
    console.error('Error deleting loan:', error);
  }
}

async function sendReminder(loanId) {
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  try {
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
  } else {
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
  document.getElementById('profitTrackerSection').style.display = 'none';
  
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
}

function showHome() {
  document.getElementById('dashboardSection').style.display = 'none';
  document.getElementById('homeSection').style.display = 'block';
  document.getElementById('profitTrackerSection').style.display = 'none';
  
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

function viewDocument(loanId) {
  const loan = loans.find(l => l.id === loanId);
  if (!loan?.stampPaper) return;
  
  alert(`Would display document: ${loan.stampPaper.fileName}`);
}

function sortLoans(loans, sortBy) {
  return [...loans].sort((a, b) => {
    switch(sortBy) {
      case 'name-asc': return a.borrowerName.localeCompare(b.borrowerName);
      case 'name-desc': return b.borrowerName.localeCompare(a.borrowerName);
      case 'amount-asc': return a.principal - b.principal;
      case 'amount-desc': return b.principal - a.principal;
      case 'date-asc': return new Date(a.startDate) - new Date(b.startDate);
      case 'date-desc': return new Date(b.startDate) - new Date(a.startDate);
      default: return 0;
    }
  });
}