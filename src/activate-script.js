// SmartLocket Activation Script
// Minimal script for activation page only

console.log('🚀 Activation script loaded');

// Get Memory ID from URL
function getMemoryIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const memoryIdFromQuery = urlParams.get('id');
    
    if (memoryIdFromQuery && memoryIdFromQuery !== 'activate.html') {
        return memoryIdFromQuery;
    }
    
    const pathParts = window.location.pathname.split('/');
    const memoryIdFromPath = pathParts[pathParts.length - 1];
    
    return memoryIdFromPath && 
           !memoryIdFromPath.includes('.html') && 
           memoryIdFromPath !== '' 
        ? memoryIdFromPath 
        : memoryIdFromQuery;
}

// Show/hide sections
function showSection(sectionId) {
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

// Show/hide error messages
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

function hideMessages() {
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}

// Update step indicator
function updateStepIndicator(currentStep) {
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < currentStep) {
            step.classList.add('completed');
        } else if (index + 1 === currentStep) {
            step.classList.add('active');
        }
    });
}
