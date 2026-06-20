// --- STATE MANAGEMENT ---
let freightChartInstance = null;
let expenseChartInstance = null;
let allTripsData = [];
let allCashData = [];
let allExpensesData = [];
let deleteTarget = {
    type: null, // 'trip' or 'cash'
    id: null    // 0-based data index (row index)
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    // Set current date in forms
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("trip-date").value = today;
    document.getElementById("cash-date").value = today;
    
    // Set header date badge
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById("current-date-badge").innerText = new Date().toLocaleDateString('en-US', options);

    // Setup Event Listeners
    setupTabNavigation();
    setupFormCalculations();
    setupFormSubmissions();
    setupThemeToggle();
    setupFiltersAndSearches();
    setupDeleteConfirmation();

    // Initial welcome setup & scroll animation listener
    switchTab("welcome");
    initScrollContainerAnimation();
});

// --- THEME TOGGLE ---
function setupThemeToggle() {
    const btn = document.getElementById("theme-toggle-btn");
    const sunIcon = btn.querySelector(".sun-icon");
    const moonIcon = btn.querySelector(".moon-icon");

    // Load saved preference
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        document.body.classList.remove("dark-theme");
        sunIcon.style.display = "none";
        moonIcon.style.display = "inline";
    }

    btn.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");
        document.body.classList.toggle("dark-theme");

        const isLight = document.body.classList.contains("light-theme");
        localStorage.setItem("theme", isLight ? "light" : "dark");

        if (isLight) {
            sunIcon.style.display = "none";
            moonIcon.style.display = "inline";
        } else {
            sunIcon.style.display = "inline";
            moonIcon.style.display = "none";
        }
        
        // Re-render charts with updated theme colors if on dashboard
        if (document.getElementById("view-dashboard").classList.contains("active")) {
            loadDashboardData();
        }
    });
}

// --- TAB ROUTING ---
function setupTabNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetTab = item.getAttribute("data-tab");
            switchTab(targetTab);
        });
    });

    // Event delegation to capture clicks on custom CTA buttons (including inner text or icon elements)
    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".cta-button[data-tab]");
        if (btn) {
            const targetTab = btn.getAttribute("data-tab");
            switchTab(targetTab);
        }
    });
}

function switchTab(tabId) {
    // Role-based protection: block non-Owner users from accessing Owner-only tabs
    const ownerTabs = ["dashboard", "driver-advances", "expense-ledger", "cash-report"];
    if (ownerTabs.includes(tabId) && window.currentUser && window.currentUser.role !== "Owner") {
        showToast("Access Denied: Owner permissions required.", "error");
        setTimeout(() => {
            switchTab("welcome");
        }, 0);
        return;
    }

    // Remove active from all nav items
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
    // Add active to matching nav items (matching desktop and responsive if duplicate)
    document.querySelectorAll(`.nav-item[data-tab="${tabId}"]`).forEach(btn => btn.classList.add("active"));

    // Show active view, hide others
    document.querySelectorAll(".tab-view").forEach(view => {
        view.classList.remove("active");
    });
    
    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) {
        targetView.classList.add("active");
    }

    // Set page title
    const pageTitleMap = {
        "welcome": "Welcome Portal",
        "dashboard": "Dashboard Overview",
        "trip-entry": "Record New Trip",
        "cash-entry": "Driver Cash Settlement",
        "trip-list": "Trip Directory",
        "cash-list": "Driver Cash Ledger",
        "driver-advances": "Driver Advances Summary",
        "expense-ledger": "Expense Ledger logs",
        "cash-report": "Fleet Cash Flow Analysis"
    };
    const pageSubtitleMap = {
        "welcome": "Interactive 3D overview & features presentation",
        "dashboard": "Real-time statistics & visual analytics",
        "trip-entry": "Add trip logs, source/destination routes and customer freight",
        "cash-entry": "Settlements of opening, advances, diesel and upkeep cash",
        "trip-list": "History of all logged trips and collection balances",
        "cash-list": "Historical ledger logs of all driver cash transactions",
        "driver-advances": "Sum of total cash advances allocated to drivers",
        "expense-ledger": "Breakdown list of diesel, maint, food and other fleet costs",
        "cash-report": "Integrated flows showing running balances of driver bags"
    };

    document.getElementById("page-title").innerText = pageTitleMap[tabId] || "Fleet Entry System";
    document.getElementById("page-subtitle").innerText = pageSubtitleMap[tabId] || "";

    // Load Data relative to the active tab
    if (tabId === "welcome") {
        loadWelcomeData();
        // Trigger scroll event after view becomes visible to recalibrate transforms
        setTimeout(() => {
            window.dispatchEvent(new Event('scroll'));
        }, 50);
    }
    else if (tabId === "dashboard") loadDashboardData();
    else if (tabId === "trip-list") loadTripsList();
    else if (tabId === "cash-list") loadCashList();
    else if (tabId === "driver-advances") loadDriverAdvances();
    else if (tabId === "expense-ledger") loadExpenseLedger();
    else if (tabId === "cash-report") loadCashReport();
}

