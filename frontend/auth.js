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
    
    const { session, user } = await signUp(email, password);
    
    console.log('Sign up successful:', user.email);
    
    // Show success message
    errorDiv.textContent = 'Account created! Check your email to verify your account.';
    errorDiv.style.color = '#4ecdc4';
    errorDiv.style.display = 'block';
    
    // Clear form
    event.target.reset();
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign Up';
  } catch (error) {
    console.error('Sign up error:', error);
    errorDiv.textContent = error.message || 'Failed to create account';
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

// Check if user is already logged in
async function checkAuth() {
  try {
    const { getSession } = await import('./supabase-client.js');
    const session = await getSession();
    
    if (session) {
      window.location.href = '/app';
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }
}

// Run on page load
checkAuth();
