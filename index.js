// server.js
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcrypt');
const cors = require('cors'); // Added CORS
const excel = require('exceljs'); // For generating Excel files
const { google } = require('googleapis'); // Add this line at the top of the file
const credentials = require('./credentials.json'); // Add this line at the top of the file

const app = express();
const PORT = process.env.PORT || 3000;

// Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    credentials.web.client_id,
    credentials.web.client_secret,
    credentials.web.redirect_uris[0]
);

// Set the refresh token
// Set the refresh token
oauth2Client.setCredentials({
    refresh_token: credentials.web.refresh_token,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function uploadToDrive(filePath, fileName) {
    try {
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: 'image/jpeg',
            },
            media: {
                mimeType: 'image/jpeg',
                body: fs.createReadStream(filePath),
            },
        });

        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        const result = await drive.files.get({
            fileId: response.data.id,
            fields: 'webViewLink',
        });

        return result.data.webViewLink;
    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        throw error;
    }
}

// Handle the OAuth callback
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Authorization code is missing.');
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        if (tokens.refresh_token) {
            console.log('Refresh token received:', tokens.refresh_token);

            // ✅ Save the refresh token only if it exists
            credentials.web.refresh_token = tokens.refresh_token;
            fs.writeFileSync('./credentials.json', JSON.stringify(credentials, null, 2));
            res.send('Authentication successful! Refresh token saved. You can now upload images.');
        } else {
            console.log('No refresh token received. It may have already been saved earlier.');
            res.send('Authentication successful, but no new refresh token was provided.');
        }

    } catch (error) {
        console.error('Error retrieving access token:', error);
        res.status(500).send('Something went wrong. Please try again.');
    }
});


// Generate the authentication URL
const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // ✅ This forces Google to always send a refresh token
    scope: ['https://www.googleapis.com/auth/drive.file'],
    redirect_uri: credentials.web.redirect_uris[0],
});

console.log('Authorize this app by visiting this URL:', authUrl);

// Function to generate a random alphanumeric string
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Function to generate unique codes asynchronously
async function generateUniqueCodesAsync(count) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const codes = new Set();
            while (codes.size < count) {
                const code = `AY${generateRandomString(4)}RA`;
                codes.add(code);
            }
            resolve(Array.from(codes));
        }, 0); // Simulate async behavior
    });
}

// Generate unique codes asynchronously
let uniqueCodes = [];
generateUniqueCodesAsync(10000).then(codes => {
    uniqueCodes = codes;
    console.log('Generated 10,000 unique codes:', uniqueCodes.length);
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Error connecting to MongoDB Atlas:', err));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://aanadyanta.in.net'],
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set the absolute path to your static files directory
const publicPath = path.join(__dirname, 'frontend');
app.use(express.static(publicPath));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.use('/uploads', express.static(uploadDir)); // Serve uploaded files

const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Update User Schema to include Google ID if not already
const userSchema = new mongoose.Schema({
    googleId: { type: String, unique: true },
    username: String,
    email: String,
    password: String, // Optional, for local strategy
});

const User = mongoose.model('User', userSchema);

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL, // Ensure this matches the redirect URI in Google Console
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = new User({
                googleId: profile.id,
                username: profile.displayName,
                email: profile.emails[0].value,
            });
            await user.save();
        }
        done(null, user);
    } catch (err) {
        done(err);
    }
}));

// Google OAuth Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        console.log('User authenticated:', req.user); // Debugging line
        res.redirect('/');
    }
);

// Logout Route
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// Schemas
const submissionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    college: { type: String, required: true },
    submissionFile: { type: String, required: true },
    googleId: { type: String, required: true, unique: true },
    uniqueCode: { type: String, required: true }, // ✅ Ensure this line is included
});

const Submission = mongoose.model('Submission', submissionSchema);