// --- FORM CALCULATIONS ---
function setupFormCalculations() {
    // Trip form calculations
    const tripFreight = document.getElementById("trip-freight");
    const tripReceived = document.getElementById("trip-received");
    const tripPending = document.getElementById("trip-pending");

    const calcTripPending = () => {
        const freight = parseFloat(tripFreight.value) || 0;
        const received = parseFloat(tripReceived.value) || 0;
        tripPending.value = (freight - received).toFixed(2);
    };

    tripFreight.addEventListener("input", calcTripPending);
    tripReceived.addEventListener("input", calcTripPending);

    // Driver Cash form calculations
    const cashOpening = document.getElementById("cash-opening");
    const cashAdvanceOffline = document.getElementById("cash-advance-offline");
    const cashAdvanceOnline = document.getElementById("cash-advance-online");
    const cashDiesel = document.getElementById("cash-diesel");
    const cashMaint = document.getElementById("cash-maintenance");
    const cashFood = document.getElementById("cash-food");
    const cashOther = document.getElementById("cash-other");
    const cashTotalExpense = document.getElementById("cash-total-expense");
    const cashClosing = document.getElementById("cash-closing");
    const cashActualClosing = document.getElementById("cash-actual-closing");
    const cashDifference = document.getElementById("cash-difference");

    const calcCashSettlements = () => {
        const opening = parseFloat(cashOpening.value) || 0;
        const advanceOffline = parseFloat(cashAdvanceOffline.value) || 0;
        const diesel = parseFloat(cashDiesel.value) || 0;
        const maint = parseFloat(cashMaint.value) || 0;
        const food = parseFloat(cashFood.value) || 0;
        const other = parseFloat(cashOther.value) || 0;
        const actualClosing = parseFloat(cashActualClosing.value) || 0;

        const totalExpense = diesel + maint + food + other;
        const calculatedClosing = opening + advanceOffline - totalExpense;
        const difference = actualClosing - calculatedClosing;

        cashTotalExpense.value = totalExpense.toFixed(2);
        cashClosing.value = calculatedClosing.toFixed(2);
        cashDifference.value = difference.toFixed(2);
        
        cashDifference.classList.remove("amount-positive", "amount-negative", "amount-pending");
        if (difference > 0) {
            cashDifference.classList.add("amount-pending");
        } else if (difference < 0) {
            cashDifference.classList.add("amount-negative");
        } else {
            cashDifference.classList.add("amount-positive");
        }
    };

    [cashOpening, cashAdvanceOffline, cashAdvanceOnline, cashDiesel, cashMaint, cashFood, cashOther, cashActualClosing].forEach(elem => {
        if (elem) {
            elem.addEventListener("input", calcCashSettlements);
        }
    });
}

// --- DASHBOARD DATA & CHARTS ---
async function loadDashboardData() {
    try {
        const res = await fetch('/api/reports/summary');
        const summary = await res.json();

        // Update KPIs
        document.getElementById("summary-total-freight").innerText = `₹${formatNumber(summary.trips.total_freight)}`;
        document.getElementById("summary-trips-count").innerText = `${summary.trips.total_count} Trips Recorded`;
        document.getElementById("summary-total-received").innerText = `₹${formatNumber(summary.trips.total_received)}`;
        document.getElementById("summary-total-pending").innerText = `₹${formatNumber(summary.trips.total_pending)}`;
        document.getElementById("summary-total-expenses").innerText = `₹${formatNumber(summary.cash.total_expenses)}`;
        document.getElementById("summary-advances-sum").innerText = `Adv: Offline ₹${formatNumber(summary.cash.total_advance_offline)} | Online ₹${formatNumber(summary.cash.total_advance_online)}`;

        const pendingCard = document.getElementById("summary-total-pending").parentElement;
        const alertText = document.getElementById("pending-alert-text");
        if (summary.trips.total_pending > 0) {
            pendingCard.className = "metric-card card-glow-red";
            alertText.innerText = "Collection Balance Remaining";
            alertText.className = "metric-change text-red";
        } else {
            pendingCard.className = "metric-card card-glow-green";
            alertText.innerText = "Collections Completed!";
            alertText.className = "metric-change text-green";
        }

        // Load recent trips (limit to 5)
        const tripsRes = await fetch('/api/trips');
        const trips = await tripsRes.json();
        renderRecentTrips(trips.slice(-5).reverse());

        // Load recent cash logs (limit to 5)
        const cashRes = await fetch('/api/driver-cash');
        const cashLogs = await cashRes.json();
        renderRecentCash(cashLogs.slice(-5).reverse());

        // Render Charts
        renderCharts(trips, summary.cash);

    } catch (e) {
        console.error("Error loading dashboard metrics:", e);
        showToast("Failed to load dashboard data.", "error");
    }
}

