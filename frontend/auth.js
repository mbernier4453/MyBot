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
function handleSignIn(event) {
  event.preventDefault();
  
  const email = document.getElementById('signin-email').value;
  const password = document.getElementById('signin-password').value;
  const rememberMe = document.getElementById('remember-me').checked;
  
  // TODO: Implement actual authentication
  console.log('Sign In:', { email, password, rememberMe });
  
  // For now, redirect to main app
  // In production, this should validate credentials first
  window.location.href = '/app';
}

// Sign Up Handler
function handleSignUp(event) {
  event.preventDefault();
  
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm').value;
  const terms = document.getElementById('terms').checked;
  
  // Validate passwords match
  if (password !== confirmPassword) {
    alert('Passwords do not match!');
    return;
  }
  
  // Validate terms accepted
  if (!terms) {
    alert('Please accept the Terms of Service and Privacy Policy');
    return;
  }
  
  // TODO: Implement actual registration
  console.log('Sign Up:', { name, email, password });
  
  // For now, redirect to main app
  // In production, this should create account first
  window.location.href = '/app';
}

// Check if user is already logged in
function checkAuth() {
  // TODO: Check if user has valid session/token
  const isLoggedIn = false; // Replace with actual check
  
  if (isLoggedIn) {
    window.location.href = '/app';
  }
}

// Run on page load
checkAuth();