// Passport Strategies
passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({ username });
        if (!user) return done(null, false, { message: 'Incorrect username.' });
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return done(null, false, { message: 'Incorrect password.' });
        
        done(null, user);
    } catch (err) {
        done(err);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Multer Configuration
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and GIF allowed.'), false);
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

const upload = multer({ 
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

// Routes
app.post('/submit', upload.single('submission'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { name, email, phone, college, googleId } = req.body;
        if (!name || !email || !phone || !college || !googleId) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Upload image to Google Drive
        const filePath = path.join(uploadDir, req.file.filename);
        const driveLink = await uploadToDrive(filePath, req.file.filename);

        // Assign a unique code to the user
        const uniqueCode = uniqueCodes.pop(); // Get the last code from the array
        if (!uniqueCode) {
            throw new Error('No more unique codes available.');
        }

        const submission = new Submission({
            name,
            email,
            phone,
            college,
            submissionFile: driveLink, // Store the Google Drive link
            googleId,
            uniqueCode, // Store the unique code
        });

        await submission.save();

        // Append the new submission to the Excel file
        await appendToExcel(submission);

        // Send the unique code back to the frontend
        res.json({
            message: 'Submission received!',
            uniqueCode, // Send the unique code
        });
    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

// Auth Routes
app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.json({ message: 'User created' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/login', passport.authenticate('local'), (req, res) => {
    res.json({ message: 'Logged in', user: req.user });
});

app.get('/logout', (req, res) => {
    req.logout();
    res.json({ message: 'Logged out' });
});

app.get('/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.json({});
    }
});

// Function to export submissions to Excel
const waitForFileRelease = (filePath, retries = 5, delay = 1000) => {
    return new Promise((resolve, reject) => {
        const attempt = (retryCount) => {
            fs.open(filePath, 'r+', (err, fd) => {
                if (err) {
                    if (err.code === 'EBUSY' && retryCount > 0) {
                        console.log(`File is busy, retrying in ${delay}ms...`);
                        setTimeout(() => attempt(retryCount - 1), delay);
                    } else {
                        reject(err);
                    }
                } else {
                    fs.close(fd, () => resolve());
                }
            });
        };
        attempt(retries);
    });
};
const ensureDirectoryExists = (filePath) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Directory created at: ${dir}`);
    }
};

async function appendToExcel(submission) {
    const filePath = path.join(__dirname, 'backend', 'submissions.xlsx');
    const workbook = new excel.Workbook();
    let worksheet;

    try {
        // ✅ Ensure directory exists
        ensureDirectoryExists(filePath);

        // ✅ Load or create workbook and worksheet
        if (fs.existsSync(filePath)) {
            await workbook.xlsx.readFile(filePath);
            worksheet = workbook.getWorksheet('Submissions');
            if (!worksheet) {
                worksheet = workbook.addWorksheet('Submissions');
            }
        } else {
            worksheet = workbook.addWorksheet('Submissions');
        }

        // ✅ Ensure headers are present only once
        if (!worksheet.getRow(1).getCell(1).value) {
            worksheet.columns = [
                { header: 'Name', key: 'name', width: 30 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Phone', key: 'phone', width: 20 },
                { header: 'College', key: 'college', width: 40 },
                { header: 'Photo URL', key: 'photo', width: 50 },
                { header: 'Unique Code', key: 'uniqueCode', width: 20 },
            ];
        }

        // ✅ Add the new submission and commit immediately
        worksheet.addRow({
            name: submission.name,
            email: submission.email,
            phone: submission.phone,
            college: submission.college,
            photo: submission.submissionFile,
            uniqueCode: submission.uniqueCode,
        }).commit();

        // ✅ Write changes to file
        let o = await workbook.xlsx.writeFile(filePath);
        console.log(o);
        console.log(`✅ Submission successfully appended to ${filePath}`);
    } catch (err) {
        console.error('❌ Error appending to Excel:', err);
    }
}


// Endpoint to manually trigger Excel export
app.get('/export', async (req, res) => {
    try {
        await exportSubmissionsToExcel();
        res.json({ message: 'Submissions exported to Excel successfully!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to export submissions' });
    }
});

// Endpoint to download the Excel file
app.get('/download', (req, res) => {
    const filePath = './submissions.xlsx'; // Path to the Excel file

    // Check if the file exists
    if (fs.existsSync(filePath)) {
        // Send the file as a download
        res.download(filePath, 'submissions.xlsx', (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(500).json({ error: 'Failed to download file' });
            }
        });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

async function startServer() {
    // Generate unique codes
    uniqueCodes = await generateUniqueCodesAsync(10000);
    console.log('Generated 10,000 unique codes:', uniqueCodes.length);
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

// Start the server
startServer();