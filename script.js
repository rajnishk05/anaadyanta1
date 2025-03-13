// Add this at the top of script.js
const loginBtn = document.getElementById('login-btn');


// Function to check if the user is logged in
async function checkLogin() {
    try {
        const response = await fetch('http://localhost:3000/user', {
            credentials: 'include',
        });
        const user = await response.json();
        return user && user.username;
    } catch (err) {
        console.error('Error checking login status:', err);
        return false;
    }
}

// Redirect to Google OAuth login
loginBtn.addEventListener('click', () => {
    window.location.href = 'http://localhost:3000/auth/google';
});

// Modify the form submission to check if the user is logged in
document.querySelector('.registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const isLoggedIn = await checkLogin();
    if (!isLoggedIn) {
        alert('Please login with Google before submitting.');
        return;
    }

    // Fetch the authenticated user's information
    const userResponse = await fetch('http://localhost:3000/user', {
        credentials: 'include',
    });
    const user = await userResponse.json();

    if (!user || !user.googleId) {
        alert('User not authenticated properly.');
        return;
    }

    const formData = new FormData(e.target);
    formData.append('googleId', user.googleId); // Add the googleId to the form data

    try {
        const response = await fetch('http://localhost:3000/submit', {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });

        const result = await response.json();

        if (response.ok) {
            // Display the unique code in a pop-up
            Swal.fire({
                title: 'Submission Successful!',
                html: `<p>Your unique code is: <strong>${result.uniqueCode}</strong></p>
                       <p>Take a screenshot of this for entry.</p>`,
                confirmButtonText: 'OK',
            });

            // Reload the page after submission
        } else {
            alert(result.error || 'Submission failed. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Network error. Please check your connection and try again.');
    }
});

// Loader and Video Controller
let progress = 0;
const loader = document.querySelector('.loader');
const loaderProgress = document.querySelector('.loader-progress');
const videoSplash = document.querySelector('.video-splash');
const introVideo = document.getElementById('intro-video');
const skipBtn = document.querySelector('.skip-btn');
const mainContent = document.querySelector('.main-content');

// Smooth scrolling for navigation links
document.querySelectorAll('.nav-links a').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        // Skip if the link is the Instagram link
        if (this.classList.contains('instagram-link')) {
            return; // Allow default behavior (open in new tab)
        }

        e.preventDefault(); // Prevent default behavior for other links
        const targetId = this.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Simulate loading progress
const loadInterval = setInterval(() => {
    progress += 1;
    loaderProgress.style.width = `${progress}%`;
    if (progress >= 100) {
        clearInterval(loadInterval);
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.remove();
            videoSplash.style.display = 'block';
            introVideo.play();
        }, 1000);
    }
}, 30);

// Skip button functionality
skipBtn.addEventListener('click', () => {
    videoSplash.style.display = 'none';
    mainContent.style.display = 'block';
});

// Automatically hide video after it ends
introVideo.addEventListener('ended', () => {
    videoSplash.style.display = 'none';
    mainContent.style.display = 'block';
});

// Countdown Timer
const eventDate = new Date('2025-04-03').getTime();

function updateCountdown() {
    const now = new Date().getTime();
    const timeLeft = eventDate - now;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}

setInterval(updateCountdown, 1000);

// Scroll Animation
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    document.body.style.background = `
        linear-gradient(
            ${scrollY * 0.1}deg,
            hsl(${scrollY * 0.2}, 70%, 85%),
            hsl(${scrollY * 0.1}, 70%, 85%)
        )
    `;
});

// Gallery Item Click
const galleryItems = document.querySelectorAll('.gallery-item');
galleryItems.forEach(item => {
    item.addEventListener('click', () => {
        alert(`You clicked on ${item.querySelector('p').textContent}`);
    });
});

// Login/Signup Modal
const authModal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const switchToSignup = document.getElementById('switch-to-signup');
const switchToLogin = document.getElementById('switch-to-login');
const closeModal = document.querySelector('.close-modal');

// Open modal when login/signup buttons are clicked
document.getElementById('login-btn').addEventListener('click', () => {
    authModal.style.display = 'block';
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
});

document.getElementById('signup-btn').addEventListener('click', () => {
    authModal.style.display = 'block';
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
});

// Switch between login and signup forms
switchToSignup.addEventListener('click', () => {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
});

switchToLogin.addEventListener('click', () => {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
});

// Close modal when the close button is clicked
closeModal.addEventListener('click', () => {
    authModal.style.display = 'none';
});

// Close modal when clicking outside the modal
window.addEventListener('click', (event) => {
    if (event.target === authModal) {
        authModal.style.display = 'none';
    }
});

// Handle login form submission
document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
        alert('Logged in successfully!');
        authModal.style.display = 'none';
    } else {
        alert('Login failed. Please check your credentials.');
    }
});

// Handle signup form submission
document.getElementById('signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;

    const response = await fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
        alert('User created successfully!');
        authModal.style.display = 'none';
    } else {
        alert('Signup failed. Please try again.');
    }
});

// Function to check and display logged-in user info
async function checkUser() {
    try {
        const response = await fetch('http://localhost:3000/user', {
            credentials: 'include',
        });
        const user = await response.json();
        
        if (user && user.username) {
            document.getElementById('user-info').innerHTML = `
                <p>Welcome, ${user.username}</p>
                <a href="http://localhost:3000/logout">Logout</a>
            `;
        } else {
            document.getElementById('user-info').innerHTML = `
                <p>Not logged in.</p>
            `;
        }
    } catch (err) {
        console.error('Error fetching user info:', err);
    }
}

// Function to trigger the download
function downloadExcel() {
    window.location.href = 'http://localhost:3000/download';
}

checkUser(); // Call the function when the page loads