function renderRecentTrips(trips) {
    const tbody = document.getElementById("recent-trips-table").querySelector("tbody");
    if (trips.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="placeholder-text">No trips logged yet.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = trips.map(t => {
        const pending = parseFloat(t["Pending Amount"]) || 0;
        let pendingClass = "amount-positive";
        if (pending > 0) pendingClass = "amount-pending";
        else if (pending < 0) pendingClass = "amount-negative";

        return `
            <tr>
                <td>${t.Date}</td>
                <td>
                    <div class="route-tag">
                        <span>${t.From}</span>
                        <span class="route-arrow">➔</span>
                        <span>${t.To}</span>
                    </div>
                </td>
                <td>${t["Customer Name"]}</td>
                <td class="amount-text">₹${formatNumber(t["Freight Amount"])}</td>
                <td class="amount-text ${pendingClass}">₹${formatNumber(t["Pending Amount"])}</td>
                <td>
                    <button class="btn-delete" onclick="confirmDelete('trip', ${t.id})" aria-label="Delete Entry">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderRecentCash(cash) {
    const tbody = document.getElementById("recent-cash-table").querySelector("tbody");
    if (cash.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="placeholder-text">No cash logs recorded.</td></tr>`;
        return;
    }

    tbody.innerHTML = cash.map(c => {
        const diesel = parseFloat(c["Diesel Expense"]) || 0;
        const maint = parseFloat(c["Maintenance Expense"]) || 0;
        const food = parseFloat(c["Food Expense"]) || 0;
        const other = parseFloat(c["Other Expense"]) || 0;
        const totalExp = diesel + maint + food + other;
        
        const advOffline = parseFloat(c["Offline Advance Received"]) || parseFloat(c["Advance Received"]) || 0;
        const advOnline = parseFloat(c["Online Advance Received"]) || 0;
        
        const calcClosing = parseFloat(c["Calculated Closing Cash"]) || parseFloat(c["Closing Cash"]) || 0;
        const actualClosing = parseFloat(c["Actual Closing Cash"]) || parseFloat(c["Closing Cash"]) || 0;
        const diff = parseFloat(c["Cash Difference"]) || 0;
        
        let diffClass = "amount-positive";
        if (diff < 0) diffClass = "amount-negative";
        else if (diff > 0) diffClass = "amount-pending";

        return `
            <tr>
                <td>${c.Date}</td>
                <td>${c["Driver Name"]} <span class="text-muted">(${c["Truck No"]})</span></td>
                <td class="amount-text">₹${formatNumber(c["Opening Cash"])}</td>
                <td class="amount-text text-green">₹${formatNumber(advOffline)}</td>
                <td class="amount-text text-blue">₹${formatNumber(advOnline)}</td>
                <td class="amount-text text-red">₹${formatNumber(totalExp)}</td>
                <td class="amount-text text-green">₹${formatNumber(calcClosing)}</td>
                <td class="amount-text text-green">₹${formatNumber(actualClosing)}</td>
                <td class="amount-text ${diffClass}">₹${formatNumber(diff)}</td>
                <td>
                    <button class="btn-delete" onclick="confirmDelete('cash', ${c.id})" aria-label="Delete Entry">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderCharts(trips, cashSummary) {
    const isDark = !document.body.classList.contains("light-theme");
    const textColor = isDark ? "#9ca3af" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.05)";

    // Chart 1: Trips Freight Amount vs Collections (Line chart, up to latest 7 trips)
    const latestTrips = trips.slice(-7);
    const tripLabels = latestTrips.map((t, idx) => `${t.Date} (${t.From.substring(0, 3)}➔${t.To.substring(0,3)})`);
    const freightDataset = latestTrips.map(t => parseFloat(t["Freight Amount"]) || 0);
    const collectionsDataset = latestTrips.map(t => parseFloat(t["Received Amount"]) || 0);

    if (freightChartInstance) freightChartInstance.destroy();
    
    const freightCtx = document.getElementById("freightChart").getContext("2d");
    freightChartInstance = new Chart(freightCtx, {
        type: 'bar',
        data: {
            labels: tripLabels,
            datasets: [
                {
                    label: 'Freight Billed (₹)',
                    data: freightDataset,
                    backgroundColor: 'rgba(59, 130, 246, 0.65)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Cash Collected (₹)',
                    data: collectionsDataset,
                    backgroundColor: 'rgba(16, 185, 129, 0.65)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor, font: { family: 'Inter' } } }
            },
            scales: {
                x: { ticks: { color: textColor }, grid: { display: false } },
                y: { ticks: { color: textColor }, grid: { color: gridColor } }
            }
        }
    });

    // Chart 2: Driver Expenses pie breakdown
    if (expenseChartInstance) expenseChartInstance.destroy();

    const expenseCtx = document.getElementById("expenseChart").getContext("2d");
    
    // Fallback if no expenses recorded
    const expData = [
        cashSummary.diesel_expense || 0,
        cashSummary.maintenance_expense || 0,
        cashSummary.food_expense || 0,
        cashSummary.other_expense || 0
    ];
    
    const hasExpense = expData.some(val => val > 0);
    
    expenseChartInstance = new Chart(expenseCtx, {
        type: 'doughnut',
        data: {
            labels: ['Diesel', 'Maintenance', 'Food', 'Other'],
            datasets: [{
                data: hasExpense ? expData : [1, 1, 1, 1], // Display equal portions for styling if empty
                backgroundColor: [
                    '#3b82f6', // Diesel - blue
                    '#f59e0b', // Maintenance - amber
                    '#10b981', // Food - emerald
                    '#6b7280'  // Other - grey
                ],
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#111827' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, boxWidth: 12, font: { family: 'Inter', size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (!hasExpense) return `${context.label}: ₹0.00`;
                            return `${context.label}: ₹${formatNumber(context.raw)}`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// --- DIRECTORIES AND LEDGERS LOAD ---

// Load Trip List
async function loadTripsList() {
    try {
        const res = await fetch('/api/trips');
        allTripsData = await res.json();
        filterAndRenderTrips();
    } catch (e) {
        showToast("Error loading trip records.", "error");
    }
}

function filterAndRenderTrips() {
    const searchVal = document.getElementById("search-trips").value.toLowerCase();
    const tbody = document.getElementById("all-trips-table").querySelector("tbody");
    
    const filtered = allTripsData.filter(t => {
        return t.Date.includes(searchVal) ||
               t.From.toLowerCase().includes(searchVal) ||
               t.To.toLowerCase().includes(searchVal) ||
               t["Load Type"].toLowerCase().includes(searchVal) ||
               t["Customer Name"].toLowerCase().includes(searchVal);
    });

    const isOwner = window.currentUser && window.currentUser.role === 'Owner';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isOwner ? 9 : 8}" class="placeholder-text">No matching trips found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => {
        const pending = parseFloat(t["Pending Amount"]) || 0;
        let pendingClass = "amount-positive";
        if (pending > 0) pendingClass = "amount-pending";
        else if (pending < 0) pendingClass = "amount-negative";
        
        return `
            <tr>
                <td>${t.Date}</td>
                <td>${t.From}</td>
                <td>${t.To}</td>
                <td>${t["Load Type"]}</td>
                <td class="amount-text">₹${formatNumber(t["Freight Amount"])}</td>
                <td>${t["Customer Name"]}</td>
                <td class="amount-text">₹${formatNumber(t["Received Amount"])}</td>
                <td class="amount-text ${pendingClass}">₹${formatNumber(t["Pending Amount"])}</td>
                ${isOwner ? `
                <td>
                    <button class="btn-delete" onclick="confirmDelete('trip', ${t.id})" aria-label="Delete Entry">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </td>
                ` : ''}
            </tr>
        `;
    }).join("");
}

// Load Driver Cash List
async function loadCashList() {
    try {
        const res = await fetch('/api/driver-cash');
        allCashData = await res.json();
        filterAndRenderCash();
    } catch (e) {
        showToast("Error loading driver cash records.", "error");
    }
}

function filterAndRenderCash() {
    const searchVal = document.getElementById("search-cash").value.toLowerCase();
    const tbody = document.getElementById("all-cash-table").querySelector("tbody");

    const filtered = allCashData.filter(c => {
        return c.Date.includes(searchVal) ||
               c["Truck No"].toLowerCase().includes(searchVal) ||
               c["Driver Name"].toLowerCase().includes(searchVal) ||
               (c.Remarks && c.Remarks.toLowerCase().includes(searchVal));
    });

    const isOwner = window.currentUser && window.currentUser.role === 'Owner';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isOwner ? 16 : 15}" class="placeholder-text">No matching cash records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(c => {
        const diesel = parseFloat(c["Diesel Expense"]) || 0;
        const maint = parseFloat(c["Maintenance Expense"]) || 0;
        const food = parseFloat(c["Food Expense"]) || 0;
        const other = parseFloat(c["Other Expense"]) || 0;
        const totalExp = diesel + maint + food + other;
        
        const advOffline = parseFloat(c["Offline Advance Received"]) || parseFloat(c["Advance Received"]) || 0;
        const advOnline = parseFloat(c["Online Advance Received"]) || 0;
        
        const calcClosing = parseFloat(c["Calculated Closing Cash"]) || parseFloat(c["Closing Cash"]) || 0;
        const actualClosing = parseFloat(c["Actual Closing Cash"]) || parseFloat(c["Closing Cash"]) || 0;
        const diff = parseFloat(c["Cash Difference"]) || 0;
        
        let diffClass = "amount-positive";
        if (diff < 0) diffClass = "amount-negative";
        else if (diff > 0) diffClass = "amount-pending";

        return `
            <tr>
                <td>${c.Date}</td>
                <td><strong>${c["Truck No"]}</strong></td>
                <td>${c["Driver Name"]}</td>
                <td class="amount-text">₹${formatNumber(c["Opening Cash"])}</td>
                <td class="amount-text text-green">₹${formatNumber(advOffline)}</td>
                <td class="amount-text text-blue">₹${formatNumber(advOnline)}</td>
                <td class="amount-text text-red">₹${formatNumber(c["Diesel Expense"])}</td>
                <td class="amount-text text-red">₹${formatNumber(c["Maintenance Expense"])}</td>
                <td class="amount-text text-red">₹${formatNumber(c["Food Expense"])}</td>
                <td class="amount-text text-red">₹${formatNumber(c["Other Expense"])}</td>
                <td class="amount-text text-red">₹${formatNumber(totalExp)}</td>
                <td class="amount-text amount-positive">₹${formatNumber(calcClosing)}</td>
                <td class="amount-text amount-positive">₹${formatNumber(actualClosing)}</td>
                <td class="amount-text ${diffClass}">₹${formatNumber(diff)}</td>
                <td><span class="text-muted">${c.Remarks || '-'}</span></td>
                ${isOwner ? `
                <td>
                    <button class="btn-delete" onclick="confirmDelete('cash', ${c.id})" aria-label="Delete Entry">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </td>
                ` : ''}
            </tr>
        `;
    }).join("");
}

// Load Driver Advances
async function loadDriverAdvances() {
    try {
        const res = await fetch('/api/reports/advances');
        const list = await res.json();
        const tbody = document.getElementById("driver-advances-table").querySelector("tbody");

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="placeholder-text">No advance allocations recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(item => `
            <tr>
                <td><strong>${item.driver_name}</strong></td>
                <td class="amount-text text-green">₹${formatNumber(item.total_advance_offline)}</td>
                <td class="amount-text text-blue">₹${formatNumber(item.total_advance_online)}</td>
                <td class="amount-text text-green">₹${formatNumber(item.total_advance)}</td>
                <td>${item.entries_count} times</td>
                <td>${item.last_date}</td>
            </tr>
        `).join("");
    } catch (e) {
        showToast("Error loading driver advances.", "error");
    }
}

// Load Expense Ledger
async function loadExpenseLedger() {
    try {
        const res = await fetch('/api/reports/expenses');
        allExpensesData = await res.json();
        filterAndRenderExpenses();
    } catch (e) {
        showToast("Error loading expenses ledger.", "error");
    }
}

function filterAndRenderExpenses() {
    const searchVal = document.getElementById("search-expenses").value.toLowerCase();
    const typeVal = document.getElementById("filter-expense-type").value;
    const tbody = document.getElementById("expense-ledger-table").querySelector("tbody");

    const filtered = allExpensesData.filter(item => {
        const matchesSearch = item.driver_name.toLowerCase().includes(searchVal) ||
                              item.truck_no.toLowerCase().includes(searchVal) ||
                              (item.remarks && item.remarks.toLowerCase().includes(searchVal));
        const matchesType = typeVal === "ALL" || item.expense_type === typeVal;
        return matchesSearch && matchesType;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="placeholder-text">No matching expenses found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => `
        <tr>
            <td>${item.date}</td>
            <td>${item.truck_no}</td>
            <td>${item.driver_name}</td>
            <td><span class="expense-tag tag-${item.expense_type.toLowerCase()}">${item.expense_type}</span></td>
            <td class="amount-text text-red">₹${formatNumber(item.amount)}</td>
            <td><span class="text-muted">${item.remarks || '-'}</span></td>
        </tr>
    `).join("");
}

// Load Cash Flow Report
async function loadCashReport() {
    try {
        const res = await fetch('/api/reports/cash-report');
        const list = await res.json();
        const tbody = document.getElementById("cash-report-table").querySelector("tbody");

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="placeholder-text">No running cash flows logged.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(c => {
            const diff = parseFloat(c.cash_difference) || 0;
            let diffClass = "amount-positive";
            if (diff < 0) diffClass = "amount-negative";
            else if (diff > 0) diffClass = "amount-pending";

            return `
                <tr>
                    <td>${c.date}</td>
                    <td><strong>${c.truck_no}</strong></td>
                    <td>${c.driver_name}</td>
                    <td class="amount-text">₹${formatNumber(c.opening)}</td>
                    <td class="amount-text text-green">+ ₹${formatNumber(c.advance_offline)}</td>
                    <td class="amount-text text-blue">+ ₹${formatNumber(c.advance_online)}</td>
                    <td class="amount-text text-red">- ₹${formatNumber(c.expenses)}</td>
                    <td class="amount-text amount-positive">₹${formatNumber(c.calculated_closing)}</td>
                    <td class="amount-text amount-positive">₹${formatNumber(c.actual_closing)}</td>
                    <td class="amount-text ${diffClass}">₹${formatNumber(c.cash_difference)}</td>
                    <td><span class="text-muted">${c.remarks || '-'}</span></td>
                </tr>
            `;
        }).join("");
    } catch (e) {
        showToast("Error loading cash flow report.", "error");
    }
}

// --- FILTER & SEARCH EVENT WATCHERS ---
function setupFiltersAndSearches() {
    // Trips search
    document.getElementById("search-trips").addEventListener("input", filterAndRenderTrips);
    
    // Cash search
    document.getElementById("search-cash").addEventListener("input", filterAndRenderCash);

    // Expense filters
    document.getElementById("search-expenses").addEventListener("input", filterAndRenderExpenses);
    document.getElementById("filter-expense-type").addEventListener("change", filterAndRenderExpenses);
}

// --- FORM SUBMISSIONS ---
function setupFormSubmissions() {
    // Trip Form
    const tripForm = document.getElementById("trip-details-form");
    tripForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!validateForm(tripForm)) return;

        const submitBtn = document.getElementById("btn-save-trip");
        const spinner = document.getElementById("spinner-trip");
        
        setLoading(submitBtn, spinner, true);

        const formData = new FormData(tripForm);
        const payload = {
            date: formatDateForCSV(formData.get("date")),
            customer_name: formData.get("customer_name"),
            from_city: formData.get("from_city"),
            to_city: formData.get("to_city"),
            load_type: formData.get("load_type"),
            freight_amount: formData.get("freight_amount"),
            received_amount: formData.get("received_amount")
        };

        try {
            const res = await fetch('/api/trips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.success) {
                showToast("Trip entry saved successfully!", "success");
                resetForm("trip-details-form");
                // Navigate back to Dashboard or stay (let's stay, but update stats)
            } else {
                showToast(result.error || "Failed to save trip.", "error");
            }
        } catch (error) {
            showToast("Network error. Could not connect to server.", "error");
        } finally {
            setLoading(submitBtn, spinner, false);
        }
    });

    // Driver Cash Form
    const cashForm = document.getElementById("driver-cash-form");
    cashForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!validateForm(cashForm)) return;

        const submitBtn = document.getElementById("btn-save-cash");
        const spinner = document.getElementById("spinner-cash");

        setLoading(submitBtn, spinner, true);

        const formData = new FormData(cashForm);
        const payload = {
            date: formatDateForCSV(formData.get("date")),
            truck_no: formData.get("truck_no"),
            driver_name: formData.get("driver_name"),
            opening_cash: formData.get("opening_cash"),
            advance_received_offline: formData.get("advance_received_offline"),
            advance_received_online: formData.get("advance_received_online"),
            diesel_expense: formData.get("diesel_expense") || 0,
            maintenance_expense: formData.get("maintenance_expense") || 0,
            food_expense: formData.get("food_expense") || 0,
            other_expense: formData.get("other_expense") || 0,
            actual_closing_cash: formData.get("actual_closing_cash"),
            remarks: formData.get("remarks")
        };

        try {
            const res = await fetch('/api/driver-cash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.success) {
                showToast("Cash record saved successfully!", "success");
                resetForm("driver-cash-form");
            } else {
                showToast(result.error || "Failed to save cash record.", "error");
            }
        } catch (error) {
            showToast("Network error. Could not connect to server.", "error");
        } finally {
            setLoading(submitBtn, spinner, false);
        }
    });
}

// --- FORM UTILITIES ---
function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll("input[required], select[required]");
    
    inputs.forEach(input => {
        const formGroup = input.closest(".form-group");
        if (!input.value.trim()) {
            formGroup.classList.add("has-error");
            isValid = false;
        } else {
            formGroup.classList.remove("has-error");
        }
        
        // Remove error on input keyup
        input.addEventListener("input", () => {
            if (input.value.trim()) {
                formGroup.classList.remove("has-error");
            }
        });
    });

    return isValid;
}

function setLoading(button, spinner, isLoading) {
    if (isLoading) {
        button.disabled = true;
        spinner.style.display = "inline-block";
    } else {
        button.disabled = false;
        spinner.style.display = "none";
    }
}

function resetForm(formId) {
    const form = document.getElementById(formId);
    form.reset();
    
    // Clear error classes
    form.querySelectorAll(".form-group").forEach(g => g.classList.remove("has-error"));

    // Reset dates to today
    const today = new Date().toISOString().split('T')[0];
    if (formId === "trip-details-form") {
        document.getElementById("trip-date").value = today;
        document.getElementById("trip-pending").value = "";
    } else if (formId === "driver-cash-form") {
        document.getElementById("cash-date").value = today;
        document.getElementById("cash-total-expense").value = "";
        document.getElementById("cash-closing").value = "";
        document.getElementById("cash-difference").value = "";
        const cashDiffEl = document.getElementById("cash-difference");
        if (cashDiffEl) {
            cashDiffEl.classList.remove("amount-positive", "amount-negative", "amount-pending");
        }
    }
}

// Format date from YYYY-MM-DD to DD-MM-YYYY
function formatDateForCSV(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

// Format number with thousands separator and 2 decimal places
function formatNumber(num) {
    const val = parseFloat(num);
    if (isNaN(val)) return "0.00";
    return val.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// --- TOAST SYSTEMS ---
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    const icon = type === "success" ? "✓" : (type === "error" ? "✕" : "ℹ");
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add("show");
    }, 10);
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// --- WELCOME PORTAL DATA & ANIMATION ---
async function loadWelcomeData() {
    if (window.currentUser && window.currentUser.role !== "Owner") {
        return; // Skip fetching Owner-only telemetry stats for Staff users
    }
    try {
        const res = await fetch('/api/reports/summary');
        if (!res.ok) return;
        const summary = await res.json();
        
        const freightEl = document.getElementById("welcome-freight");
        const receivedEl = document.getElementById("welcome-received");
        const pendingEl = document.getElementById("welcome-pending");
        
        if (freightEl) freightEl.innerText = `₹${formatNumber(summary.trips.total_freight)}`;
        if (receivedEl) receivedEl.innerText = `₹${formatNumber(summary.trips.total_received)}`;
        if (pendingEl) pendingEl.innerText = `₹${formatNumber(summary.trips.total_pending)}`;
    } catch (e) {
        console.error("Error loading welcome page stats:", e);
    }
}

function initScrollContainerAnimation() {
    const container = document.querySelector('.scroll-container');
    if (!container) return;

    // Feature detect CSS Scroll-Driven Animations
    if (CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
        const header = container.querySelector('.scroll-header');
        const card = container.querySelector('.scroll-card');
        if (header) header.style.transform = '';
        if (card) card.style.transform = '';
        return; // Let native CSS handle it for maximum performance
    }

    const header = container.querySelector('.scroll-header');
    const card = container.querySelector('.scroll-card');
    
    const onScroll = () => {
        const rect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // If welcome view is display: none, width and height will be 0. Skip computations.
        if (rect.width === 0 || rect.height === 0) return;
        // Check if the scroll container is in the viewport
        if (rect.bottom < 0 || rect.top > viewportHeight) return;

        // Calculate progress from when top enters bottom of viewport to when bottom leaves top of viewport
        const totalHeight = rect.height + viewportHeight;
        const currentProgress = (viewportHeight - rect.top) / totalHeight;
        
        // Clamp progress between 0 and 1
        const progress = Math.max(0, Math.min(1, currentProgress));
        
        // Map progress range (0.15 to 0.65) to [0, 1] range for visual transition
        const start = 0.15;
        const end = 0.65;
        let mappedProgress = 0;
        if (progress > start) {
            mappedProgress = (progress - start) / (end - start);
            mappedProgress = Math.max(0, Math.min(1, mappedProgress));
        }

        const isMobile = window.innerWidth <= 768;
        
        // Rotate: 20deg -> 0deg
        const rotateVal = 20 - (mappedProgress * 20);
        
        // Scale: 1.05 -> 1.0 (desktop) or 0.75 -> 0.9 (mobile)
        let scaleVal;
        if (isMobile) {
            scaleVal = 0.75 + (mappedProgress * 0.15);
        } else {
            scaleVal = 1.05 - (mappedProgress * 0.05);
        }
        
        // Translate Y: 0 -> -100
        const translateYVal = -mappedProgress * 100;
        
        if (card) card.style.transform = `rotateX(${rotateVal}deg) scale(${scaleVal})`;
        if (header) header.style.transform = `translateY(${translateYVal}px)`;
    };
    
    // Add scroll event listener
    window.addEventListener('scroll', onScroll, { passive: true });
    // Run initially
    onScroll();
}

// --- DELETION SYSTEM ---
function setupDeleteConfirmation() {
    const dialog = document.getElementById("delete-confirm-dialog");
    const cancelBtn = document.getElementById("btn-cancel-delete");
    const confirmBtn = document.getElementById("btn-confirm-delete");
    
    if (!dialog || !cancelBtn || !confirmBtn) return;
    
    // Cancel action
    cancelBtn.addEventListener("click", () => {
        dialog.close();
    });
    
    // Confirm action
    confirmBtn.addEventListener("click", async () => {
        dialog.close();
        
        const { type, id } = deleteTarget;
        if (!type || id === null) return;
        
        const url = type === 'trip' ? `/api/trips/${id}` : `/api/driver-cash/${id}`;
        
        try {
            const res = await fetch(url, {
                method: 'DELETE'
            });
            const result = await res.json();
            
            if (result.success) {
                showToast(result.message || "Entry deleted successfully!", "success");
                
                // Re-fetch and re-render data depending on the current active tab
                const activeTabItem = document.querySelector(".nav-item.active");
                const currentTab = activeTabItem ? activeTabItem.getAttribute("data-tab") : "welcome";
                
                if (currentTab === "dashboard") {
                    await loadDashboardData();
                } else if (currentTab === "trip-list") {
                    await loadTripsList();
                } else if (currentTab === "cash-list") {
                    await loadCashList();
                } else {
                    // Fallback: refresh whatever we deleted
                    if (type === 'trip') {
                        await loadTripsList();
                    } else {
                        await loadCashList();
                    }
                }
            } else {
                showToast(result.error || "Failed to delete entry.", "error");
            }
        } catch (e) {
            console.error("Deletion error:", e);
            showToast("Network error. Could not connect to server.", "error");
        }
    });

    // Fallback for light-dismiss (clicking the backdrop outside the modal)
    if (!('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
            if (event.target !== dialog) return;

            const rect = dialog.getBoundingClientRect();
            const isDialogContent = (
                rect.top <= event.clientY &&
                event.clientY <= rect.top + rect.height &&
                rect.left <= event.clientX &&
                event.clientX <= rect.left + rect.width
            );

            if (!isDialogContent) {
                dialog.close();
            }
        });
    }
}

// Expose confirmDelete globally so the inline onclick triggers work
window.confirmDelete = function(type, id) {
    deleteTarget.type = type;
    deleteTarget.id = id;
    
    const dialog = document.getElementById("delete-confirm-dialog");
    const msgEl = document.getElementById("delete-confirm-message");
    
    if (!dialog || !msgEl) return;
    
    if (type === 'trip') {
        msgEl.innerText = "Are you sure you want to delete this trip detail entry? This action cannot be undone.";
    } else if (type === 'cash') {
        msgEl.innerText = "Are you sure you want to delete this driver cash record? This action cannot be undone.";
    }
    
    dialog.showModal();
};
