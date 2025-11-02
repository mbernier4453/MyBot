// Password reset page logic
import { supabase } from './supabase-client.js';

// Password visibility toggle
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const button = input.parentElement.querySelector('.toggle-password');
  const eyeIcon = button.querySelector('.eye-icon');
  const eyeOffIcon = button.querySelector('.eye-off-icon');
  
  if (input.type === 'password') {
    input.type = 'text';
    eyeIcon.style.display = 'none';
    eyeOffIcon.style.display = 'block';
  } else {
    input.type = 'password';
    eyeIcon.style.display = 'block';
    eyeOffIcon.style.display = 'none';
  }
}

// Handle password reset submission
async function handleResetPassword(event) {
  event.preventDefault();
  
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  
  // Clear any existing error messages
  const existingError = event.target.querySelector('.error-message');
  if (existingError) existingError.remove();
  
  // Validate passwords match
  if (newPassword !== confirmPassword) {
    const errorDiv = createErrorDiv('Passwords do not match');
    submitButton.before(errorDiv);
    return;
  }
  
  // Validate password length
  if (newPassword.length < 8) {
    const errorDiv = createErrorDiv('Password must be at least 8 characters');
    submitButton.before(errorDiv);
    return;
  }
  
  try {
    submitButton.textContent = 'Resetting...';
    submitButton.disabled = true;
    
    // Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    
    // Show success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = 'background: #00aa5522; border: 1px solid #00aa55; padding: 12px; border-radius: 6px; margin-bottom: 16px; color: #00cc66; text-align: center;';
    successDiv.textContent = 'Password reset successful! Redirecting to app...';
    submitButton.before(successDiv);
    
    // Redirect to app after 2 seconds
    setTimeout(() => {
      window.location.href = '/app';
    }, 2000);
    
  } catch (error) {
    console.error('Password reset error:', error);
    const errorDiv = createErrorDiv(error.message || 'Failed to reset password. Please try again.');
    submitButton.before(errorDiv);
    
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
}

// Helper to create error message div
function createErrorDiv(message) {
  const div = document.createElement('div');
  div.className = 'error-message';
  div.style.cssText = 'background: #aa000022; border: 1px solid #aa0000; padding: 12px; border-radius: 6px; margin-bottom: 16px; color: #ff6666; text-align: center;';
  div.textContent = message;
  return div;
}

// Check if user has valid reset token
async function checkResetToken() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    // If no session from the reset link, redirect to home
    if (!session) {
      console.log('No valid reset token, redirecting...');
      window.location.href = '/';
      return;
    }
    
    console.log('Valid reset token found');
  } catch (error) {
    console.error('Reset token check error:', error);
    window.location.href = '/';
  }
}

// Expose functions globally
window.togglePassword = togglePassword;
window.handleResetPassword = handleResetPassword;

// Check for valid reset token on page load
checkResetToken();
