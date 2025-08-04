# BribeYourselfFit - JSONBin Cloud Version v1.1

🌐 **Cloud-synced fitness tracking with JSONBin.io storage**

This version uses [JSONBin.io](https://jsonbin.io) for cloud storage, allowing your fitness data to sync across devices and be accessible anywhere.

## 🤖 **Built with AI-Assisted Development**

This cloud version was developed using cutting-edge AI-powered development tools:

- ⚡ **Vide Coding Sessions**: Live AI pair programming for rapid development
- 🧠 **Claude (Anthropic)**: API integration, cloud architecture, and documentation
- 👨‍💻 **GitHub Copilot**: Intelligent code completion and suggestions
- 🏗️ **Human Expertise**: AECO/BIM domain knowledge by [The BIMsider](https://bio.link/thebimsider)

This demonstrates how AI tools enable domain experts to build sophisticated cloud-integrated applications with modern web technologies and API patterns.

---
## 📱 Screenshot

<img width="1279" height="942" alt="BFY_JSONBin" src="https://github.com/user-attachments/assets/a2a16012-256a-48ed-9eee-950c4f14e4fe" />

## 🚀 Quick Setup

### 1. Get Your JSONBin.io API Key
1. Visit [jsonbin.io](https://jsonbin.io) and create a free account
2. Go to **API Keys** section in your dashboard
3. Create a new API key with these permissions:
   - ✅ **Create** (to create your data storage)
   - ✅ **Read** (to load your data)
   - ✅ **Update** (to save changes)
   - ✅ **Delete** (for data reset functionality)
4. Copy your API key (starts with `$2a$10$...`)

### 2. Deploy Your App
**Option A: GitHub Pages (Recommended)**
1. Fork this repository
2. Enable GitHub Pages in repository settings
3. Visit your deployed app URL
4. Enter your JSONBin API key during setup

**Option B: Local Development**
1. Clone/download this repository
2. Open `index.html` in a web browser
3. Enter your JSONBin API key during setup

### 3. Setup Your Profile
1. Test your JSONBin API key (app validates format automatically)
2. Set your weight goals and daily targets (with validation)
3. Your data automatically syncs to the cloud
4. Start logging your fitness journey!

## 📊 Features

### ✨ **Cloud Benefits**
- 🔄 **Auto-sync** across all your devices with retry logic
- 💾 **Secure cloud storage** with JSONBin.io
- 🌍 **Access anywhere** with internet connection
- 📱 **Mobile-friendly** PWA that works like a native app
- ⚡ **Offline-first** - works without internet, syncs when connected
- 🔄 **Smart retry** with exponential backoff for reliable syncing
- 📊 **Real-time sync status** indicators
