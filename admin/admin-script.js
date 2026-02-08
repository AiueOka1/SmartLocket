// SmartLocket Admin Panel JavaScript
// Connects to backend API

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://api-vcdrn5osga-uc.a.run.app';

// Login credentials (in production, this should be handled by backend)
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'mariousso1'
};

// ==========================================
// AUTHENTICATION
// ==========================================

function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    const loginSection = document.getElementById('loginSection');
    const adminPanel = document.getElementById('adminPanel');
    
    if (isLoggedIn) {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        loadDashboardStats(); // Load initial data
    } else {
        loginSection.style.display = 'flex';
        adminPanel.style.display = 'none';
    }
}

function login(username, password) {
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        checkAuth();
        return true;
    }
    return false;
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('adminLoggedIn');
        checkAuth();
    }
}

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('loginError');
            
            if (login(username, password)) {
                errorDiv.style.display = 'none';
            } else {
                errorDiv.textContent = 'Invalid username or password';
                errorDiv.style.display = 'block';
                // Clear password field
                document.getElementById('password').value = '';
            }
        });
    }
    
    // Check auth on page load
    checkAuth();
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        // Show success feedback
        const originalText = button.innerHTML;
        button.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2"/></svg> Copied';
        button.style.background = '#10b981';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.background = '#3b82f6';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy to clipboard');
    });
}

// ==========================================
// NAVIGATION
// ==========================================

function navigateTo(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all menu items
    document.querySelectorAll('.admin-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Add active class to corresponding menu item
    const targetLink = document.querySelector(`.admin-menu a[href="#${sectionId}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
    }
    
    // Load section-specific data
    if (sectionId === 'dashboard') {
        loadDashboardStats();
    } else if (sectionId === 'inventory') {
        loadInventory();
    } else if (sectionId === 'nfc-writing') {
        loadNFCStats();
    }
}

// Handle menu clicks
document.querySelectorAll('.admin-menu a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = link.getAttribute('href').substring(1);
        navigateTo(sectionId);
    });
});

// ==========================================
// DASHBOARD
// ==========================================

async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/stats`);
        const stats = await response.json();
        
        document.getElementById('totalChains').textContent = stats.total || 0;
        document.getElementById('unusedChains').textContent = stats.unused || 0;
        document.getElementById('writtenChains').textContent = stats.written || 0;
        document.getElementById('activatedChains').textContent = stats.activated || 0;
        document.getElementById('premiumChains').textContent = stats.premium || 0;
        
        console.log('Dashboard stats loaded:', stats);
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        alert('Failed to load dashboard statistics. Make sure the backend is running.');
    }
}

// ==========================================
// BATCH GENERATION
// ==========================================

// Handle custom batch size toggle
document.getElementById('batchSize').addEventListener('change', function() {
    const customInput = document.getElementById('customBatchSize');
    if (this.value === 'custom') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
    }
});

