/**
 * SPOKIO BACKEND - COMPLETE ALL-IN-ONE SERVER
 * Full Node.js Express Application with JSON Data Storage
 * NO DATABASE REQUIRED - Uses In-Memory JSON Storage
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIO = require('socket.io');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// ============================================
// INITIALIZATION
// ============================================

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============================================
// JSON DATA STORAGE
// ============================================

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Data file paths
const FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    phrases: path.join(DATA_DIR, 'phrases.json'),
    groups: path.join(DATA_DIR, 'groups.json'),
    messages: path.join(DATA_DIR, 'messages.json'),
    emergency: path.join(DATA_DIR, 'emergency.json'),
    directMessages: path.join(DATA_DIR, 'direct-messages.json')
};

// Initialize data files
function initializeDataFiles() {
    const defaultData = {
        users: [],
        phrases: [],
        groups: [],
        messages: [],
        emergency: [],
        directMessages: []
    };

    Object.entries(FILES).forEach(([key, filePath]) => {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData[key], null, 2));
        }
    });
    console.log('✓ Data files initialized');
}

initializeDataFiles();

// ============================================
// DATA FUNCTIONS
// ============================================

function readData(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return [];
    }
}

function writeData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error.message);
        return false;
    }
}

// ============================================
// UTILITIES & HELPERS
// ============================================

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No authentication token provided'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Find user in JSON
        const users = readData(FILES.users);
        const user = users.find(u => u.id === decoded.userId);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Prediction Engine
class PredictionEngine {
    constructor() {
        this.commonPhrases = {
            'hello': ['How are you?', 'Nice to meet you', 'What is your name?', 'How can I help?'],
            'thank': ['You are welcome', 'No problem', 'Happy to help', 'Anytime'],
            'help': ['What do you need?', 'I can help you', 'How can I assist?', 'Tell me more'],
            'good': ['I am fine', 'Things are going well', 'Everything is great', 'I am happy'],
            'sorry': ['No worries', 'It is okay', 'No problem', 'Do not worry about it'],
            'yes': ['I agree', 'That sounds good', 'I like that idea', 'Let us do it'],
            'no': ['I do not agree', 'Not right now', 'Maybe later', 'I prefer not to'],
            'how': ['I am doing well', 'Everything is great', 'Could be better', 'Excellent'],
            'what': ['Tell me more', 'I understand', 'Can you explain?', 'I need clarification'],
            'where': ['Over there', 'Not sure', 'Can you point?', 'Let me check']
        };
    }

    predict(text, userPhrases = []) {
        const words = text.toLowerCase().split(' ');
        const lastWord = words[words.length - 1];
        let suggestions = [];

        for (const [key, values] of Object.entries(this.commonPhrases)) {
            if (lastWord.includes(key) || key.includes(lastWord)) {
                suggestions = [...suggestions, ...values];
            }
        }

        userPhrases.slice(0, 3).forEach(phrase => {
            if (!suggestions.includes(phrase.text)) {
                suggestions.push(phrase.text);
            }
        });

        return [...new Set(suggestions)].slice(0, 5);
    }
}

const predictionEngine = new PredictionEngine();

// Voices Database
const voicesDatabase = {
    'en-US': [
        { id: 'en-US-1', name: 'Google US English', lang: 'en-US' },
        { id: 'en-US-2', name: 'Google US English - Female', lang: 'en-US' },
        { id: 'en-US-3', name: 'Google US English - Male', lang: 'en-US' }
    ],
    'es-ES': [
        { id: 'es-ES-1', name: 'Google Spanish', lang: 'es-ES' }
    ],
    'fr-FR': [
        { id: 'fr-FR-1', name: 'Google French', lang: 'fr-FR' }
    ],
    'de-DE': [
        { id: 'de-DE-1', name: 'Google German', lang: 'de-DE' }
    ],
    'hi-IN': [
        { id: 'hi-IN-1', name: 'Google Hindi', lang: 'hi-IN' }
    ],
    'zh-CN': [
        { id: 'zh-CN-1', name: 'Google Chinese', lang: 'zh-CN' }
    ],
    'ja-JP': [
        { id: 'ja-JP-1', name: 'Google Japanese', lang: 'ja-JP' }
    ],
    'ar-SA': [
        { id: 'ar-SA-1', name: 'Google Arabic', lang: 'ar-SA' }
    ],
    'pt-BR': [
        { id: 'pt-BR-1', name: 'Google Portuguese', lang: 'pt-BR' }
    ]
};

// ============================================
// ROUTES - HEALTH & INFO
// ============================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

app.get('/api/info', (req, res) => {
    res.json({
        success: true,
        app: 'Spokio Backend',
        version: '1.0.0',
        storage: 'JSON Files',
        endpoints: {
            auth: ['/api/users/register', '/api/users/login'],
            user: ['/api/users/profile'],
            phrases: ['/api/phrases'],
            predictions: ['/api/predictions/predict', '/api/predictions/suggest'],
            community: ['/api/community/groups', '/api/community/stats'],
            emergency: ['/api/emergency/alert'],
            voices: ['/api/voices'],
            messages: ['/api/messages/send']
        }
    });
});

// ============================================
// ROUTES - AUTHENTICATION & USER
// ============================================

// Register User
app.post('/api/users/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username, email, and password are required'
            });
        }

        const users = readData(FILES.users);
        
        if (users.find(u => u.email === email || u.username === username)) {
            return res.status(400).json({
                success: false,
                message: 'Email or username already exists'
            });
        }

        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        const newUser = {
            id: generateId(),
            username,
            email,
            password: hashedPassword,
            profile: {
                name: username,
                location: '',
                bio: '',
                avatar: '',
                preferredLanguage: 'en-US'
            },
            accessibility: {
                fontSize: 16,
                highContrast: false,
                screenReaderEnabled: false
            },
            settings: {
                autoSave: false,
                vibrationFeedback: true
            },
            voicePreferences: {
                preferredVoice: '',
                speechRate: 1,
                pitch: 1
            },
            savedPhrases: [],
            communityGroups: [],
            emergencyContacts: [],
            lastLogin: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        users.push(newUser);
        writeData(FILES.users, users);

        const token = jwt.sign(
            { userId: newUser.id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        const userResponse = { ...newUser };
        delete userResponse.password;

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: userResponse
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Login User
app.post('/api/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const users = readData(FILES.users);
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        user.lastLogin = new Date();
        writeData(FILES.users, users);

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        const userResponse = { ...user };
        delete userResponse.password;

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: userResponse
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get User Profile
app.get('/api/users/profile', authMiddleware, (req, res) => {
    try {
        const userResponse = { ...req.user };
        delete userResponse.password;
        
        res.json({
            success: true,
            user: userResponse
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update User Profile
app.put('/api/users/profile', authMiddleware, (req, res) => {
    try {
        const { profile, accessibility, settings, voicePreferences } = req.body;
        const users = readData(FILES.users);
        const userIndex = users.findIndex(u => u.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (profile) {
            users[userIndex].profile = { ...users[userIndex].profile, ...profile };
        }
        if (accessibility) {
            users[userIndex].accessibility = { ...users[userIndex].accessibility, ...accessibility };
        }
        if (settings) {
            users[userIndex].settings = { ...users[userIndex].settings, ...settings };
        }
        if (voicePreferences) {
            users[userIndex].voicePreferences = { ...users[userIndex].voicePreferences, ...voicePreferences };
        }

        users[userIndex].updatedAt = new Date();
        writeData(FILES.users, users);

        const userResponse = { ...users[userIndex] };
        delete userResponse.password;

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: userResponse
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Add Emergency Contact
app.post('/api/users/emergency-contacts', authMiddleware, (req, res) => {
    try {
        const { name, phone, email, relationship } = req.body;
        const users = readData(FILES.users);
        const userIndex = users.findIndex(u => u.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        users[userIndex].emergencyContacts.push({
            id: generateId(),
            name,
            phone,
            email,
            relationship
        });

        writeData(FILES.users, users);

        res.status(201).json({
            success: true,
            message: 'Emergency contact added',
            emergencyContacts: users[userIndex].emergencyContacts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Emergency Contacts
app.get('/api/users/emergency-contacts', authMiddleware, (req, res) => {
    try {
        const users = readData(FILES.users);
        const user = users.find(u => u.id === req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            emergencyContacts: user.emergencyContacts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete Emergency Contact
app.delete('/api/users/emergency-contacts/:id', authMiddleware, (req, res) => {
    try {
        const users = readData(FILES.users);
        const userIndex = users.findIndex(u => u.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        users[userIndex].emergencyContacts = users[userIndex].emergencyContacts.filter(
            contact => contact.id !== req.params.id
        );

        writeData(FILES.users, users);

        res.json({
            success: true,
            message: 'Emergency contact deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// ROUTES - PHRASES
// ============================================

// Create Phrase
app.post('/api/phrases', authMiddleware, (req, res) => {
    try {
        const { text, language, category, tags } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Phrase text is required'
            });
        }

        const phrases = readData(FILES.phrases);

        const newPhrase = {
            id: generateId(),
            userId: req.user.id,
            text,
            language: language || req.user.profile.preferredLanguage,
            category: category || 'custom',
            priority: 0,
            usageCount: 0,
            lastUsed: null,
            tags: tags || [],
            isPublic: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        phrases.push(newPhrase);
        writeData(FILES.phrases, phrases);

        // Add to user's saved phrases
        const users = readData(FILES.users);
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex !== -1) {
            users[userIndex].savedPhrases.push(newPhrase.id);
            writeData(FILES.users, users);
        }

        res.status(201).json({
            success: true,
            message: 'Phrase saved successfully',
            phrase: newPhrase
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get All Phrases
app.get('/api/phrases', authMiddleware, (req, res) => {
    try {
        const { category, language, search } = req.query;
        let phrases = readData(FILES.phrases);

        phrases = phrases.filter(p => p.userId === req.user.id);

        if (category) {
            phrases = phrases.filter(p => p.category === category);
        }
        if (language) {
            phrases = phrases.filter(p => p.language === language);
        }
        if (search) {
            phrases = phrases.filter(p => p.text.toLowerCase().includes(search.toLowerCase()));
        }

        phrases.sort((a, b) => b.usageCount - a.usageCount || new Date(b.createdAt) - new Date(a.createdAt));
        phrases = phrases.slice(0, 100);

        res.json({
            success: true,
            phrases
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Single Phrase
app.get('/api/phrases/:id', authMiddleware, (req, res) => {
    try {
        const phrases = readData(FILES.phrases);
        const phrase = phrases.find(p => p.id === req.params.id);

        if (!phrase || phrase.userId !== req.user.id) {
            return res.status(404).json({
                success: false,
                message: 'Phrase not found'
            });
        }

        res.json({
            success: true,
            phrase
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update Phrase
app.put('/api/phrases/:id', authMiddleware, (req, res) => {
    try {
        const phrases = readData(FILES.phrases);
        const phraseIndex = phrases.findIndex(p => p.id === req.params.id);

        if (phraseIndex === -1 || phrases[phraseIndex].userId !== req.user.id) {
            return res.status(404).json({
                success: false,
                message: 'Phrase not found'
            });
        }

        const { text, category, tags, priority } = req.body;

        if (text) phrases[phraseIndex].text = text;
        if (category) phrases[phraseIndex].category = category;
        if (tags) phrases[phraseIndex].tags = tags;
        if (priority !== undefined) phrases[phraseIndex].priority = priority;

        phrases[phraseIndex].updatedAt = new Date();
        writeData(FILES.phrases, phrases);

        res.json({
            success: true,
            message: 'Phrase updated successfully',
            phrase: phrases[phraseIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete Phrase
app.delete('/api/phrases/:id', authMiddleware, (req, res) => {
    try {
        const phrases = readData(FILES.phrases);
        const phraseIndex = phrases.findIndex(p => p.id === req.params.id);

        if (phraseIndex === -1 || phrases[phraseIndex].userId !== req.user.id) {
            return res.status(404).json({
                success: false,
                message: 'Phrase not found'
            });
        }

        const deletedPhrase = phrases[phraseIndex];
        phrases.splice(phraseIndex, 1);
        writeData(FILES.phrases, phrases);

        // Remove from user's saved phrases
        const users = readData(FILES.users);
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex !== -1) {
            users[userIndex].savedPhrases = users[userIndex].savedPhrases.filter(id => id !== req.params.id);
            writeData(FILES.users, users);
        }

        res.json({
            success: true,
            message: 'Phrase deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Log Phrase Usage
app.post('/api/phrases/:id/use', authMiddleware, (req, res) => {
    try {
        const phrases = readData(FILES.phrases);
        const phraseIndex = phrases.findIndex(p => p.id === req.params.id);

        if (phraseIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Phrase not found'
            });
        }

        phrases[phraseIndex].usageCount += 1;
        phrases[phraseIndex].lastUsed = new Date();
        writeData(FILES.phrases, phrases);

        res.json({
            success: true,
            message: 'Usage logged',
            phrase: phrases[phraseIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Frequent Phrases
app.get('/api/phrases/stats/frequent', authMiddleware, (req, res) => {
    try {
        let phrases = readData(FILES.phrases);

        phrases = phrases.filter(p => p.userId === req.user.id);
        phrases.sort((a, b) => b.usageCount - a.usageCount);
        phrases = phrases.slice(0, 10);

        res.json({
            success: true,
            phrases
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// ROUTES - PREDICTIONS
// ============================================

// Get AI Predictions
app.post('/api/predictions/predict', authMiddleware, (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.json({
                success: true,
                predictions: []
            });
        }

        const phrases = readData(FILES.phrases);
        const frequentPhrases = phrases
            .filter(p => p.userId === req.user.id)
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, 10);

        const predictions = predictionEngine.predict(text, frequentPhrases);

        res.json({
            success: true,
            predictions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Smart Suggestions
app.post('/api/predictions/suggest', authMiddleware, (req, res) => {
    try {
        const { context } = req.body;

        const suggestions = {
            'greeting': ['Hello', 'Good morning', 'Good afternoon', 'How are you?'],
            'help': ['I need help', 'Can you help me?', 'Please assist me', 'I am struggling'],
            'gratitude': ['Thank you', 'Thank you very much', 'I appreciate your help', 'Thanks a lot'],
            'question': ['Can you help?', 'What time is it?', 'Where is...?', 'How do I...?'],
            'emergency': ['Help!', 'Emergency!', 'Call for help', 'I need immediate assistance'],
            'affirmation': ['Yes', 'I agree', 'That sounds good', 'I like that idea'],
            'negation': ['No', 'I disagree', 'Not right now', 'Maybe later'],
            'appreciation': ['Thank you so much', 'You are awesome', 'I really appreciate it', 'Thanks for everything']
        };

        const contextSuggestions = suggestions[context] || suggestions['greeting'];

        res.json({
            success: true,
            suggestions: contextSuggestions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// ROUTES - COMMUNITY
// ============================================

// Get All Groups
app.get('/api/community/groups', (req, res) => {
    try {
        const { category, language, search } = req.query;
        let groups = readData(FILES.groups);

        groups = groups.filter(g => g.isPublic);

        if (category) {
            groups = groups.filter(g => g.category === category);
        }
        if (language) {
            groups = groups.filter(g => g.language === language);
        }
        if (search) {
            groups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
        }

        groups.sort((a, b) => b.memberCount - a.memberCount);
        groups = groups.slice(0, 50);

        // Get creator info
        const users = readData(FILES.users);
        groups = groups.map(g => {
            const creator = users.find(u => u.id === g.creator);
            return {
                ...g,
                creator: creator ? { id: creator.id, username: creator.username, name: creator.profile.name } : null
            };
        });

        res.json({
            success: true,
            groups
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Group Details
app.get('/api/community/groups/:id', authMiddleware, (req, res) => {
    try {
        const groups = readData(FILES.groups);
        const group = groups.find(g => g.id === req.params.id);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const users = readData(FILES.users);
        const creator = users.find(u => u.id === group.creator);
        const members = group.members.map(memberId => {
            const user = users.find(u => u.id === memberId);
            return user ? { id: user.id, username: user.username, name: user.profile.name, avatar: user.profile.avatar } : null;
        }).filter(m => m);

        res.json({
            success: true,
            group: {
                ...group,
                creator: creator ? { id: creator.id, username: creator.username, name: creator.profile.name } : null,
                members
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create Group
app.post('/api/community/groups', authMiddleware, (req, res) => {
    try {
        const { name, description, category, language } = req.body;

        if (!name || !category) {
            return res.status(400).json({
                success: false,
                message: 'Name and category are required'
            });
        }

        const groups = readData(FILES.groups);

        const newGroup = {
            id: generateId(),
            name,
            description: description || '',
            category,
            language: language || 'en-US',
            members: [req.user.id],
            moderators: [req.user.id],
            creator: req.user.id,
            icon: '',
            isPublic: true,
            memberCount: 1,
            messageCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        groups.push(newGroup);
        writeData(FILES.groups, groups);

        // Add to user's community groups
        const users = readData(FILES.users);
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex !== -1) {
            users[userIndex].communityGroups.push(newGroup.id);
            writeData(FILES.users, users);
        }

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            group: newGroup
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Join Group
app.post('/api/community/groups/:id/join', authMiddleware, (req, res) => {
    try {
        const groups = readData(FILES.groups);
        const groupIndex = groups.findIndex(g => g.id === req.params.id);

        if (groupIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (groups[groupIndex].members.includes(req.user.id)) {
            return res.status(400).json({
                success: false,
                message: 'Already a member of this group'
            });
        }

        groups[groupIndex].members.push(req.user.id);
        groups[groupIndex].memberCount = groups[groupIndex].members.length;
        writeData(FILES.groups, groups);

        // Add to user's community groups
        const users = readData(FILES.users);
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex !== -1) {
            users[userIndex].communityGroups.push(req.params.id);
            writeData(FILES.users, users);
        }

        res.json({
            success: true,
            message: 'Successfully joined group',
            group: groups[groupIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Leave Group
app.post('/api/community/groups/:id/leave', authMiddleware, (req, res) => {
    try {
        const groups = readData(FILES.groups);
        const groupIndex = groups.findIndex(g => g.id === req.params.id);

        if (groupIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        groups[groupIndex].members = groups[groupIndex].members.filter(id => id !== req.user.id);
        groups[groupIndex].memberCount = groups[groupIndex].members.length;
        writeData(FILES.groups, groups);

        // Remove from user's community groups
        const users = readData(FILES.users);
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex !== -1) {
            users[userIndex].communityGroups = users[userIndex].communityGroups.filter(id => id !== req.params.id);
            writeData(FILES.users, users);
        }

        res.json({
            success: true,
            message: 'Successfully left group'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Group Messages
app.get('/api/community/groups/:id/messages', authMiddleware, (req, res) => {
    try {
        const { limit = 50, skip = 0 } = req.query;
        let messages = readData(FILES.messages);

        messages = messages.filter(m => m.groupId === req.params.id);
        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        const totalMessages = messages.length;
        messages = messages.slice(-parseInt(limit) - parseInt(skip), -parseInt(skip) || undefined);

        // Get user info for messages
        const users = readData(FILES.users);
        messages = messages.map(m => {
            const user = users.find(u => u.id === m.userId);
            return {
                ...m,
                user: user ? { id: user.id, username: user.username, name: user.profile.name, avatar: user.profile.avatar } : null
            };
        });

        res.json({
            success: true,
            messages,
            totalMessages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Send Message to Group
app.post('/api/community/groups/:id/messages', authMiddleware, (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Message content is required'
            });
        }

        const groups = readData(FILES.groups);
        const group = groups.find(g => g.id === req.params.id);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (!group.members.includes(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        const messages = readData(FILES.messages);

        const newMessage = {
            id: generateId(),
            groupId: req.params.id,
            userId: req.user.id,
            content,
            messageType: 'text',
            reactions: {
                thumbsUp: 0,
                thumbsDown: 0,
                heart: 0,
                laugh: 0
            },
            isEdited: false,
            createdAt: new Date()
        };

        messages.push(newMessage);
        writeData(FILES.messages, messages);

        // Update group message count
        const groupIndex = groups.findIndex(g => g.id === req.params.id);
        if (groupIndex !== -1) {
            groups[groupIndex].messageCount += 1;
            writeData(FILES.groups, groups);
        }

        // Get user info
        const users = readData(FILES.users);
        const user = users.find(u => u.id === req.user.id);

        const messageResponse = {
            ...newMessage,
            user: user ? { id: user.id, username: user.username, name: user.profile.name, avatar: user.profile.avatar } : null
        };

        // Emit via Socket.IO
        io.to(`group-${req.params.id}`).emit('new-message', {
            success: true,
            message: messageResponse
        });

        res.status(201).json({
            success: true,
            message: 'Message sent',
            data: messageResponse
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Community Stats
app.get('/api/community/stats', (req, res) => {
    try {
        const users = readData(FILES.users);
        const groups = readData(FILES.groups);
        const messages = readData(FILES.messages);

        const totalUsers = users.length;
        const totalGroups = groups.length;
        const totalMessages = messages.length;
        const onlineUsers = Math.floor(totalUsers * 0.4);

        const recentMessages = messages
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10)
            .map(m => {
                const user = users.find(u => u.id === m.userId);
                const group = groups.find(g => g.id === m.groupId);
                return {
                    ...m,
                    user: user ? { id: user.id, username: user.username } : null,
                    group: group ? { id: group.id, name: group.name } : null
                };
            });

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalGroups,
                totalMessages,
                onlineUsers,
                recentMessages
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// ROUTES - EMERGENCY
// ============================================

// Create Emergency Alert
app.post('/api/emergency/alert', authMiddleware, (req, res) => {
    try {
        const { message, location, severity } = req.body;

        const emergency = readData(FILES.emergency);

        const newAlert = {
            id: generateId(),
            userId: req.user.id,
            status: 'active',
            location: location || {},
            message: message || '',
            severity: severity || 'high',
            emergencyContacts: [],
            responders: [],
            notes: '',
            createdAt: new Date(),
            resolvedAt: null,
            cancelledAt: null
        };

        emergency.push(newAlert);
        writeData(FILES.emergency, emergency);

        // Broadcast via Socket.IO
        io.emit('emergency-broadcast', {
            userId: req.user.id,
            userName: req.user.profile.name || req.user.username,
            location: location,
            message,
            timestamp: new Date(),
            emergencyId: newAlert.id
        });

        res.status(201).json({
            success: true,
            message: 'Emergency alert activated',
            emergency: newAlert
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Emergency Alerts
app.get('/api/emergency/alerts', authMiddleware, (req, res) => {
    try {
        const { status } = req.query;
        let alerts = readData(FILES.emergency);

        alerts = alerts.filter(a => a.userId === req.user.id);

        if (status) {
            alerts = alerts.filter(a => a.status === status);
        }

        alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        alerts = alerts.slice(0, 50);

        res.json({
            success: true,
            alerts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Single Emergency Alert
app.get('/api/emergency/alerts/:id', authMiddleware, (req, res) => {
    try {
        const alerts = readData(FILES.emergency);
        const alert = alerts.find(a => a.id === req.params.id);

        if (!alert || alert.userId !== req.user.id) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        // Get user info
        const users = readData(FILES.users);
        const user = users.find(u => u.id === alert.userId);

        res.json({
            success: true,
            alert: {
                ...alert,
                user: user ? { id: user.id, username: user.username, name: user.profile.name } : null
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Resolve Emergency Alert
app.post('/api/emergency/alerts/:id/resolve', authMiddleware, (req, res) => {
    try {
        const alerts = readData(FILES.emergency);
        const alertIndex = alerts.findIndex(a => a.id === req.params.id);

        if (alertIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        alerts[alertIndex].status = 'resolved';
        alerts[alertIndex].resolvedAt = new Date();
        writeData(FILES.emergency, alerts);

        res.json({
            success: true,
            message: 'Emergency alert resolved',
            alert: alerts[alertIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Cancel Emergency Alert
app.post('/api/emergency/alerts/:id/cancel', authMiddleware, (req, res) => {
    try {
        const alerts = readData(FILES.emergency);
        const alertIndex = alerts.findIndex(a => a.id === req.params.id);

        if (alertIndex === -1 || alerts[alertIndex].userId !== req.user.id) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        alerts[alertIndex].status = 'cancelled';
        alerts[alertIndex].cancelledAt = new Date();
        writeData(FILES.emergency, alerts);

        res.json({
            success: true,
            message: 'Emergency alert cancelled',
            alert: alerts[alertIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// ROUTES - VOICES
// ============================================

// Get Available Voices
app.get('/api/voices', authMiddleware, (req, res) => {
    try {
        const { language } = req.query;
        const lang = language || req.user.profile.preferredLanguage || 'en-US';

        const voices = voicesDatabase[lang] || voicesDatabase['en-US'];

        res.json({
            success: true,
            voices,
            defaultLanguage: lang
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get All Languages
app.get('/api/voices/languages', authMiddleware, (req, res) => {
    try {
        const languages = Object.keys(voicesDatabase).map(lang => ({
            code: lang,
            voices: voicesDatabase[lang],
            count: voicesDatabase[lang].length
        }));

        res.json({
            success: true,
            languages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// ROUTES - DIRECT MESSAGES
// ============================================

// Send Direct Message
app.post('/api/messages/send', authMiddleware, (req, res) => {
    try {
        const { recipientId, content } = req.body;

        if (!recipientId || !content) {
            return res.status(400).json({
                success: false,
                message: 'Recipient and message content are required'
            });
        }

        const directMessages = readData(FILES.directMessages);

        const newMessage = {
            id: generateId(),
            sender: req.user.id,
            recipient: recipientId,
            content,
            isRead: false,
            createdAt: new Date()
        };

        directMessages.push(newMessage);
        writeData(FILES.directMessages, directMessages);

        // Emit via Socket.IO
        const recipientSocket = connectedUsers.get(recipientId);
        if (recipientSocket) {
            io.to(recipientSocket).emit('new-direct-message', {
                senderId: req.user.id,
                senderName: req.user.profile.name,
                content,
                timestamp: new Date()
            });
        }

        res.status(201).json({
            success: true,
            message: 'Message sent',
            data: newMessage
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get Conversation
app.get('/api/messages/conversation/:userId', authMiddleware, (req, res) => {
    try {
        let messages = readData(FILES.directMessages);

        messages = messages.filter(m =>
            (m.sender === req.user.id && m.recipient === req.params.userId) ||
            (m.sender === req.params.userId && m.recipient === req.user.id)
        );

        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        messages = messages.slice(-50);

        res.json({
            success: true,
            messages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Mark Message as Read
app.post('/api/messages/:id/read', authMiddleware, (req, res) => {
    try {
        const directMessages = readData(FILES.directMessages);
        const messageIndex = directMessages.findIndex(m => m.id === req.params.id);

        if (messageIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        directMessages[messageIndex].isRead = true;
        writeData(FILES.directMessages, directMessages);

        res.json({
            success: true,
            message: directMessages[messageIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================
// SOCKET.IO HANDLERS
// ============================================

const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log(`✓ User connected via Socket.IO: ${socket.id}`);

    // User joins
    socket.on('user-join', (userId) => {
        connectedUsers.set(userId, socket.id);
        socket.userId = userId;
        
        io.emit('user-status', {
            userId,
            status: 'online',
            totalOnline: connectedUsers.size
        });

        console.log(`✓ User ${userId} joined (Total: ${connectedUsers.size})`);
    });

    // Join community group
    socket.on('join-group', (groupId) => {
        socket.join(`group-${groupId}`);
    });

    // Leave community group
    socket.on('leave-group', (groupId) => {
        socket.leave(`group-${groupId}`);
    });

    // Send group message
    socket.on('send-group-message', (data) => {
        try {
            const { groupId, content } = data;
            const messages = readData(FILES.messages);

            const newMessage = {
                id: generateId(),
                groupId,
                userId: socket.userId,
                content,
                messageType: 'text',
                reactions: { thumbsUp: 0, thumbsDown: 0, heart: 0, laugh: 0 },
                isEdited: false,
                createdAt: new Date()
            };

            messages.push(newMessage);
            writeData(FILES.messages, messages);

            io.to(`group-${groupId}`).emit('new-message', {
                success: true,
                message: newMessage
            });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Typing indicator
    socket.on('user-typing', (data) => {
        const { groupId, username } = data;
        io.to(`group-${groupId}`).emit('user-typing', {
            username,
            isTyping: true
        });
    });

    socket.on('user-stop-typing', (data) => {
        const { groupId, username } = data;
        io.to(`group-${groupId}`).emit('user-typing', {
            username,
            isTyping: false
        });
    });

    // Emergency alert broadcast
    socket.on('emergency-alert', (data) => {
        io.emit('emergency-broadcast', {
            userId: socket.userId,
            location: data.location,
            message: data.message,
            timestamp: new Date()
        });
    });

    // Direct message
    socket.on('direct-message', (data) => {
        const { recipientId, content } = data;
        const recipientSocket = connectedUsers.get(recipientId);

        if (recipientSocket) {
            io.to(recipientSocket).emit('new-direct-message', {
                senderId: socket.userId,
                content,
                timestamp: new Date()
            });
        }
    });

    // User disconnects
    socket.on('disconnect', () => {
        console.log(`✗ User disconnected: ${socket.id}`);
        
        if (socket.userId) {
            connectedUsers.delete(socket.userId);
            io.emit('user-status', {
                userId: socket.userId,
                status: 'offline',
                totalOnline: connectedUsers.size
            });
        }
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// Periodic status update
setInterval(() => {
    io.emit('online-stats', {
        totalOnline: connectedUsers.size,
        timestamp: new Date()
    });
}, 30000);

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path,
        method: req.method
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║     🗣️  SPOKIO BACKEND SERVER STARTED             ║
╚══════════════════════════════════════════════════╝

📡 Server: http://localhost:${PORT}
💾 Storage: JSON Files (No Database)
🌍 CORS: ${process.env.CLIENT_URL || 'http://localhost:3000'}
🔧 Environment: ${process.env.NODE_ENV || 'development'}
🔑 JWT: Configured
📡 Socket.IO: Active

✓ Ready for connections! 🚀
    `);
});

module.exports = { app, server, io };
