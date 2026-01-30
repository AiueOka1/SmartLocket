// SmartLocket Admin Panel JavaScript
// Connects to backend API running on localhost:3000

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://api-vcdrn5osga-uc.a.run.app/api';

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
        const response = await fetch(`${API_BASE_URL}/api/admin/stats`);
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
        alert('Failed to generate batch. Make sure the backend is running on localhost:3000');
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
        
        let url = `${API_BASE_URL}/api/admin/inventory?page=1&limit=50`;
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
                        <button class="btn-action" onclick="viewDetails('${item.memoryId}')">View</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;">No SmartLockets found</td></tr>';
        }
        
        console.log('Inventory loaded:', inventory.length, 'items');
    } catch (error) {
        console.error('Failed to load inventory:', error);
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: red;">Failed to load inventory. Make sure the backend is running.</td></tr>';
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
            alert(`\u2713 ${currentSmartLocket.memoryId} marked as written!`);
            
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
    }
}

function copyToClipboard() {
    if (!currentSmartLocket) {
        alert('No URL to copy');
        return;
    }
    
    navigator.clipboard.writeText(currentSmartLocket.viewUrl).then(() => {
        alert('✓ URL copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy URL');
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
        const response = await fetch(`${API_BASE_URL}/api/admin/assign-order`, {
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
            alert(`✓ Order assigned successfully!\n\nMemory ID: ${memoryId}\nOrder ID: ${orderId}`);
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
// LOGOUT
// ==========================================

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'index.html';
    }
}

// ==========================================
// INITIALIZATION
// ==========================================

// Load dashboard on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('SmartLocket Admin Panel loaded');
    console.log('API Base URL:', API_BASE_URL);
    loadDashboardStats();
});