// Handle batch generation form
document.getElementById('generateForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const batchSize = document.getElementById('batchSize').value;
    const quantity = batchSize === 'custom' 
        ? parseInt(document.getElementById('customBatchSize').value)
        : parseInt(batchSize);
    
    const photoLimit = parseInt(document.getElementById('photoLimit').value);
    const prefix = document.getElementById('batchPrefix').value.trim().toUpperCase();
    const premium = document.getElementById('isPremium').checked;
    
    // Validate
    if (!quantity || quantity < 1) {
        alert('Please enter a valid quantity');
        return;
    }
    
    // Show loading state
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4"/></svg> Generating...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/generate-batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                quantity,
                photoLimit,
                prefix: prefix || '',
                premium
            })
        });
        
        // Check if response is ok first
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP Error:', response.status, response.statusText);
            console.error('Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}. Check if the API endpoint exists.`);
        }
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Hide form, show result
            document.getElementById('generateForm').style.display = 'none';
            document.getElementById('generateResult').style.display = 'block';
            
            // Update result stats
            document.getElementById('generatedCount').textContent = result.count;
            document.getElementById('generatedPhotoLimit').textContent = photoLimit;
            document.getElementById('generatedPremium').textContent = premium ? 'Yes' : 'No';
            
            // Store batch data for CSV download
            window.lastGeneratedBatch = result.batch;
            
            // Update dashboard stats
            loadDashboardStats();
            
            console.log('Batch generated:', result);
        } else {
            alert(`Failed to generate batch: ${result.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Batch generation error:', error);
        
        // Better error messages for different scenarios
        if (error.message.includes('404')) {
            alert('API endpoint not found. The generate-batch route may not be deployed on the live server.');
        } else if (error.message.includes('CORS')) {
            alert('CORS error. The live server may not allow requests from this domain.');
        } else if (error.message.includes('Failed to fetch')) {
            alert('Network error. Check if the API server is running and accessible.');
        } else {
            alert(`Failed to generate batch: ${error.message}`);
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// Download CSV
function downloadCSV() {
    if (!window.lastGeneratedBatch) {
        alert('No batch data available');
        return;
    }
    
    // Create CSV content
    let csv = 'Memory ID,View URL,Photo Limit,Premium\n';
    window.lastGeneratedBatch.forEach(item => {
        csv += `${item.memoryId},${item.viewUrl},${item.photoLimit},${item.premium ? 'Yes' : 'No'}\n`;
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartlocket-batch-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function viewBatchDetails() {
    // Reset form and navigate to inventory
    document.getElementById('generateForm').reset();
    document.getElementById('generateForm').style.display = 'block';
    document.getElementById('generateResult').style.display = 'none';
    navigateTo('inventory');
}

// ==========================================
// INVENTORY
// ==========================================

async function loadInventory() {
    try {
        const status = document.getElementById('filterStatus')?.value || 'all';
        const premium = document.getElementById('filterPremium')?.value || 'all';
        
        let url = `${API_BASE_URL}/admin/inventory?page=1&limit=50`;
        if (status !== 'all') url += `&status=${status}`;
        if (premium !== 'all') url += `&premium=${premium}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '';
        
        // Backend returns data.data, not data.inventory
        const inventory = result.data || [];
        
        if (inventory.length > 0) {
            inventory.forEach(item => {
                const row = document.createElement('tr');
                // Use the viewUrl from Firebase data instead of constructing it
                const viewUrl = item.viewUrl || `https://smartlocket.win/public/gallery?id=${item.memoryId}`;
                row.innerHTML = `
                    <td><strong>${item.memoryId}</strong></td>
                    <td><span class="status-badge ${item.status}">${item.status}</span></td>
                    <td><span class="type-badge ${item.premium ? 'premium' : 'standard'}">${item.premium ? 'Premium' : 'Standard'}</span></td>
                    <td>${item.photoLimit}</td>
                    <td>${item.orderId || '-'}</td>
                    <td>${item.email || '-'}</td>
                    <td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</td>
                    <td>${item.activatedAt ? new Date(item.activatedAt).toLocaleDateString() : '-'}</td>
                    <td>
                        <button class="btn-copy" onclick="copyToClipboard('${viewUrl}', this)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            Copy
                        </button>
                    </td>
                    <td>
                        <button class="btn-action" onclick="viewDetails('${item.memoryId}')">View</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">No SmartLockets found</td></tr>';
        }
        
        console.log('Inventory loaded:', inventory.length, 'items');
    } catch (error) {
        console.error('Failed to load inventory:', error);
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: red;">Failed to load inventory. Make sure the backend is running.</td></tr>';
    }
}

// Filter handlers
document.getElementById('filterStatus')?.addEventListener('change', loadInventory);
document.getElementById('filterPremium')?.addEventListener('change', loadInventory);
document.getElementById('searchMemoryId')?.addEventListener('input', function() {
    // Simple client-side search
    const searchTerm = this.value.toLowerCase();
    const rows = document.querySelectorAll('#inventoryTableBody tr');
    rows.forEach(row => {
        const memoryId = row.querySelector('td')?.textContent.toLowerCase();
        if (memoryId && memoryId.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});

function viewDetails(memoryId) {
    alert(`Viewing details for: ${memoryId}\n\nFull details view coming soon!`);
}

function exportInventory() {
    alert('Export functionality coming soon!');
}

// ==========================================
// NFC WRITING
// ==========================================

let currentSmartLocket = null;

async function loadNextUnused() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/next-unused`);
        
        if (response.status === 404) {
            alert('No unused SmartLockets available. Please generate a new batch first.');
            return;
        }
        
        const result = await response.json();
        
        if (!result.success) {
            alert(`Failed: ${result.message}`);
            return;
        }
        
        currentSmartLocket = result.data;
        
        // Update display
        document.getElementById('currentMemoryId').textContent = result.data.memoryId;
        document.getElementById('currentUrl').textContent = result.data.viewUrl;
        document.getElementById('nfcPhotoLimit').textContent = result.data.photoLimit;
        document.getElementById('nfcPremium').textContent = result.data.premium ? 'Yes' : 'No';
        document.getElementById('nfcCreated').textContent = result.data.createdAt ? new Date(result.data.createdAt).toLocaleDateString() : 'N/A';
        
        // Enable mark as written button
        document.getElementById('markWrittenBtn').disabled = false;
        
        console.log('Loaded SmartLocket:', result.data);
    } catch (error) {
        console.error('Failed to load next unused:', error);
        alert('Failed to load next SmartLocket');
    }
}

async function markAsWritten() {
    if (!currentSmartLocket) {
        alert('No SmartLocket loaded');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/mark-written/${currentSmartLocket.memoryId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert(`${currentSmartLocket.memoryId} marked as written`);
            
            // Load next unused automatically
            await loadNextUnused();
            
            // Update stats
            loadNFCStats();
            loadDashboardStats();
        } else {
            alert(`Failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Mark as written error:', error);
        alert('Failed to mark as written');
    }
}

async function loadNFCStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/stats`);
        const stats = await response.json();
        
        // For now, show total written (would need daily tracking in production)
        document.getElementById('writtenToday').textContent = stats.written || 0;
        document.getElementById('remainingUnused').textContent = stats.unused || 0;
    } catch (error) {
        console.error('Failed to load NFC stats:', error);
        // Set default values if API fails
        document.getElementById('writtenToday').textContent = '0';
        document.getElementById('remainingUnused').textContent = '0';
    }
}

function copyCurrentSmartLocketUrl() {
    if (!currentSmartLocket || !currentSmartLocket.viewUrl) {
        alert('No URL to copy - please load a SmartLocket first');
        return;
    }
    
    navigator.clipboard.writeText(currentSmartLocket.viewUrl).then(() => {
        alert('URL copied to clipboard!');
        
        // Visual feedback on button
        const button = event.target.closest('button');
        const originalText = button.innerHTML;
        button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2"/>
        </svg> Copied!`;
        button.style.backgroundColor = '#22c55e';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.backgroundColor = '';
        }, 2000);
        
    }).catch(err => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = currentSmartLocket.viewUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('URL copied to clipboard!');
        console.error('Copy error:', err);
    });
}

// ==========================================
// ORDER ASSIGNMENT
// ==========================================

document.getElementById('orderAssignmentForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const memoryId = document.getElementById('orderMemoryId').value.trim().toUpperCase();
    const orderId = document.getElementById('orderId').value.trim();
    const customerName = document.getElementById('customerName').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/assign-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                memoryId,
                orderId,
                customerName: customerName || null,
                customerEmail: customerEmail || null
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert(`Order assigned successfully\n\nMemory ID: ${memoryId}\nOrder ID: ${orderId}`);
            this.reset();
            loadDashboardStats();
        } else {
            alert(`Failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Order assignment error:', error);
        alert('Failed to assign order');
    }
});

function resetOrderForm() {
    document.getElementById('orderAssignmentForm').reset();
}

function selectFromInventory() {
    alert('Inventory selection dialog coming soon!');
}

// ==========================================
// INITIALIZATION
// ==========================================

// Initialize admin panel on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('SmartLocket Admin Panel loaded');
    console.log('API Base URL:', API_BASE_URL);
    addTestButton(); // Add API test button for live environment
});

// ==========================================
// API TESTING FUNCTIONS
// ==========================================

async function testAPIConnection() {
    console.log('Testing API connection...');
    console.log('API Base URL:', API_BASE_URL);
    
    try {
        // Test health endpoint
        const healthResponse = await fetch(`${API_BASE_URL}/health`);
        console.log('Health check status:', healthResponse.status);
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('Health check response:', healthData);
        } else {
            console.error('Health check failed:', healthResponse.statusText);
        }
        
        // Test admin stats endpoint
        const statsResponse = await fetch(`${API_BASE_URL}/api/admin/stats`);
        console.log('Stats endpoint status:', statsResponse.status);
        
        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            console.log('Stats endpoint response:', statsData);
        } else {
            console.error('Stats endpoint failed:', statsResponse.statusText);
            const errorText = await statsResponse.text();
            console.error('Error response:', errorText);
        }
        
    } catch (error) {
        console.error('API connection test failed:', error);
    }
}

// Add test button functionality
function addTestButton() {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const testBtn = document.createElement('button');
        testBtn.textContent = 'Test API Connection';
        testBtn.className = 'btn-secondary';
        testBtn.onclick = testAPIConnection;
        testBtn.style.position = 'fixed';
        testBtn.style.bottom = '20px';
        testBtn.style.right = '20px';
        testBtn.style.zIndex = '1000';
        document.body.appendChild(testBtn);
    }
}
