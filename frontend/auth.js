import { signIn, signUp } from './supabase-client.js';

// Form switching
function showSignIn() {
  document.getElementById('signInForm').classList.add('active');
  document.getElementById('signUpForm').classList.remove('active');
}

function showSignUp() {
  document.getElementById('signInForm').classList.remove('active');
  document.getElementById('signUpForm').classList.add('active');
}

// Sign In Handler
async function handleSignIn(event) {
  event.preventDefault();
  
  const email = document.getElementById('signin-email').value;
  const password = document.getElementById('signin-password').value;
  const rememberMe = document.getElementById('remember-me').checked;
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById('signin-error') || createErrorDiv('signin-error', event.target);
  
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    errorDiv.style.display = 'none';
    
    const { session, user } = await signIn(email, password);
    
    console.log('Sign in successful:', user.email);
    
    // Store remember me preference
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
    }
    
    // Redirect to main app
    window.location.href = '/app';
  } catch (error) {
    console.error('Sign in error:', error);
    errorDiv.textContent = error.message || 'Invalid email or password';
    errorDiv.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
}

// Sign Up Handler
async function handleSignUp(event) {
  event.preventDefault();
  
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm').value;
  const terms = document.getElementById('terms').checked;
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById('signup-error') || createErrorDiv('signup-error', event.target);
  
  // Validate passwords match
  if (password !== confirmPassword) {
    errorDiv.textContent = 'Passwords do not match!';
    errorDiv.style.display = 'block';
    return;
  }
  
  // Validate terms accepted
  if (!terms) {
    errorDiv.textContent = 'Please accept the Terms of Service and Privacy Policy';
    errorDiv.style.display = 'block';
    return;
  }
  
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    errorDiv.style.display = 'none';
    
    const { session, user } = await signUp(email, password, {
      full_name: name
    });
    
    console.log('Sign up successful:', user);
    
    // Show success message with clear instructions
    errorDiv.innerHTML = `
      <strong>Account created!</strong><br>
      Check your email (${email}) for a confirmation link.<br>
      Click the link to verify your account and sign in.
    `;
    errorDiv.style.color = '#4ecdc4';
    errorDiv.style.display = 'block';
    
    // Clear form
    event.target.reset();
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign Up';
  } catch (error) {
    console.error('Sign up error:', error);
    
    // More helpful error messages
    let errorMessage = error.message || 'Failed to create account';
    
    // Handle common errors
    if (errorMessage.includes('already registered')) {
      errorMessage = 'This email is already registered. Try signing in instead.';
    } else if (errorMessage.includes('Password')) {
      errorMessage = 'Password must be at least 6 characters.';
    } else if (errorMessage.includes('rate limit')) {
      errorMessage = 'Too many attempts. Please wait a moment and try again.';
    }
    
    errorDiv.textContent = errorMessage;
    errorDiv.style.color = '#ff6b6b';
    errorDiv.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign Up';
  }
}

// Helper to create error div
function createErrorDiv(id, form) {
  const errorDiv = document.createElement('div');
  errorDiv.id = id;
  errorDiv.style.cssText = 'color: #ff6b6b; font-size: 14px; margin-top: 10px; display: none; text-align: center;';
  form.appendChild(errorDiv);
  return errorDiv;
}

// Check if user is already logged in and handle email confirmation
async function checkAuth() {
  try {
    const { getSession, supabase } = await import('./supabase-client.js');
    
    // Check for email confirmation in URL (Supabase redirects here after email click)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'signup') {
      // User clicked email confirmation link
      console.log('Email confirmed! Redirecting to app...');
      window.location.href = '/app';
      return;
    }
    
    const session = await getSession();
    if (session) {
      window.location.href = '/app';
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }
}

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

// Terms and Conditions modal
function showTerms(event) {
  event.preventDefault();
  const modal = document.getElementById('termsModal');
  modal.classList.add('active');
}

function closeTerms() {
  const modal = document.getElementById('termsModal');
  modal.classList.remove('active');
}

// Forgot Password modal
function showForgotPassword(event) {
  event.preventDefault();
  const modal = document.getElementById('forgotPasswordModal');
  modal.classList.add('active');
}

function closeForgotPassword() {
  const modal = document.getElementById('forgotPasswordModal');
  modal.classList.remove('active');
}

// Handle forgot password submission
async function handleForgotPassword(event) {
  event.preventDefault();
  
  const email = document.getElementById('reset-email').value;
  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  
  try {
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    
    const { supabase } = await import('./supabase-client.js');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://138.197.6.220/reset-password'
    });
    
    if (error) throw error;
    
    // Show success message
    const formGroup = event.target.querySelector('.form-group');
    const existingMessage = event.target.querySelector('.success-message');
    if (existingMessage) existingMessage.remove();
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = 'background: #00aa5522; border: 1px solid #00aa55; padding: 12px; border-radius: 6px; margin-top: 12px; color: #00cc66;';
    successDiv.textContent = 'Password reset link sent! Check your email.';
    formGroup.after(successDiv);
    
    // Clear form
    document.getElementById('reset-email').value = '';
    
    // Close modal after 3 seconds
    setTimeout(() => {
      closeForgotPassword();
      if (successDiv) successDiv.remove();
    }, 3000);
    
  } catch (error) {
    console.error('Password reset error:', error);
    
    const formGroup = event.target.querySelector('.form-group');
    const existingError = event.target.querySelector('.error-message');
    if (existingError) existingError.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = 'background: #aa000022; border: 1px solid #aa0000; padding: 12px; border-radius: 6px; margin-top: 12px; color: #ff6666;';
    errorDiv.textContent = error.message || 'Failed to send reset link. Please try again.';
    formGroup.after(errorDiv);
  } finally {
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
}

// Close modals when clicking outside
window.onclick = function(event) {
  const termsModal = document.getElementById('termsModal');
  const forgotModal = document.getElementById('forgotPasswordModal');
  
  if (event.target === termsModal) {
    closeTerms();
  }
  if (event.target === forgotModal) {
    closeForgotPassword();
  }
}

// Expose functions globally for onclick handlers
window.showSignIn = showSignIn;
window.showSignUp = showSignUp;
window.handleSignIn = handleSignIn;
window.handleSignUp = handleSignUp;
window.togglePassword = togglePassword;
window.showTerms = showTerms;
window.closeTerms = closeTerms;
window.showForgotPassword = showForgotPassword;
window.closeForgotPassword = closeForgotPassword;
window.handleForgotPassword = handleForgotPassword;

// Run on page load
checkAuth();

// Attach form handlers
document.addEventListener('DOMContentLoaded', () => {
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  
  if (signInForm) {
    signInForm.addEventListener('submit', handleSignIn);
  }
  
  if (signUpForm) {
    signUpForm.addEventListener('submit', handleSignUp);
  }
});
