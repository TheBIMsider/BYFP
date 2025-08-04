# BYFP - Carl's Fitness Shame Repository 🤦‍♂️

**⚠️ Personal Data Alert:** This is my actual fitness tracking app with real data (or lack of it 😔).

My personal version of the public BYF app - trust me nobody wants these fitness stats 🏋️🤔

**Public BYF Airtable version with instructions and a repo to fork available [HERE](https://github.com/TheBIMsider/BYF/tree/airtable-version)**

---

# BribeYourselfFit - Airtable Database Version v1.1

📊 **Structured database fitness tracking with Airtable's powerful features**

This version uses [Airtable](https://airtable.com) for data storage, providing a structured database with visual interface, rich field types, and powerful data management capabilities.

## 🤖 **Built with AI-Assisted Development**

This Airtable version was developed using advanced AI-powered development tools:

- ⚡ **Live Coding Sessions**: Real-time AI pair programming for database integration
- 🧠 **Claude (Anthropic)**: Database architecture, API integration, and systematic debugging
- 👨‍💻 **GitHub Copilot**: Intelligent code completion and suggestions
- 🏗️ **Human Expertise**: AECO/BIM domain knowledge and project direction by [The BIMsider](https://bio.link/thebimsider)

This showcases how AI tools enable domain experts to build sophisticated database-driven applications with modern API patterns and structured data relationships.

## 🚀 Quick Setup

### 1. Copy the Airtable Base Template
1. **[Use this Airtable template](https://airtable.com/appmoO7oRBIkwdegp/shrI1iK3qEtLWCTwQ)** to copy the pre-configured base to your account
2. **Review the sample data**. After reviewing, delete the sample data, but leave the table structure intact
3. **Rename your base** to something like "My BribeYourselfFit Data"
4. **Note your Base ID** from the URL (starts with `app...`)

### 2. Create Your Personal Access Token
1. Visit [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. **Create new token** with these settings:
   - **Name**: "BribeYourselfFit Access"
   - **Scopes**: 
     - ✅ `data.records:read`
     - ✅ `data.records:write`
     - ✅ `schema.bases:read`
   - **Access**: Select your BribeYourselfFit base
3. **Copy your token** (starts with `pat...`)

### 3. Deploy Your App
**Option A: GitHub Pages (Recommended)**
1. Fork this repository
2. Switch to `airtable-version` branch
3. Enable GitHub Pages in repository settings
4. Visit your deployed app URL
5. Enter your Airtable credentials during setup

**Option B: Local Development**
1. Clone/download this repository: `git checkout airtable-version`
2. Open `index.html` in a web browser
3. Enter your Airtable credentials during setup

### 4. Setup Your Profile
1. Test your Airtable connection (app validates credentials automatically)
2. Set your weight goals and daily targets
3. Your data automatically syncs to your structured Airtable base
4. Start logging and explore your data in Airtable's interface!

## 📊 Features

### ✨ **Airtable Database Benefits**
- 🗄️ **Structured data** in organized tables with proper relationships
- 👀 **Visual data interface** - view and edit your data directly in Airtable
- 📈 **Rich field types** - proper date fields, numbers, multi-select options
- 🔍 **Powerful filtering** and sorting in Airtable's interface
- 📊 **Built-in charts** and reporting within Airtable
- 🤝 **Data sharing** capabilities with family/coaches
- 📱 **Airtable mobile app** access to your fitness data
- 🔄 **Real-time sync** across all devices and platforms
- 📝 **Data validation** with proper field constraints
- 🏷️ **Multiple Select fields** for exercise types and wellness items
