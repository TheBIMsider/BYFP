/**
 * BribeYourselfFit - Gamified Fitness Tracker
 *
 * This JavaScript file implements a complete fitness tracking system with:
 * - Daily logging with streak tracking
 * - Weight progress monitoring
 * - Gamification with milestones and rewards
 * - Data visualization with charts
 * - localStorage persistence
 *
 * Data Structure:
 * - User profile (goals, starting stats)
 * - Daily logs (weight, steps, exercise, water, wellness)
 * - Streaks (daily consecutive + weekly/monthly cumulative)
 * - Milestones (default + custom rewards)
 * - Achievements (completed milestones)
 */

class BribeYourselfFit {
  constructor() {
    // Initialize app state
    this.currentUser = null;
    this.dailyLogs = {};
    this.streaks = {};
    this.customRewards = [];
    this.achievements = [];
    this.defaultMilestones = [];
    this.defaultMilestones = [];
    this.settings = this.getDefaultSettings();
    this.currentTab = 'dashboard';
    this.chartPeriod = 7;
    this.currentDate = new Date().toISOString().split('T')[0];
    this.deferredPrompt = null; // For PWA install prompt

    // Data validation ranges
    this.validationRanges = {
      weight: { min: 50, max: 1000 },
      steps: { min: 0, max: 50000 },
      exercise: { min: 0, max: 300 },
      water: { min: 0, max: 10 },
    };

    // Initialize the application
    this.init();
  }

  /**
   * Initialize the application
   * Load data, set up event listeners, and determine initial screen
   */
  init() {
    this.loadData();
    this.setupEventListeners();
    this.updateCurrentDate();

    // Show setup screen if no user profile exists
    if (!this.currentUser) {
      this.showSetupScreen();
    } else {
      this.showAppScreen();
      this.updateDashboard();
    }
  }

  /**
   * Set up all event listeners for the application
   */
  setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', this.toggleTheme.bind(this));
    }

    // Setup form
    const setupForm = document.getElementById('setupForm');
    if (setupForm) {
      setupForm.addEventListener('submit', this.handleSetup.bind(this));
    }

    // Daily log form
    const dailyLogForm = document.getElementById('dailyLogForm');
    if (dailyLogForm) {
      dailyLogForm.addEventListener('submit', this.handleDailyLog.bind(this));
    }

    // Wellness checkboxes
    const wellnessCheckboxes = document.querySelectorAll('.wellness-checkbox');
    wellnessCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', this.updateWellnessScore.bind(this));
    });

    // Exercise type checkboxes
    const exerciseCheckboxes = document.querySelectorAll('.exercise-checkbox');
    exerciseCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener(
        'change',
        this.updateExerciseSelection.bind(this)
      );
    });

    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Chart period controls
    const chartBtns = document.querySelectorAll('.chart-btn');
    chartBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.setChartPeriod(parseInt(e.target.dataset.period) || 'all');
      });
    });

    // Reward form
    const rewardForm = document.getElementById('rewardForm');
    if (rewardForm) {
      rewardForm.addEventListener('submit', this.handleCustomReward.bind(this));
    }

    // Reward type selector
    const rewardType = document.getElementById('rewardType');
    if (rewardType) {
      rewardType.addEventListener(
        'change',
        this.updateRewardCriteria.bind(this)
      );
    }

    // Calendar navigation
    const prevMonth = document.getElementById('prevMonth');
    const nextMonth = document.getElementById('nextMonth');
    if (prevMonth)
      prevMonth.addEventListener('click', () => this.navigateCalendar(-1));
    if (nextMonth)
      nextMonth.addEventListener('click', () => this.navigateCalendar(1));

    // Settings event listeners
    this.setupSettingsEventListeners();
  }

  /**
   * Setup settings-specific event listeners
   */
  setupSettingsEventListeners() {
    // Theme preference radio buttons
    const themeRadios = document.querySelectorAll(
      'input[name="themePreference"]'
    );
    themeRadios.forEach((radio) => {
      radio.addEventListener(
        'change',
        this.handleThemePreferenceChange.bind(this)
      );
    });

    // Unit and format selectors
    const weightUnit = document.getElementById('weightUnit');
    const dateFormat = document.getElementById('dateFormat');
    const weekStart = document.getElementById('weekStart');

    if (weightUnit) {
      weightUnit.addEventListener(
        'change',
        this.handleSettingChange.bind(this)
      );
    }
    if (dateFormat) {
      dateFormat.addEventListener(
        'change',
        this.handleSettingChange.bind(this)
      );
    }
    if (weekStart) {
      weekStart.addEventListener('change', this.handleSettingChange.bind(this));
    }

    // Goal update buttons
    const updateGoalsBtn = document.getElementById('updateGoalsBtn');
    const updateWeightGoalsBtn = document.getElementById(
      'updateWeightGoalsBtn'
    );

    if (updateGoalsBtn) {
      updateGoalsBtn.addEventListener(
        'click',
        this.handleUpdateDailyGoals.bind(this)
      );
    }
    if (updateWeightGoalsBtn) {
      updateWeightGoalsBtn.addEventListener(
        'click',
        this.handleUpdateWeightGoals.bind(this)
      );
    }

    // Goal threshold checkboxes
    const allowPartialSteps = document.getElementById('allowPartialSteps');
    const allowPartialExercise = document.getElementById(
      'allowPartialExercise'
    );
    const strictWellness = document.getElementById('strictWellness');

    if (allowPartialSteps) {
      allowPartialSteps.addEventListener(
        'change',
        this.handleSettingChange.bind(this)
      );
    }
    if (allowPartialExercise) {
      allowPartialExercise.addEventListener(
        'change',
        this.handleSettingChange.bind(this)
      );
    }
    if (strictWellness) {
      strictWellness.addEventListener(
        'change',
        this.handleSettingChange.bind(this)
      );
    }

    // View stats button
    const viewStatsBtn = document.getElementById('viewStatsBtn');
    if (viewStatsBtn) {
      viewStatsBtn.addEventListener('click', this.viewDetailedStats.bind(this));
    }

    // Data management buttons
    const exportDataBtn = document.getElementById('exportDataBtn');
    const exportLogsBtn = document.getElementById('exportLogsBtn');
    const importDataBtn = document.getElementById('importDataBtn');

    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', this.exportAllData.bind(this));
    }
    if (exportLogsBtn) {
      exportLogsBtn.addEventListener('click', this.exportDailyLogs.bind(this));
    }
    if (importDataBtn) {
      importDataBtn.addEventListener('click', this.handleImportData.bind(this));
    }

    // Reset buttons
    const resetStreaksBtn = document.getElementById('resetStreaksBtn');
    const clearTodayBtn = document.getElementById('clearTodayBtn');
    const resetProfileBtn = document.getElementById('resetProfileBtn');
    const resetLogsBtn = document.getElementById('resetLogsBtn');
    const resetAllDataBtn = document.getElementById('resetAllDataBtn');

    if (resetStreaksBtn) {
      resetStreaksBtn.addEventListener('click', this.resetStreaks.bind(this));
    }
    if (clearTodayBtn) {
      clearTodayBtn.addEventListener('click', this.clearTodaysLog.bind(this));
    }
    if (resetProfileBtn) {
      resetProfileBtn.addEventListener('click', this.resetProfile.bind(this));
    }
    if (resetLogsBtn) {
      resetLogsBtn.addEventListener('click', this.resetLogs.bind(this));
    }
    if (resetAllDataBtn) {
      resetAllDataBtn.addEventListener('click', this.resetAllData.bind(this));
    }

    // Import file handler
    const importFile = document.getElementById('importFile');
    if (importFile) {
      importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.importData(file);
        }
      });
    }
  }

  /**
   * Handle import data button click
   */
  handleImportData() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];

    if (!file) {
      this.showError('Please select a backup file first');
      return;
    }

    this.importData(file);
  }

  /**
   * Import data from JSON file
   */
  importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // Validate imported data structure
        if (!this.validateImportData(importedData)) {
          this.showError('Invalid backup file format');
          return;
        }

        // Confirm import
        if (
          !confirm(
            'This will replace all current data. Are you sure you want to import?'
          )
        ) {
          return;
        }

        // Import data
        this.currentUser = importedData.user;
        this.dailyLogs = importedData.dailyLogs || {};
        this.streaks = importedData.streaks || this.initializeStreaks();
        this.customRewards = importedData.customRewards || [];
        this.achievements = importedData.achievements || [];
        this.settings = {
          ...this.getDefaultSettings(),
          ...(importedData.settings || {}),
        };

        // Save imported data
        this.saveData();
        this.saveSettings();

        // Refresh display
        this.updateDashboard();
        this.initializeDefaultMilestones();

        this.showSuccess('Data imported successfully!');

        // Refresh page to ensure clean state
        setTimeout(() => {
          location.reload();
        }, 1500);
      } catch (error) {
        console.error('Import error:', error);
        this.showError('Failed to import data. Please check the file format.');
      }
    };

    reader.readAsText(file);
  }

  /**
   * Validate imported data structure
   */
  validateImportData(data) {
    return (
      data &&
      data.user &&
      typeof data.user.startingWeight === 'number' &&
      typeof data.user.goalWeight === 'number' &&
      typeof data.user.dailySteps === 'number' &&
      typeof data.user.dailyExercise === 'number' &&
      typeof data.user.dailyWater === 'number'
    );
  }

  /**
   * Export daily logs only
   */
  exportDailyLogs() {
    const exportData = {
      dailyLogs: this.dailyLogs,
      exportDate: new Date().toISOString(),
      exportType: 'logs_only',
      version: '1.1.0-localStorage',
    };

    this.downloadData(exportData, 'daily_logs');
    this.showSuccess('Daily logs exported successfully!');
  }

  /**
   * View detailed statistics
   */
  viewDetailedStats() {
    const stats = this.getAppStats();

    const statsText = Object.entries(stats)
      .map(
        ([key, value]) =>
          `${key}: ${
            typeof value === 'object' ? JSON.stringify(value, null, 2) : value
          }`
      )
      .join('\n');

    alert(`BribeYourselfFit Detailed Statistics:\n\n${statsText}`);
    console.table(stats);
  }

  /**
   * Handle theme preference changes
   */
  handleThemePreferenceChange(e) {
    const value = e.target.value;
    this.settings.themePreference = value;
    this.saveSettings();

    if (value === 'system') {
      // Follow system preference
      const systemPrefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      const theme = systemPrefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('byf_theme', theme);
    } else {
      // Use selected theme
      document.documentElement.setAttribute('data-theme', value);
      localStorage.setItem('byf_theme', value);
    }

    this.updateThemeToggle(document.documentElement.getAttribute('data-theme'));
  }

  /**
   * Handle general setting changes
   */
  handleSettingChange(e) {
    try {
      const setting = e.target.id;
      const value =
        e.target.type === 'checkbox' ? e.target.checked : e.target.value;

      console.log(`🔧 Setting changed: ${setting} = ${value}`);

      this.settings[setting] = value;
      this.saveSettings();

      console.log('💾 Current settings after save:', this.settings);
      console.log(
        '💾 Saved to localStorage:',
        localStorage.getItem('byf_settings')
      );

      // Apply certain settings immediately with error handling
      if (setting === 'weekStart') {
        // Re-render calendar if it's currently visible
        if (this.currentTab === 'charts') {
          this.renderStreakCalendar();
        }
      } else if (setting === 'weightUnit') {
        console.log(`🔄 Weight unit changed to: ${value}`);
        try {
          // Update all weight displays immediately
          this.updateWeightDisplays();
          // Force update settings display after a short delay
          setTimeout(() => {
            this.updateSettingsDisplay();
          }, 100);
        } catch (weightError) {
          console.error('Weight display update error:', weightError);
        }
      } else if (setting === 'dateFormat') {
        // Update date displays if needed
        this.updateCurrentDate();
      }
    } catch (error) {
      console.error('Settings change error:', error);
      // Still try to save the basic setting even if UI updates fail
      this.settings[e.target.id] =
        e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      this.saveSettings();
    }
  }

  /**
   * Setup system theme preference listener
   */
  setupSystemThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleThemeChange = (e) => {
      if (this.settings.themePreference === 'system') {
        const theme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('byf_theme', theme);
        this.updateThemeToggle(theme);
      }
    };

    mediaQuery.addListener(handleThemeChange);

    // Set initial theme
    handleThemeChange(mediaQuery);
  }

  /**
   * View detailed statistics
   */
  viewDetailedStats() {
    const stats = this.getAppStats();

    const statsText = Object.entries(stats)
      .map(
        ([key, value]) =>
          `${key}: ${
            typeof value === 'object' ? JSON.stringify(value, null, 2) : value
          }`
      )
      .join('\n');

    alert(`BribeYourselfFit Detailed Statistics:\n\n${statsText}`);
    console.table(stats);
  }

  /**
   * Handle daily goals update
   */
  handleUpdateDailyGoals() {
    const stepsInput = document.getElementById('settingsSteps');
    const exerciseInput = document.getElementById('settingsExercise');
    const waterInput = document.getElementById('settingsWater');

    const steps = parseInt(stepsInput.value);
    const exercise = parseInt(exerciseInput.value);
    const water = parseFloat(waterInput.value);

    // Validate inputs
    if (isNaN(steps) || steps < 1000 || steps > 50000) {
      this.showError('Steps goal must be between 1,000 and 50,000');
      return;
    }
    if (isNaN(exercise) || exercise < 5 || exercise > 300) {
      this.showError('Exercise goal must be between 5 and 300 minutes');
      return;
    }
    if (isNaN(water) || water < 0.5 || water > 10) {
      this.showError('Water goal must be between 0.5 and 10 liters');
      return;
    }

    // Update goals
    this.currentUser.dailySteps = steps;
    this.currentUser.dailyExercise = exercise;
    this.currentUser.dailyWater = water;

    this.saveData();
    this.updateDashboard();
    this.showSuccess('Daily goals updated successfully!');
  }

  /**
   * Handle weight goals update (with unit conversion)
   */
  handleUpdateWeightGoals() {
    const goalWeightInput = document.getElementById('settingsGoalWeight');
    const inputValue = parseFloat(goalWeightInput.value);

    // Convert displayed value back to lbs for storage
    const weightUnit = this.settings?.weightUnit || 'lbs';
    const goalWeight = this.convertWeight(inputValue, weightUnit, 'lbs');

    // Validate input (check ranges in appropriate unit)
    const minWeight = weightUnit === 'kg' ? 22.7 : 50; // 50 lbs = 22.7 kg
    const maxWeight = weightUnit === 'kg' ? 453.6 : 1000; // 1000 lbs = 453.6 kg

    if (isNaN(inputValue) || inputValue < minWeight || inputValue > maxWeight) {
      this.showError(
        `Goal weight must be between ${minWeight} and ${maxWeight} ${weightUnit}`
      );
      return;
    }

    if (Math.abs(goalWeight - this.currentUser.startingWeight) < 1) {
      this.showError(
        'Goal weight should be at least 1 lb different from starting weight'
      );
      return;
    }

    // Update goal weight (stored in lbs)
    this.currentUser.goalWeight = goalWeight;

    // Regenerate weight milestones
    this.initializeDefaultMilestones();

    this.saveData();
    this.updateDashboard();
    this.showSuccess('Weight goal updated successfully!');
  }

  /**
   * Export all data
   */
  exportAllData() {
    this.showProcessing('Preparing export...');

    try {
      const exportData = {
        user: this.currentUser,
        dailyLogs: this.dailyLogs,
        streaks: this.streaks,
        customRewards: this.customRewards,
        achievements: this.achievements,
        settings: this.settings,
        exportDate: new Date().toISOString(),
        exportType: 'complete',
        version: '1.0.0-localStorage',
      };

      this.downloadData(exportData, 'complete_backup');
      this.showProcessingSuccess('Export ready!');
      this.showSuccess('Complete data exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      this.showProcessingError('Export failed');
      this.showError('Failed to export data');
    }
  }

  /**
   * Export daily logs only
   */
  exportDailyLogs() {
    const exportData = {
      dailyLogs: this.dailyLogs,
      exportDate: new Date().toISOString(),
      exportType: 'logs_only',
      version: '1.1.0-localStorage',
    };

    this.downloadData(exportData, 'daily_logs');
    this.showSuccess('Daily logs exported successfully!');
  }

  /**
   * Download data as JSON file
   */
  downloadData(data, type) {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `BribeYourselfFit_${type}_${
      new Date().toISOString().split('T')[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Load all data from localStorage
   */
  loadData() {
    try {
      this.currentUser = JSON.parse(localStorage.getItem('byf_user')) || null;
      this.dailyLogs = JSON.parse(localStorage.getItem('byf_dailyLogs')) || {};
      this.streaks =
        JSON.parse(localStorage.getItem('byf_streaks')) ||
        this.initializeStreaks();
      this.customRewards =
        JSON.parse(localStorage.getItem('byf_customRewards')) || [];
      this.achievements =
        JSON.parse(localStorage.getItem('byf_achievements')) || [];

      this.settings =
        JSON.parse(localStorage.getItem('byf_settings')) ||
        this.getDefaultSettings();

      // Load theme preference
      const savedTheme = localStorage.getItem('byf_theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.updateThemeToggle(savedTheme);

      // Load settings from storage
      this.loadSettingsFromStorage();
    } catch (error) {
      console.error('Error loading data:', error);
      this.showError('Failed to load saved data. Starting fresh.');
    }
  }

  /**
   * Save all data to localStorage
   */
  saveData() {
    try {
      localStorage.setItem('byf_user', JSON.stringify(this.currentUser));
      localStorage.setItem('byf_dailyLogs', JSON.stringify(this.dailyLogs));
      localStorage.setItem('byf_streaks', JSON.stringify(this.streaks));
      localStorage.setItem(
        'byf_customRewards',
        JSON.stringify(this.customRewards)
      );
      localStorage.setItem(
        'byf_achievements',
        JSON.stringify(this.achievements)
      );
    } catch (error) {
      console.error('Error saving data:', error);
      this.showError('Failed to save data. Please try again.');
    }
  }

  /**
   * Get default settings
   */
  getDefaultSettings() {
    return {
      themePreference: 'system',
      weightUnit: 'lbs',
      dateFormat: 'US',
      weekStart: 'sunday',
      allowPartialSteps: false,
      allowPartialExercise: false,
      strictWellness: false,
    };
  }

  loadSettingsFromStorage() {
    try {
      const savedSettings = localStorage.getItem('byf_settings');
      if (savedSettings) {
        this.settings = {
          ...this.getDefaultSettings(),
          ...JSON.parse(savedSettings),
        };
      } else {
        this.settings = this.getDefaultSettings();
      }

      // Apply theme preference
      if (this.settings.themePreference === 'system') {
        this.setupSystemThemeListener();
      } else {
        document.documentElement.setAttribute(
          'data-theme',
          this.settings.themePreference
        );
        localStorage.setItem('byf_theme', this.settings.themePreference);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.settings = this.getDefaultSettings();
    }

    // Apply weight unit changes on load
    if (this.settings.weightUnit && this.settings.weightUnit !== 'lbs') {
      setTimeout(() => {
        this.updateWeightDisplays();
      }, 500);
    }
  }

  /**
   * Setup system theme preference listener
   */
  setupSystemThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleThemeChange = (e) => {
      if (this.settings.themePreference === 'system') {
        const theme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('byf_theme', theme);
        this.updateThemeToggle(theme);
      }
    };

    mediaQuery.addListener(handleThemeChange);
    // Set initial theme
    handleThemeChange(mediaQuery);
  }

  /**
   * Update all weight displays when unit changes
   */
  updateWeightDisplays() {
    const weightUnit = this.settings?.weightUnit || 'lbs';
    console.log(`🔄 Updating weight displays to ${weightUnit}`);

    if (!this.currentUser) {
      console.log('❌ No current user data available');
      return;
    }

    // Update quick stats in sidebar
    const currentWeightEl = document.getElementById('currentWeightDisplay');
    const goalWeightEl = document.getElementById('goalWeightDisplay');
    const weightToGoEl = document.getElementById('weightToGoDisplay');

    if (currentWeightEl) {
      const currentWeight = this.convertWeight(
        this.currentUser.currentWeight,
        'lbs',
        weightUnit
      );
      currentWeightEl.textContent = `${currentWeight} ${weightUnit}`;
    }

    if (goalWeightEl) {
      const goalWeight = this.convertWeight(
        this.currentUser.goalWeight,
        'lbs',
        weightUnit
      );
      goalWeightEl.textContent = `${goalWeight} ${weightUnit}`;
    }

    if (weightToGoEl) {
      const currentWeight = this.convertWeight(
        this.currentUser.currentWeight,
        'lbs',
        weightUnit
      );
      const goalWeight = this.convertWeight(
        this.currentUser.goalWeight,
        'lbs',
        weightUnit
      );
      const weightToGo = Math.abs(currentWeight - goalWeight);
      weightToGoEl.textContent = `${weightToGo.toFixed(1)} ${weightUnit}`;
    }

    // Update form labels - fix the duplicate issue
    const weightLabels = document.querySelectorAll(
      'label[for*="Weight"], label[for*="weight"]'
    );
    console.log(`Found ${weightLabels.length} weight labels to update`);

    weightLabels.forEach((label, index) => {
      const originalText = label.textContent;
      // Remove any existing unit indicators and add the current one
      let newText = originalText.replace(/\s*\([^)]*\)[^)]*$/g, ''); // Remove (lbs) or (kg) and anything after
      newText = newText.replace(/\s*-\s*(lbs|kg)\s*$/g, ''); // Remove trailing - lbs or - kg
      newText = `${newText} (${weightUnit})`;

      if (originalText !== newText) {
        label.textContent = newText;
        console.log(
          `✅ Updated label ${index}: "${originalText}" → "${newText}"`
        );
      }
    });

    // Also update settings weight labels specifically by text content
    const settingsWeightLabels = document.querySelectorAll('label');
    settingsWeightLabels.forEach((label, index) => {
      const originalText = label.textContent;

      // Check if this is a weight-related label
      if (
        originalText.includes('Starting Weight') ||
        originalText.includes('Goal Weight')
      ) {
        // Remove any existing unit indicators and add the current one
        let newText = originalText.replace(/\s*\([^)]*\)[^)]*$/g, ''); // Remove (lbs) or (kg) and anything after
        newText = newText.replace(/\s*-\s*(lbs|kg)\s*$/g, ''); // Remove trailing - lbs or - kg
        newText = `${newText} (${weightUnit})`;

        if (originalText !== newText) {
          label.textContent = newText;
          console.log(
            `✅ Updated settings label ${index}: "${originalText}" → "${newText}"`
          );
        }
      }
    });

    // Force update the dashboard form after changing units
    if (this.currentTab === 'dashboard') {
      this.loadTodaysData();
    }
    // Update any chart labels if weight chart is visible
    if (this.currentTab === 'charts') {
      setTimeout(() => {
        this.renderWeightChart();
      }, 100);
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem('byf_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  /**
   * Load settings tab content
   */
  loadSettingsTab() {
    this.updateSettingsDisplay();
  }

  /**
   * Update settings display with current values
   */
  updateSettingsDisplay() {
    // Update theme preference radio buttons
    const themePreference = this.settings.themePreference || 'system';
    const themeRadio = document.querySelector(
      `input[value="${themePreference}"]`
    );
    if (themeRadio) {
      themeRadio.checked = true;
    }

    // Update unit and format selectors
    const weightUnit = document.getElementById('weightUnit');
    const dateFormat = document.getElementById('dateFormat');
    const weekStart = document.getElementById('weekStart');

    if (weightUnit && this.settings.weightUnit) {
      weightUnit.value = this.settings.weightUnit;
    }
    if (dateFormat && this.settings.dateFormat) {
      dateFormat.value = this.settings.dateFormat;
    }
    if (weekStart && this.settings.weekStart) {
      weekStart.value = this.settings.weekStart;
    }

    // Update daily goals inputs
    if (this.currentUser) {
      const settingsSteps = document.getElementById('settingsSteps');
      const settingsExercise = document.getElementById('settingsExercise');
      const settingsWater = document.getElementById('settingsWater');
      const settingsStartingWeight = document.getElementById(
        'settingsStartingWeight'
      );
      const settingsGoalWeight = document.getElementById('settingsGoalWeight');

      if (settingsSteps) settingsSteps.value = this.currentUser.dailySteps;
      if (settingsExercise)
        settingsExercise.value = this.currentUser.dailyExercise;
      if (settingsWater) settingsWater.value = this.currentUser.dailyWater;

      // Handle weight conversion for settings inputs
      const weightUnit = this.settings?.weightUnit || 'lbs';
      if (settingsStartingWeight) {
        const displayStartingWeight = this.convertWeight(
          this.currentUser.startingWeight,
          'lbs',
          weightUnit
        );
        settingsStartingWeight.value = displayStartingWeight;
        console.log(
          '✅ Settings starting weight updated to:',
          displayStartingWeight,
          weightUnit
        );
      }
      if (settingsGoalWeight) {
        const displayGoalWeight = this.convertWeight(
          this.currentUser.goalWeight,
          'lbs',
          weightUnit
        );
        settingsGoalWeight.value = displayGoalWeight;
        console.log(
          '✅ Settings goal weight updated to:',
          displayGoalWeight,
          weightUnit
        );
      }
    }

    // Update goal threshold checkboxes
    const allowPartialSteps = document.getElementById('allowPartialSteps');
    const allowPartialExercise = document.getElementById(
      'allowPartialExercise'
    );
    const strictWellness = document.getElementById('strictWellness');

    if (allowPartialSteps)
      allowPartialSteps.checked = this.settings.allowPartialSteps || false;
    if (allowPartialExercise)
      allowPartialExercise.checked =
        this.settings.allowPartialExercise || false;
    if (strictWellness)
      strictWellness.checked = this.settings.strictWellness || false;

    // Update app info
    this.updateAppInfo();
  }

  /**
   * Update app information display
   */
  updateAppInfo() {
    const totalEntriesEl = document.getElementById('totalDataEntries');
    const storageUsedEl = document.getElementById('storageUsed');
    const profileCreatedEl = document.getElementById('profileCreated');

    if (totalEntriesEl) {
      totalEntriesEl.textContent = Object.keys(
        this.dailyLogs
      ).length.toString();
    }

    if (storageUsedEl) {
      const dataSize = JSON.stringify({
        user: this.currentUser,
        dailyLogs: this.dailyLogs,
        streaks: this.streaks,
        customRewards: this.customRewards,
        achievements: this.achievements,
        settings: this.settings,
      }).length;
      storageUsedEl.textContent = `~${Math.round(dataSize / 1024)} KB`;
    }

    if (profileCreatedEl && this.currentUser && this.currentUser.setupDate) {
      const setupDate = new Date(this.currentUser.setupDate);
      profileCreatedEl.textContent = setupDate.toLocaleDateString();
    }
  }

  /**
   * Weight unit conversion methods
   */
  convertWeight(weight, fromUnit, toUnit) {
    if (!weight || fromUnit === toUnit) return weight;

    if (fromUnit === 'lbs' && toUnit === 'kg') {
      return Math.round(weight * 0.453592 * 10) / 10; // Round to 1 decimal
    } else if (fromUnit === 'kg' && toUnit === 'lbs') {
      return Math.round((weight / 0.453592) * 10) / 10; // Round to 1 decimal
    }
    return weight;
  }

  getCurrentWeightUnit() {
    return this.settings?.weightUnit || 'lbs';
  }

  formatWeightDisplay(weight) {
    if (!weight) return '';
    const unit = this.getCurrentWeightUnit();
    return `${weight} ${unit}`;
  }

  /**
   * Initialize streak counters
   */
  initializeStreaks() {
    return {
      overall: 0,
      steps: 0,
      exercise: 0,
      water: 0,
      wellness: 0,
      lastLogDate: null,
      weeklyWeight: false,
      lastWeightDate: null,
    };
  }

  /**
   * Handle user profile setup
   */
  handleSetup(e) {
    e.preventDefault();

    const formData = new FormData(e.target);

    // Get raw values from form
    const rawValues = {
      startingWeight: formData.get('startingWeight'),
      goalWeight: formData.get('goalWeight'),
      dailySteps: formData.get('dailySteps'),
      dailyExercise: formData.get('dailyExercise'),
      dailyWater: formData.get('dailyWater'),
    };

    // Debug: Log raw form values
    console.log('Raw form values:', rawValues);

    // Parse with proper validation
    const startingWeight = parseFloat(rawValues.startingWeight);
    const goalWeight = parseFloat(rawValues.goalWeight);
    const dailySteps = parseInt(rawValues.dailySteps);
    const dailyExercise = parseInt(rawValues.dailyExercise);
    const dailyWater = parseFloat(rawValues.dailyWater);

    // Debug: Log parsed values
    console.log('Parsed values:', {
      startingWeight,
      goalWeight,
      dailySteps,
      dailyExercise,
      dailyWater,
    });

    // Check for NaN values
    if (
      isNaN(startingWeight) ||
      isNaN(goalWeight) ||
      isNaN(dailySteps) ||
      isNaN(dailyExercise) ||
      isNaN(dailyWater)
    ) {
      console.error('Form parsing failed - NaN values detected:', {
        startingWeight,
        goalWeight,
        dailySteps,
        dailyExercise,
        dailyWater,
      });
      this.showError(
        'Invalid form data. Please check all fields have valid numbers.'
      );
      return;
    }

    // Validate input
    if (
      !this.validateSetupData(
        startingWeight,
        goalWeight,
        dailySteps,
        dailyExercise,
        dailyWater
      )
    ) {
      return;
    }

    // Create user profile
    this.currentUser = {
      startingWeight,
      goalWeight,
      currentWeight: startingWeight,
      dailySteps,
      dailyExercise,
      dailyWater,
      setupDate: new Date().toISOString(),
      lastWeightUpdate: new Date().toISOString(),
    };

    // Initialize streaks
    this.streaks = this.initializeStreaks();

    // Save and show app
    this.saveData();
    this.showAppScreen();
    this.updateDashboard();
    this.initializeDefaultMilestones();

    this.showSuccess(
      'Profile created successfully! Start logging your fitness journey.'
    );
  }

  /**
   * Validate setup form data
   */
  validateSetupData(
    startingWeight,
    goalWeight,
    dailySteps,
    dailyExercise,
    dailyWater
  ) {
    // First check for NaN values
    if (
      isNaN(startingWeight) ||
      isNaN(goalWeight) ||
      isNaN(dailySteps) ||
      isNaN(dailyExercise) ||
      isNaN(dailyWater)
    ) {
      this.showError('Please enter valid numbers in all fields');
      return false;
    }
    if (startingWeight < 50 || startingWeight > 1000) {
      this.showError('Starting weight must be between 50-1000 lbs');
      return false;
    }
    if (goalWeight < 50 || goalWeight > 1000) {
      this.showError('Goal weight must be between 50-1000 lbs');
      return false;
    }
    if (Math.abs(startingWeight - goalWeight) < 1) {
      this.showError('Starting and goal weight should be at least 1 lb apart');
      return false;
    }
    if (dailySteps < 1000 || dailySteps > 50000) {
      this.showError('Daily steps goal must be between 1,000-50,000');
      return false;
    }
    if (dailyExercise < 5 || dailyExercise > 300) {
      this.showError('Daily exercise goal must be between 5-300 minutes');
      return false;
    }
    if (dailyWater < 0.5 || dailyWater > 10) {
      this.showError('Daily water goal must be between 0.5-10 liters');
      return false;
    }
    return true;
  }

  /**
   * Handle daily log submission - FIXED VERSION
   */
  async handleDailyLog(e) {
    e.preventDefault();

    // Show processing indicator at the start
    this.showProcessing('Saving daily log...');

    try {
      this.debugFormSave(); // Add this line for debugging

      const today = this.currentDate;

      // Get form values - CORRECTED VERSION (same fix as before)
      const weightInput = document.getElementById('todayWeight');
      const stepsInput = document.getElementById('todaySteps');
      const exerciseInput = document.getElementById('todayExerciseMinutes');
      const waterInput = document.getElementById('todayWater');

      // Check if inputs exist and have values
      const weight =
        weightInput && weightInput.value !== ''
          ? parseFloat(weightInput.value)
          : null;
      const steps =
        stepsInput && stepsInput.value !== '' ? parseInt(stepsInput.value) : 0;
      const exerciseMinutes =
        exerciseInput && exerciseInput.value !== ''
          ? parseInt(exerciseInput.value)
          : 0;
      const water =
        waterInput && waterInput.value !== ''
          ? parseFloat(waterInput.value)
          : 0;

      // Debug what we're actually getting (you can remove these console.log lines later)
      console.log('Input elements:', {
        weightInput,
        stepsInput,
        exerciseInput,
        waterInput,
      });
      console.log('Raw values:', {
        weight: weightInput?.value,
        steps: stepsInput?.value,
        exercise: exerciseInput?.value,
        water: waterInput?.value,
      });
      console.log('Parsed values:', { weight, steps, exerciseMinutes, water });

      // Get selected exercise types
      const exerciseTypes = Array.from(
        document.querySelectorAll('.exercise-checkbox:checked')
      ).map((cb) => cb.value);

      // Get wellness score
      const wellnessItems = Array.from(
        document.querySelectorAll('.wellness-checkbox:checked')
      ).map((cb) => cb.dataset.wellness);
      const wellnessScore = wellnessItems.length;

      // Debug log to see what we're getting
      console.log('Form data collected:', {
        weight,
        steps,
        exerciseMinutes,
        water,
        exerciseTypes,
        wellnessScore,
      });

      // Validate data
      if (
        !(await this.validateDailyLog(
          weight,
          steps,
          exerciseMinutes,
          water,
          exerciseTypes
        ))
      ) {
        // Hide processing indicator if validation fails
        this.hideProcessing();
        return;
      }

      // Update processing message
      this.showProcessing('Processing data...');

      // Create daily log entry
      const logEntry = {
        date: today,
        weight,
        steps,
        exerciseMinutes,
        exerciseTypes,
        water,
        wellnessScore,
        wellnessItems,
        timestamp: new Date().toISOString(),
      };

      console.log('Saving log entry:', logEntry); // Debug log

      // Save log entry
      this.dailyLogs[today] = logEntry;

      // Update user's current weight if provided
      if (weight) {
        this.currentUser.currentWeight = weight;
        this.currentUser.lastWeightUpdate = new Date().toISOString();
      }

      // Update streaks
      this.updateStreaks(logEntry);

      // Save all data
      this.saveData();

      // Update dashboard
      this.updateDashboard();

      // Check for achievements
      this.checkAchievements();

      // Show success processing indicator
      this.showProcessingSuccess('Daily log saved!');

      // Performance check for large datasets
      const logCount = Object.keys(this.dailyLogs).length;
      if (logCount > 365) {
        // More than 1 year of data
        console.log(`Performance: Managing ${logCount} daily logs`);
        // Optionally compress old data or suggest export
        if (logCount > 730 && logCount % 30 === 0) {
          // Every 30 entries after 2 years
          this.showSuccess(
            `Daily log saved! You have ${logCount} entries. Consider exporting older data for better performance.`
          );
          return;
        }
      }

      this.showSuccess('Daily log saved successfully!');
    } catch (error) {
      console.error('Daily log save error:', error);
      this.showProcessingError('Save failed');
      this.showError('Failed to save daily log');
    }
  }

  /**
   * Validate daily log data with confirmation prompts for unusual values
   */
  async validateDailyLog(weight, steps, exerciseMinutes, water, exerciseTypes) {
    // Validate weight
    if (
      weight &&
      (weight < this.validationRanges.weight.min ||
        weight > this.validationRanges.weight.max)
    ) {
      if (!(await this.confirmUnusualValue('weight', weight, 'lbs')))
        return false;
    }

    // Validate steps
    if (steps > this.validationRanges.steps.max) {
      if (!(await this.confirmUnusualValue('steps', steps, 'steps')))
        return false;
    }

    // Validate exercise minutes
    if (exerciseMinutes > this.validationRanges.exercise.max) {
      if (
        !(await this.confirmUnusualValue(
          'exercise',
          exerciseMinutes,
          'minutes'
        ))
      )
        return false;
    }

    // Validate water
    if (water > this.validationRanges.water.max) {
      if (!(await this.confirmUnusualValue('water', water, 'liters')))
        return false;
    }

    // Validate exercise types are selected if exercise minutes > 0
    if (exerciseMinutes > 0 && exerciseTypes.length === 0) {
      this.showError(
        'Please select at least one exercise type when logging exercise minutes.'
      );
      return false;
    }

    return true;
  }

  /**
   * Show confirmation dialog for unusual values
   */
  confirmUnusualValue(type, value, unit) {
    return new Promise((resolve) => {
      const message = `The ${type} value of ${value} ${unit} seems unusually high. Please confirm this is correct.`;
      if (confirm(message)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }

  /**
   * Update streak counters based on daily log
   */
  updateStreaks(logEntry) {
    const today = logEntry.date;
    const yesterday = this.getDateOffset(today, -1);

    // Check if goals are met (applying user's threshold settings)
    const stepsThreshold = this.settings?.allowPartialSteps
      ? this.currentUser.dailySteps * 0.9
      : this.currentUser.dailySteps;

    const exerciseThreshold = this.settings?.allowPartialExercise
      ? this.currentUser.dailyExercise * 0.8
      : this.currentUser.dailyExercise;

    const wellnessThreshold = this.settings?.strictWellness ? 4 : 3;

    const goalsMetToday = {
      steps: logEntry.steps >= stepsThreshold,
      exercise: logEntry.exerciseMinutes >= exerciseThreshold,
      water: logEntry.water >= this.currentUser.dailyWater,
      wellness: logEntry.wellnessScore >= wellnessThreshold,
    };

    // Check if weight was logged this week
    const weeklyWeightMet = this.checkWeeklyWeight(today);

    // Update daily consecutive streaks
    this.updateDailyStreaks(today, yesterday, goalsMetToday);

    // Update overall streak (requires all daily goals + weekly weight)
    const allDailyGoalsMet = Object.values(goalsMetToday).every((met) => met);
    if (allDailyGoalsMet && weeklyWeightMet) {
      if (this.streaks.lastLogDate === yesterday) {
        this.streaks.overall++;
      } else {
        this.streaks.overall = 1;
      }
    } else {
      this.streaks.overall = 0;
    }

    // Update last log date
    this.streaks.lastLogDate = today;
    this.streaks.weeklyWeight = weeklyWeightMet;
  }

  /**
   * Update individual daily consecutive streaks
   */
  updateDailyStreaks(today, yesterday, goalsMetToday) {
    const streakTypes = ['steps', 'exercise', 'water', 'wellness'];

    streakTypes.forEach((type) => {
      if (goalsMetToday[type]) {
        if (this.streaks.lastLogDate === yesterday) {
          this.streaks[type]++;
        } else {
          this.streaks[type] = 1;
        }
      } else {
        this.streaks[type] = 0;
      }
    });
  }

  /**
   * Check if weight requirement is met for this week
   */
  checkWeeklyWeight(date) {
    const currentWeekStart = this.getWeekStart(date);
    const weekDates = [];

    // Get all dates in current week
    for (let i = 0; i < 7; i++) {
      weekDates.push(this.getDateOffset(currentWeekStart, i));
    }

    // Check if weight was logged any day this week
    return weekDates.some((weekDate) => {
      const log = this.dailyLogs[weekDate];
      return log && log.weight !== null;
    });
  }

  /**
   * Get the start of the week (Monday) for a given date
   */
  getWeekStart(dateString) {
    const date = new Date(dateString);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const weekStart = new Date(date.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  }

  /**
   * Get date with offset
   */
  getDateOffset(dateString, offset) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
  }

  /**
   * Update wellness score display
   */
  updateWellnessScore() {
    const checkedBoxes = document.querySelectorAll(
      '.wellness-checkbox:checked'
    );
    const score = checkedBoxes.length;

    // Update score indicators
    const indicators = document.querySelectorAll('.score-indicator');
    indicators.forEach((indicator, index) => {
      if (index < score) {
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active');
      }
    });

    // Update score text
    const scoreText = document.getElementById('wellnessScoreText');
    if (scoreText) {
      scoreText.textContent = `${score}/5`;
    }

    // Update wellness items styling
    const wellnessItems = document.querySelectorAll('.wellness-item');
    wellnessItems.forEach((item, index) => {
      const checkbox = item.querySelector('.wellness-checkbox');
      if (checkbox && checkbox.checked) {
        item.classList.add('completed');
      } else {
        item.classList.remove('completed');
      }
    });
  }

  /**
   * Update exercise type selection styling
   */
  updateExerciseSelection() {
    const exerciseOptions = document.querySelectorAll('.exercise-option');
    exerciseOptions.forEach((option) => {
      const checkbox = option.querySelector('.exercise-checkbox');
      if (checkbox && checkbox.checked) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
  }

  /**
   * Update dashboard display
   */
  updateDashboard() {
    this.updateStreakDisplay();
    this.updateQuickStats();
    this.updateWeightStatus();
    this.loadTodaysData();
    this.updateWellnessScore();
    this.updateExerciseSelection();
  }

  /**
   * Update streak display in sidebar
   */
  updateStreakDisplay() {
    // Main streak counter
    const currentStreakEl = document.getElementById('currentStreak');
    if (currentStreakEl) {
      currentStreakEl.textContent = this.streaks.overall;
    }

    // Individual streak counters
    const streakTypes = ['steps', 'exercise', 'water', 'wellness'];
    streakTypes.forEach((type) => {
      const streakEl = document.getElementById(`${type}Streak`);
      if (streakEl) {
        const valueEl = streakEl.querySelector('.streak-value');
        if (valueEl) {
          valueEl.textContent = this.streaks[type];
        }

        // Add active class if streak > 0
        if (this.streaks[type] > 0) {
          streakEl.classList.add('active');
        } else {
          streakEl.classList.remove('active');
        }
      }
    });
  }

  /**
   * Update quick stats display
   */
  updateQuickStats() {
    const currentWeightEl = document.getElementById('currentWeightDisplay');
    const goalWeightEl = document.getElementById('goalWeightDisplay');
    const weightToGoEl = document.getElementById('weightToGoDisplay');

    if (currentWeightEl && this.currentUser) {
      currentWeightEl.textContent = `${this.currentUser.currentWeight} lbs`;
    }

    if (goalWeightEl && this.currentUser) {
      goalWeightEl.textContent = `${this.currentUser.goalWeight} lbs`;
    }

    if (weightToGoEl && this.currentUser) {
      const weightToGo = Math.abs(
        this.currentUser.currentWeight - this.currentUser.goalWeight
      );
      weightToGoEl.textContent = `${weightToGo.toFixed(1)} lbs`;
    }
  }

  /**
   * Update weight status indicator
   */
  updateWeightStatus() {
    const weightStatusEl = document.getElementById('weightStatus');
    if (!weightStatusEl) return;

    const weeklyWeightMet = this.checkWeeklyWeight(this.currentDate);
    if (weeklyWeightMet) {
      weightStatusEl.textContent = '✅ Logged this week';
      weightStatusEl.style.color = 'var(--accent-success)';
    } else {
      weightStatusEl.textContent = '⚠️ Not logged this week';
      weightStatusEl.style.color = 'var(--accent-warning)';
    }
  }

  /**
   * Load today's data into the form - FIXED VERSION
   */
  loadTodaysData() {
    const todaysLog = this.dailyLogs[this.currentDate];

    console.log("Loading today's data for:", this.currentDate, todaysLog); // Debug log

    if (!todaysLog) return;

    // Load form values - Make sure we're targeting the right elements
    const weightInput = document.getElementById('todayWeight');
    const stepsInput = document.getElementById('todaySteps');
    const exerciseInput = document.getElementById('todayExerciseMinutes');
    const waterInput = document.getElementById('todayWater');

    if (
      weightInput &&
      todaysLog.weight !== null &&
      todaysLog.weight !== undefined
    ) {
      const weightUnit = this.settings?.weightUnit || 'lbs';
      const displayWeight =
        weightUnit === 'kg'
          ? (todaysLog.weight * 0.453592).toFixed(1)
          : todaysLog.weight;
      weightInput.value = displayWeight;
      console.log(`📝 Loaded today's weight: ${displayWeight} ${weightUnit}`);
    }
    if (stepsInput && todaysLog.steps) {
      stepsInput.value = todaysLog.steps;
    }
    if (exerciseInput && todaysLog.exerciseMinutes) {
      exerciseInput.value = todaysLog.exerciseMinutes;
    }
    if (waterInput && todaysLog.water) {
      waterInput.value = todaysLog.water;
    }

    // Clear existing exercise type selections first
    document
      .querySelectorAll('.exercise-checkbox')
      .forEach((cb) => (cb.checked = false));

    // Load exercise types
    if (todaysLog.exerciseTypes && todaysLog.exerciseTypes.length > 0) {
      todaysLog.exerciseTypes.forEach((type) => {
        const checkbox = document.getElementById(type);
        if (checkbox) {
          checkbox.checked = true;
        }
      });
    }

    // Clear existing wellness selections first
    document
      .querySelectorAll('.wellness-checkbox')
      .forEach((cb) => (cb.checked = false));

    // Load wellness items
    if (todaysLog.wellnessItems && todaysLog.wellnessItems.length > 0) {
      todaysLog.wellnessItems.forEach((item) => {
        const checkbox = document.querySelector(`[data-wellness="${item}"]`);
        if (checkbox) {
          checkbox.checked = true;
        }
      });
    }

    // Update displays after loading data
    this.updateWellnessScore();
    this.updateExerciseSelection();
  }

  /**
   * Switch between tabs - CORRECTED VERSION
   */
  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update tab content - FIXED LOGIC
    document.querySelectorAll('.tab-content').forEach((content) => {
      if (content.id === `${tabName}Tab`) {
        content.classList.remove('hidden');
        content.classList.add('active');
        content.style.display = 'block'; // Force display
      } else {
        content.classList.add('hidden');
        content.classList.remove('active');
        content.style.display = 'none'; // Force hide
      }
    });

    // Load tab-specific content with error handling
    try {
      if (tabName === 'charts') {
        console.log('Loading charts tab...');
        this.loadChartsTab();
      } else if (tabName === 'rewards') {
        console.log('Loading rewards tab...');
        this.loadRewardsTab();
      } else if (tabName === 'settings') {
        console.log('Loading settings tab...');
        this.loadSettingsTab();
      }
    } catch (error) {
      console.error(`Error loading ${tabName} tab:`, error);
    }
  }

  /**
   * Load charts tab content - MOBILE OPTIMIZED VERSION
   */
  loadChartsTab() {
    console.log('Loading charts tab...');
    this.showProcessing('Loading charts...');

    // Check if mobile device
    const isMobile = window.innerWidth <= 768;
    const delay = isMobile ? 300 : 100; // Longer delay on mobile

    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          // Render charts one by one on mobile to reduce load
          if (isMobile) {
            this.renderWeightChart();
            setTimeout(() => this.renderActivityChart(), 150);
            setTimeout(() => this.renderStreakCalendar(), 300);
          } else {
            // Render all at once on desktop
            this.renderWeightChart();
            this.renderActivityChart();
            this.renderStreakCalendar();
          }
          console.log('Charts rendered successfully');
          this.showProcessingSuccess('Charts loaded!');
        } catch (error) {
          console.error('Error rendering charts:', error);
          this.showProcessingError('Chart loading failed');
        }
      }, delay);
    });
  }

  /**
   * Set chart period and update charts
   */
  setChartPeriod(period) {
    this.chartPeriod = period;

    // Update chart button states
    document.querySelectorAll('.chart-btn').forEach((btn) => {
      if (
        (btn.dataset.period && parseInt(btn.dataset.period) === period) ||
        (btn.dataset.period === 'all' && period === 'all')
      ) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Re-render charts
    this.renderWeightChart();
    this.renderActivityChart();
  }

  /**
   * Render weight progress chart using Canvas - FIXED SIZING
   */
  renderWeightChart() {
    const canvas = document.getElementById('weightChart');
    if (!canvas) return;

    // Force canvas to have dimensions BEFORE getting context
    const container = canvas.parentElement;
    const isMobile = window.innerWidth <= 768;

    // Use lower resolution on mobile for better performance
    const pixelRatio = isMobile ? 1 : window.devicePixelRatio || 1;
    const containerWidth = container.offsetWidth || (isMobile ? 350 : 800);
    const containerHeight = container.offsetHeight || (isMobile ? 250 : 400);

    // Set canvas size with pixel ratio optimization
    canvas.width = containerWidth * pixelRatio;
    canvas.height = containerHeight * pixelRatio;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    const width = containerWidth;
    const height = containerHeight;

    // Rest of your chart code continues here...
    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    // ... continue with existing chart code

    // Get weight data - ADD THIS HERE
    const weightData = this.getWeightData();
    if (weightData.length === 0) {
      this.drawNoDataMessage(ctx, width, height, 'No weight data available');
      return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate scales
    const weightUnit = this.settings?.weightUnit || 'lbs';
    const weights = weightData.map((d) => d.weight);

    // Convert goal and starting weights for proper chart scaling
    const goalWeightForChart =
      weightUnit === 'kg'
        ? this.currentUser.goalWeight * 0.453592
        : this.currentUser.goalWeight;
    const startingWeightForChart =
      weightUnit === 'kg'
        ? this.currentUser.startingWeight * 0.453592
        : this.currentUser.startingWeight;

    const minWeight = Math.min(...weights, goalWeightForChart) - 5;
    const maxWeight = Math.max(...weights, startingWeightForChart) + 5;

    console.log(
      `📊 Chart scale: ${minWeight.toFixed(1)} - ${maxWeight.toFixed(
        1
      )} ${weightUnit}`
    );

    // Calculate chart area dimensions
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Define scale functions
    const xScale = (index) =>
      padding.left + (index / (weightData.length - 1)) * chartWidth;

    const yScale = (weight) =>
      padding.top +
      (1 - (weight - minWeight) / (maxWeight - minWeight)) * chartHeight;

    // Draw grid lines
    ctx.strokeStyle = getComputedStyle(
      document.documentElement
    ).getPropertyValue('--border-color');
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const weight = minWeight + (maxWeight - minWeight) * (i / 5);
      const y = yScale(weight);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Weight labels
      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue('--text-secondary');
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      const weightUnit = this.settings?.weightUnit || 'lbs';
      ctx.fillText(
        `${weight.toFixed(0)} ${weightUnit}`,
        padding.left - 10,
        y + 4
      );
    }

    // Draw goal line
    if (goalWeightForChart >= minWeight && goalWeightForChart <= maxWeight) {
      const goalY = yScale(goalWeightForChart);
      ctx.strokeStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue('--accent-success');
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, goalY);
      ctx.lineTo(width - padding.right, goalY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Goal label
      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue('--accent-success');
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      const goalWeight =
        weightUnit === 'kg'
          ? (this.currentUser.goalWeight * 0.453592).toFixed(0)
          : this.currentUser.goalWeight;
      ctx.fillText(
        `Goal: ${goalWeight} ${weightUnit}`,
        width - padding.right - 100,
        goalY - 10
      );
    }

    // Draw weight line
    ctx.strokeStyle = getComputedStyle(
      document.documentElement
    ).getPropertyValue('--accent-primary');
    ctx.lineWidth = 3;
    ctx.beginPath();
    weightData.forEach((data, index) => {
      const x = xScale(index);
      const y = yScale(data.weight);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw data points
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
      '--accent-primary'
    );
    weightData.forEach((data, index) => {
      const x = xScale(index);
      const y = yScale(data.weight);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw trend indicator
    this.updateWeightTrend(weightData);
  }

  /**
   * Get filtered weight data based on chart period with unit conversion
   */
  getWeightData() {
    const weightUnit = this.settings?.weightUnit || 'lbs';

    const weightEntries = Object.values(this.dailyLogs)
      .filter((log) => log.weight !== null)
      .map((log) => {
        const displayWeight =
          weightUnit === 'kg' ? log.weight * 0.453592 : log.weight;
        return {
          date: log.date,
          weight: displayWeight,
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (this.chartPeriod === 'all') {
      return weightEntries;
    }

    const cutoffDate = this.getDateOffset(this.currentDate, -this.chartPeriod);
    return weightEntries.filter((entry) => entry.date >= cutoffDate);
  }

  /**
   * Update weight trend indicator
   */
  updateWeightTrend(weightData) {
    const trendEl = document.getElementById('weightTrend');
    if (!trendEl || weightData.length < 2) return;

    const firstWeight = weightData[0].weight;
    const lastWeight = weightData[weightData.length - 1].weight;
    const change = lastWeight - firstWeight;

    if (Math.abs(change) < 0.1) {
      trendEl.textContent = 'Stable';
      trendEl.style.color = 'var(--text-secondary)';
    } else if (change < 0) {
      trendEl.textContent = `↓ ${Math.abs(change).toFixed(1)} lbs`;
      trendEl.style.color = 'var(--accent-success)';
    } else {
      trendEl.textContent = `↑ ${change.toFixed(1)} lbs`;
      trendEl.style.color = 'var(--accent-danger)';
    }
  }

  /**
   * Render activity summary chart using Canvas
   */
  renderActivityChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    // Force canvas to have dimensions BEFORE getting context
    const container = canvas.parentElement;
    const isMobile = window.innerWidth <= 768;

    // Use lower resolution on mobile for better performance
    const pixelRatio = isMobile ? 1 : window.devicePixelRatio || 1;
    const containerWidth = container.offsetWidth || (isMobile ? 350 : 800);
    const containerHeight = container.offsetHeight || (isMobile ? 250 : 400);

    // Set canvas size with pixel ratio optimization
    canvas.width = containerWidth * pixelRatio;
    canvas.height = containerHeight * pixelRatio;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';

    // Scale context for crisp rendering
    const ctx = canvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    const width = containerWidth;
    const height = containerHeight;

    // Get activity data
    const activityData = this.getActivityData();
    if (activityData.length === 0) {
      this.drawNoDataMessage(ctx, width, height, 'No activity data available');
      return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Define chart dimensions and padding
    const padding = { top: 40, right: 40, bottom: 80, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate bar dimensions
    const barWidth = (chartWidth / activityData.length) * 0.8;
    const barSpacing = (chartWidth / activityData.length) * 0.2;

    // Find max values for scaling
    const maxSteps = Math.max(
      ...activityData.map((d) => d.steps),
      this.currentUser.dailySteps
    );
    const maxExercise = Math.max(
      ...activityData.map((d) => d.exercise),
      this.currentUser.dailyExercise
    );
    const maxWater = Math.max(
      ...activityData.map((d) => d.water),
      this.currentUser.dailyWater
    );

    // Draw goal lines
    this.drawGoalLines(ctx, padding, chartWidth, chartHeight, {
      steps: this.currentUser.dailySteps / maxSteps,
      exercise: this.currentUser.dailyExercise / maxExercise,
      water: this.currentUser.dailyWater / maxWater,
    });

    // Draw bars
    activityData.forEach((data, index) => {
      const x = padding.left + index * (barWidth + barSpacing) + barSpacing / 2;

      // Steps bar (normalized)
      const stepsHeight = (data.steps / maxSteps) * chartHeight;
      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue('--accent-primary');
      ctx.fillRect(
        x,
        padding.top + chartHeight - stepsHeight,
        barWidth / 3,
        stepsHeight
      );

      // Exercise bar (normalized)
      const exerciseHeight = (data.exercise / maxExercise) * chartHeight;
      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue('--accent-success');
      ctx.fillRect(
        x + barWidth / 3,
        padding.top + chartHeight - exerciseHeight,
        barWidth / 3,
        exerciseHeight
      );

      // Water bar (normalized)
      const waterHeight = (data.water / maxWater) * chartHeight;
      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue('--accent-warning');
      ctx.fillRect(
        x + (barWidth * 2) / 3,
        padding.top + chartHeight - waterHeight,
        barWidth / 3,
        waterHeight
      );

      // Date labels
      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue('--text-secondary');
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const dateLabel = new Date(data.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      ctx.fillText(dateLabel, x + barWidth / 2, height - padding.bottom + 20);
    });

    // Draw legend
    this.drawActivityLegend(ctx, width, height, padding);

    // Update period indicator
    const periodEl = document.getElementById('activityPeriod');
    if (periodEl) {
      periodEl.textContent =
        this.chartPeriod === 'all'
          ? 'All Time'
          : `Last ${this.chartPeriod} Days`;
    }
  }

  /**
   * Draw goal lines on activity chart
   */
  drawGoalLines(ctx, padding, chartWidth, chartHeight, goalRatios) {
    ctx.strokeStyle = getComputedStyle(
      document.documentElement
    ).getPropertyValue('--text-secondary');
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    Object.values(goalRatios).forEach((ratio) => {
      const y = padding.top + chartHeight * (1 - ratio);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    });

    ctx.setLineDash([]);
  }

  /**
   * Draw activity chart legend
   */
  drawActivityLegend(ctx, width, height, padding) {
    const legendY = height - padding.bottom + 40;
    const legendItems = [
      { color: '--accent-primary', label: 'Steps' },
      { color: '--accent-success', label: 'Exercise (min)' },
      { color: '--accent-warning', label: 'Water (L)' },
    ];

    let legendX = padding.left;
    legendItems.forEach((item) => {
      // Color square
      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue(item.color);
      ctx.fillRect(legendX, legendY, 12, 12);

      // Label
      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue('--text-primary');
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 16, legendY + 9);

      legendX += ctx.measureText(item.label).width + 40;
    });
  }

  /**
   * Get filtered activity data based on chart period
   */
  getActivityData() {
    let logs = Object.values(this.dailyLogs);

    if (this.chartPeriod !== 'all') {
      const cutoffDate = this.getDateOffset(
        this.currentDate,
        -this.chartPeriod
      );
      logs = logs.filter((log) => log.date >= cutoffDate);
    }

    return logs
      .map((log) => ({
        date: log.date,
        steps: log.steps || 0,
        exercise: log.exerciseMinutes || 0,
        water: log.water || 0,
        wellness: log.wellnessScore || 0,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Draw "no data" message on canvas
   */
  drawNoDataMessage(ctx, width, height, message) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
      '--text-secondary'
    );
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2);
  }

  /**
   * Render streak calendar
   */
  renderStreakCalendar() {
    const calendarContainer = document.getElementById('streakCalendar');
    if (!calendarContainer) return;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    this.currentCalendarMonth = currentMonth;
    this.currentCalendarYear = currentYear;

    this.renderCalendarMonth(currentMonth, currentYear);
  }

  /**
   * Navigate calendar months
   */
  navigateCalendar(direction) {
    this.currentCalendarMonth += direction;

    if (this.currentCalendarMonth > 11) {
      this.currentCalendarMonth = 0;
      this.currentCalendarYear++;
    } else if (this.currentCalendarMonth < 0) {
      this.currentCalendarMonth = 11;
      this.currentCalendarYear--;
    }

    this.renderCalendarMonth(
      this.currentCalendarMonth,
      this.currentCalendarYear
    );
  }

  /**
   * Render calendar for specific month
   */
  renderCalendarMonth(month, year) {
    const calendarContainer = document.getElementById('streakCalendar');
    const monthNameEl = document.getElementById('currentMonth');

    if (!calendarContainer || !monthNameEl) return;

    // Update month display
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    monthNameEl.textContent = `${monthNames[month]} ${year}`;

    // Clear existing calendar
    calendarContainer.innerHTML = '';

    // Create calendar grid
    const calendarGrid = document.createElement('div');
    calendarGrid.className = 'calendar-grid';

    // Add day headers
    const dayHeaders = document.createElement('div');
    dayHeaders.className = 'calendar-header';
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach((day) => {
      const dayLabel = document.createElement('div');
      dayLabel.className = 'calendar-day-label';
      dayLabel.textContent = day;
      dayHeaders.appendChild(dayLabel);
    });

    calendarContainer.appendChild(dayHeaders);

    // Calculate first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Adjust for Monday start

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'calendar-day other-month';
      calendarGrid.appendChild(emptyDay);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.textContent = day;

      const dateString = `${year}-${String(month + 1).padStart(
        2,
        '0'
      )}-${String(day).padStart(2, '0')}`;
      const dayLog = this.dailyLogs[dateString];

      // Apply styling based on streak completion
      if (dateString === this.currentDate) {
        dayEl.classList.add('today');
      }

      if (dayLog) {
        const goalsmet = this.checkDayGoalsMet(dayLog);
        if (goalsmet.all) {
          dayEl.classList.add('streak-complete');
        } else if (goalsmet.some) {
          dayEl.classList.add('partial-complete');
        }
      } else {
        dayEl.classList.add('no-data');
      }

      calendarGrid.appendChild(dayEl);
    }

    calendarContainer.appendChild(calendarGrid);
  }

  /**
   * Check if day's goals were met (with settings consideration)
   */
  checkDayGoalsMet(dayLog) {
    // Apply user's goal threshold settings
    const stepsThreshold = this.settings?.allowPartialSteps
      ? this.currentUser.dailySteps * 0.9
      : this.currentUser.dailySteps;

    const exerciseThreshold = this.settings?.allowPartialExercise
      ? this.currentUser.dailyExercise * 0.8
      : this.currentUser.dailyExercise;

    const wellnessThreshold = this.settings?.strictWellness ? 4 : 3;

    const goalsmet = {
      steps: dayLog.steps >= stepsThreshold,
      exercise: dayLog.exerciseMinutes >= exerciseThreshold,
      water: dayLog.water >= this.currentUser.dailyWater,
      wellness: dayLog.wellnessScore >= wellnessThreshold,
    };

    const weeklyWeight = this.checkWeeklyWeight(dayLog.date);

    return {
      some: Object.values(goalsmet).some((met) => met),
      all: Object.values(goalsmet).every((met) => met) && weeklyWeight,
    };
  }

  /**
   * Load rewards tab content
   */
  loadRewardsTab() {
    this.renderDefaultMilestones();
    this.renderCustomRewards();
    this.renderAchievementHistory();
  }

  /**
   * Initialize default milestones
   */
  initializeDefaultMilestones() {
    this.defaultMilestones = [
      // Streak milestones
      {
        type: 'streak',
        value: 7,
        title: '7 Day Streak',
        description: 'Complete 7 consecutive days of goals',
      },
      {
        type: 'streak',
        value: 14,
        title: '2 Week Streak',
        description: 'Complete 14 consecutive days of goals',
      },
      {
        type: 'streak',
        value: 30,
        title: '30 Day Streak',
        description: 'Complete 30 consecutive days of goals',
      },
      {
        type: 'streak',
        value: 50,
        title: '50 Day Streak',
        description: 'Complete 50 consecutive days of goals',
      },
      {
        type: 'streak',
        value: 100,
        title: '100 Day Streak',
        description: 'Complete 100 consecutive days of goals',
      },

      // Weight loss milestones (10 lb increments)
      ...this.generateWeightMilestones(),
    ];
  }

  /**
   * Generate weight loss milestones based on user's goals (with custom rewards integration - no duplicates)
   */
  generateWeightMilestones() {
    if (!this.currentUser) return [];

    const milestones = [];
    const totalWeightToLose =
      this.currentUser.startingWeight - this.currentUser.goalWeight;

    if (totalWeightToLose <= 0) return milestones;

    // Add default weight milestones (every 10 lbs)
    for (let lost = 10; lost <= totalWeightToLose; lost += 10) {
      milestones.push({
        type: 'weight',
        value: lost,
        title: `${lost} lbs Lost`,
        description: `Lost ${lost} pounds from starting weight`,
      });
    }

    // Add bonus milestones (every 25 lbs)
    for (let lost = 25; lost <= totalWeightToLose; lost += 25) {
      milestones.push({
        type: 'weight',
        value: lost,
        title: `${lost} lbs Lost - BIG WIN!`,
        description: `Amazing achievement: Lost ${lost} pounds!`,
        isBig: true,
      });
    }

    // Add major milestones (every 50 lbs)
    for (let lost = 50; lost <= totalWeightToLose; lost += 50) {
      milestones.push({
        type: 'weight',
        value: lost,
        title: `${lost} lbs Lost - MAJOR MILESTONE!`,
        description: `Incredible transformation: Lost ${lost} pounds!`,
        isMajor: true,
      });
    }

    // Add custom rewards ONLY if they don't match default milestone values
    const defaultMilestoneValues = new Set();

    // Collect all default milestone values (weight milestones + streak milestones)
    milestones.forEach((milestone) =>
      defaultMilestoneValues.add(`${milestone.type}-${milestone.value}`)
    );

    // Add default streak values
    [7, 14, 30, 50, 100].forEach((days) =>
      defaultMilestoneValues.add(`streak-${days}`)
    );

    this.customRewards.forEach((reward) => {
      const rewardKey = `${reward.type}-${
        reward.weightLoss || reward.streakDays
      }`;

      // Only add as separate milestone if it's NOT a default milestone value
      if (!defaultMilestoneValues.has(rewardKey)) {
        if (reward.type === 'weight' && reward.weightLoss) {
          milestones.push({
            type: 'weight',
            value: reward.weightLoss,
            title: `${reward.weightLoss} lbs Lost - Custom Reward`,
            description: `Custom milestone: ${reward.description}`,
            isCustom: true,
            customReward: reward,
          });
        } else if (reward.type === 'streak' && reward.streakDays) {
          milestones.push({
            type: 'streak',
            value: reward.streakDays,
            title: `${reward.streakDays} Day Streak - Custom Reward`,
            description: `Custom milestone: ${reward.description}`,
            isCustom: true,
            customReward: reward,
          });
        }
      }
    });

    console.log(
      `🎯 Generated ${milestones.length} milestones (excluded ${
        this.customRewards.length - milestones.filter((m) => m.isCustom).length
      } duplicate default rewards)`
    );

    return milestones;
  }

  /**
   * Render default milestones
   */
  renderDefaultMilestones() {
    const container = document.getElementById('defaultMilestones');
    if (!container) return;

    container.innerHTML = '';

    // Initialize default milestones if they don't exist
    if (!this.defaultMilestones) {
      this.initializeDefaultMilestones();
    }

    // Safety check in case defaultMilestones is still undefined
    if (!this.defaultMilestones || !Array.isArray(this.defaultMilestones)) {
      container.innerHTML =
        '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Unable to load milestones. Please refresh the page.</p>';
      return;
    }

    this.defaultMilestones.forEach((milestone) => {
      const milestoneEl = this.createMilestoneElement(milestone);
      container.appendChild(milestoneEl);
    });
  }

  /**
   * Create milestone element with editing capability
   */
  createMilestoneElement(milestone) {
    const el = document.createElement('div');
    el.className = 'milestone-item';

    const isAchieved = this.isMilestoneAchieved(milestone);
    const isClaimed = this.isMilestoneClaimedInAchievements(milestone);

    if (isAchieved && !isClaimed) {
      el.classList.add('achieved');
    } else if (isClaimed) {
      el.classList.add('claimed');
    }

    const statusText = isClaimed
      ? 'Claimed'
      : isAchieved
      ? 'Achieved'
      : 'Pending';
    const statusClass = isClaimed
      ? 'claimed'
      : isAchieved
      ? 'achieved'
      : 'pending';

    const customReward = this.getCustomRewardForMilestone(milestone);
    const rewardText = customReward
      ? customReward.description
      : 'Set custom reward...';

    const isEditable = !customReward; // Only allow editing if no custom reward exists

    el.innerHTML = `
      <div class="milestone-header">
        <div class="milestone-title">${milestone.title}</div>
        <div class="milestone-status ${statusClass}">${statusText}</div>
      </div>
      <div class="milestone-description">${milestone.description}</div>
      <div class="milestone-reward">
        <div class="reward-text ${isEditable ? 'editable' : ''}" 
            data-milestone-type="${milestone.type}" 
            data-milestone-value="${milestone.value}"
            ${isEditable ? 'onclick="app.editMilestoneReward(this)"' : ''}>
          ${rewardText}
        </div>
        ${
          isAchieved && !isClaimed
            ? `<button class="claim-btn" onclick="app.claimMilestone('${milestone.type}', ${milestone.value})">Claim Reward</button>`
            : ''
        }
      </div>
    `;

    return el;
  }

  /**
   * Edit milestone reward (make it customizable)
   */
  editMilestoneReward(element) {
    const milestoneType = element.dataset.milestoneType;
    const milestoneValue = parseInt(element.dataset.milestoneValue);

    // Check if this milestone already has a custom reward
    const existingReward = this.customRewards.find(
      (reward) =>
        reward.type === milestoneType &&
        (reward.streakDays === milestoneValue ||
          reward.weightLoss === milestoneValue)
    );

    if (existingReward) {
      this.showError(
        'This milestone already has a custom reward. Delete it first to create a new one.'
      );
      return;
    }

    // Prompt for custom reward
    const rewardDescription = prompt(
      `Set your custom reward for this milestone:\n\n${
        milestoneType === 'weight'
          ? milestoneValue + ' lbs lost'
          : milestoneValue + ' day streak'
      }`,
      'Enter your reward (e.g., "Spa day", "New workout clothes", "Cheat meal")'
    );

    if (
      !rewardDescription ||
      rewardDescription.trim() === '' ||
      rewardDescription ===
        'Enter your reward (e.g., "Spa day", "New workout clothes", "Cheat meal")'
    ) {
      return; // User cancelled or entered placeholder text
    }

    // Create custom reward
    const customReward = {
      type: milestoneType,
      description: rewardDescription.trim(),
      createdDate: new Date().toISOString(),
    };

    // Add type-specific criteria
    if (milestoneType === 'weight') {
      customReward.weightLoss = milestoneValue;
    } else if (milestoneType === 'streak') {
      customReward.streakDays = milestoneValue;
    }

    // Add to custom rewards
    this.customRewards.push(customReward);
    this.saveData();

    // Regenerate milestones to include the new custom reward
    this.initializeDefaultMilestones();
    this.renderDefaultMilestones();
    this.renderCustomRewards(); // Update the custom rewards list too

    this.showSuccess(`Custom reward added: "${rewardDescription}"`);
  }

  /**
   * Check if milestone is achieved
   */
  isMilestoneAchieved(milestone) {
    if (milestone.type === 'streak') {
      return this.streaks.overall >= milestone.value;
    } else if (milestone.type === 'weight') {
      const weightLost =
        this.currentUser.startingWeight - this.currentUser.currentWeight;
      return weightLost >= milestone.value;
    }
    return false;
  }

  /**
   * Check if milestone has been claimed (exists in achievements)
   */
  isMilestoneClaimedInAchievements(milestone) {
    return this.achievements.some(
      (achievement) =>
        achievement.type === milestone.type &&
        achievement.value === milestone.value
    );
  }

  /**
   * Get custom reward for milestone
   */
  getCustomRewardForMilestone(milestone) {
    // Check if the milestone already has a custom reward attached
    if (milestone.customReward) {
      return milestone.customReward;
    }

    // Otherwise, search for matching custom reward
    return this.customRewards.find(
      (reward) =>
        reward.type === milestone.type &&
        (reward.streakDays === milestone.value ||
          reward.weightLoss === milestone.value)
    );
  }

  /**
   * Claim milestone reward
   */
  claimMilestone(type, value) {
    const milestone = this.defaultMilestones.find(
      (m) => m.type === type && m.value === value
    );
    if (!milestone || !this.isMilestoneAchieved(milestone)) return;

    // Add to achievements
    const achievement = {
      type: milestone.type,
      value: milestone.value,
      title: milestone.title,
      description: milestone.description,
      customReward: this.getCustomRewardForMilestone(milestone),
      claimedDate: new Date().toISOString(),
      claimedStreak: this.streaks.overall,
      claimedWeight: this.currentUser.currentWeight,
    };

    this.achievements.push(achievement);
    this.saveData();

    // Show celebration modal
    this.showAchievementModal(achievement);

    // Re-render milestones
    this.renderDefaultMilestones();
    this.renderAchievementHistory();
  }

  /**
   * Handle custom reward form submission
   */
  handleCustomReward(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const rewardType = formData.get('rewardType');
    const description = formData.get('rewardDescription');

    if (!rewardType || !description) {
      this.showError('Please fill in all required fields');
      return;
    }

    const reward = {
      type: rewardType,
      description: description,
      createdDate: new Date().toISOString(),
    };

    // Add type-specific criteria
    if (rewardType === 'streak') {
      reward.streakDays = parseInt(formData.get('streakDays'));
      if (!reward.streakDays || reward.streakDays < 1) {
        this.showError('Please enter valid streak days');
        return;
      }
    } else if (rewardType === 'weight') {
      reward.weightLoss = parseFloat(formData.get('weightLoss'));
      if (!reward.weightLoss || reward.weightLoss < 0.1) {
        this.showError('Please enter valid weight loss amount');
        return;
      }
    } else if (rewardType === 'combo') {
      reward.streakDays = parseInt(formData.get('comboStreak'));
      reward.weightLoss = parseFloat(formData.get('comboWeight'));
      if (!reward.streakDays || !reward.weightLoss) {
        this.showError('Please enter valid streak days and weight loss');
        return;
      }
    }

    this.customRewards.push(reward);
    this.saveData();

    // Reset form and update display
    e.target.reset();
    this.updateRewardCriteria();
    this.renderCustomRewards();

    // Force regenerate milestones to include the new custom reward
    this.initializeDefaultMilestones();
    this.renderDefaultMilestones();

    this.showSuccess('Custom reward added successfully!');
  }

  /**
   * Update reward criteria form visibility
   */
  updateRewardCriteria() {
    const rewardType = document.getElementById('rewardType').value;
    const criteriaElements = document.querySelectorAll('.reward-criteria');

    criteriaElements.forEach((el) => el.classList.add('hidden'));

    if (rewardType) {
      const targetCriteria = document.getElementById(`${rewardType}Criteria`);
      if (targetCriteria) {
        targetCriteria.classList.remove('hidden');
      }
    }
  }

  /**
   * Render custom rewards list
   */
  renderCustomRewards() {
    const container = document.getElementById('customRewardsList');
    if (!container) return;

    container.innerHTML = '';

    if (this.customRewards.length === 0) {
      container.innerHTML =
        '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No custom rewards added yet.</p>';
      return;
    }

    this.customRewards.forEach((reward, index) => {
      const rewardEl = this.createCustomRewardElement(reward, index);
      container.appendChild(rewardEl);
    });
  }

  /**
   * Create custom reward element
   */
  createCustomRewardElement(reward, index) {
    const el = document.createElement('div');
    el.className = 'reward-item';

    let criteriaText = '';
    if (reward.type === 'streak') {
      criteriaText = `${reward.streakDays} day streak`;
    } else if (reward.type === 'weight') {
      criteriaText = `${reward.weightLoss} lbs lost`;
    } else if (reward.type === 'combo') {
      criteriaText = `${reward.streakDays} day streak + ${reward.weightLoss} lbs lost`;
    }

    el.innerHTML = `
            <div class="reward-info">
                <div class="reward-title">${reward.description}</div>
                <div class="reward-criteria-text">${criteriaText}</div>
            </div>
            <div class="reward-actions">
                <button class="btn btn-small btn-danger" onclick="app.deleteCustomReward(${index})">Delete</button>
            </div>
        `;

    return el;
  }

  /**
   * Delete custom reward
   */
  deleteCustomReward(index) {
    if (confirm('Are you sure you want to delete this reward?')) {
      this.customRewards.splice(index, 1);
      this.saveData();
      this.renderCustomRewards();
      this.renderDefaultMilestones();
      this.showSuccess('Custom reward deleted.');
    }
  }

  /**
   * Render achievement history
   */
  renderAchievementHistory() {
    const container = document.getElementById('achievementHistory');
    if (!container) return;

    container.innerHTML = '';

    if (this.achievements.length === 0) {
      container.innerHTML =
        '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No achievements yet. Keep working towards your goals!</p>';
      return;
    }

    // Sort achievements by date (newest first)
    const sortedAchievements = [...this.achievements].sort(
      (a, b) => new Date(b.claimedDate) - new Date(a.claimedDate)
    );

    sortedAchievements.forEach((achievement) => {
      const achievementEl = this.createAchievementElement(achievement);
      container.appendChild(achievementEl);
    });
  }

  /**
   * Create achievement element
   */
  createAchievementElement(achievement) {
    const el = document.createElement('div');
    el.className = 'achievement-item';

    const claimedDate = new Date(achievement.claimedDate).toLocaleDateString();
    const rewardText = achievement.customReward
      ? ` - Reward: ${achievement.customReward.description}`
      : '';

    el.innerHTML = `
            <div class="achievement-header">
                <div class="achievement-title">${achievement.title}</div>
                <div class="achievement-date">${claimedDate}</div>
            </div>
            <div class="achievement-description">
                ${achievement.description}${rewardText}
            </div>
        `;

    return el;
  }

  /**
   * Check for new achievements after daily log
   */
  checkAchievements() {
    const newAchievements = [];

    // Check streak milestones
    this.defaultMilestones
      .filter((m) => m.type === 'streak')
      .forEach((milestone) => {
        if (
          this.isMilestoneAchieved(milestone) &&
          !this.isMilestoneClaimedInAchievements(milestone)
        ) {
          newAchievements.push(milestone);
        }
      });

    // Check weight milestones
    this.defaultMilestones
      .filter((m) => m.type === 'weight')
      .forEach((milestone) => {
        if (
          this.isMilestoneAchieved(milestone) &&
          !this.isMilestoneClaimedInAchievements(milestone)
        ) {
          newAchievements.push(milestone);
        }
      });

    // Show achievement notifications
    if (newAchievements.length > 0) {
      newAchievements.forEach((achievement) => {
        this.showAchievementNotification(achievement);
      });
    }
  }

  /**
   * Show achievement notification
   */
  showAchievementNotification(milestone) {
    const customReward = this.getCustomRewardForMilestone(milestone);
    const rewardText = customReward
      ? ` Your reward: ${customReward.description}`
      : '';

    const message = `🎉 Achievement Unlocked: ${milestone.title}!${rewardText} Visit the Rewards tab to claim it.`;
    this.showSuccess(message, 5000);
  }

  /**
   * Show achievement modal with celebration
   */
  showAchievementModal(achievement) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('achievementModal');
    if (!modal) {
      modal = this.createAchievementModal();
      document.body.appendChild(modal);
    }

    // Update modal content
    const title = modal.querySelector('.modal-title');
    const message = modal.querySelector('.modal-message');

    title.textContent = '🎉 Achievement Claimed!';

    const rewardText = achievement.customReward
      ? ` Enjoy your reward: ${achievement.customReward.description}`
      : ` Consider setting a custom reward for future milestones!`;

    message.textContent = `${achievement.title} - ${achievement.description}.${rewardText}`;

    // Show modal with celebration animation
    modal.classList.add('show');
    document.body.classList.add('celebrating');

    setTimeout(() => {
      document.body.classList.remove('celebrating');
    }, 600);
  }

  /**
   * Create achievement modal
   */
  createAchievementModal() {
    const modal = document.createElement('div');
    modal.id = 'achievementModal';
    modal.className = 'modal';

    modal.innerHTML = `
            <div class="modal-content">
                <h2 class="modal-title">Achievement!</h2>
                <p class="modal-message"></p>
                <button class="modal-btn" onclick="app.closeAchievementModal()">Awesome!</button>
            </div>
        `;

    return modal;
  }

  /**
   * Close achievement modal
   */
  closeAchievementModal() {
    const modal = document.getElementById('achievementModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  /**
   * Toggle theme between light and dark
   */
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('byf_theme', newTheme);

    this.updateThemeToggle(newTheme);

    // Update settings if user manually toggles (override system preference)
    this.settings.themePreference = newTheme;
    this.saveSettings();

    // Update radio button in settings
    const themeRadio = document.querySelector(`input[value="${newTheme}"]`);
    if (themeRadio) {
      themeRadio.checked = true;
    }
  }

  /**
   * Update theme toggle button text
   */
  updateThemeToggle(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.textContent =
        theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
  }

  /**
   * Update current date display
   */
  updateCurrentDate() {
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
      const today = new Date();
      currentDateEl.textContent = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  }

  /**
   * Show setup screen
   */
  showSetupScreen() {
    document.getElementById('setupScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
  }

  /**
   * Show main app screen - UPDATED VERSION
   */
  showAppScreen() {
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');

    // Initialize default milestones when showing app
    this.initializeDefaultMilestones();
  }

  /**
   * Show success message
   */
  showSuccess(message, duration = 3000) {
    // Remove existing success messages
    const existingMessages = document.querySelectorAll('.success-message');
    existingMessages.forEach((msg) => msg.remove());

    // Create new success message
    const successEl = document.createElement('div');
    successEl.className = 'success-message';
    successEl.textContent = message;

    document.body.appendChild(successEl);

    // Show message
    setTimeout(() => {
      successEl.classList.add('show');
    }, 100);

    // Hide and remove message
    setTimeout(() => {
      successEl.classList.remove('show');
      setTimeout(() => {
        if (successEl.parentNode) {
          successEl.parentNode.removeChild(successEl);
        }
      }, 300);
    }, duration);
  }

  /**
   * Show error message
   */
  showError(message) {
    alert(`Error: ${message}`);
  }

  /**
   * Show processing indicator
   */
  showProcessing(message = 'Processing...') {
    const processingEl = document.getElementById('processingStatus');
    const iconEl = processingEl?.querySelector('.processing-icon');
    const textEl = processingEl?.querySelector('.processing-text');

    if (processingEl && iconEl && textEl) {
      iconEl.textContent = '⏳';
      textEl.textContent = message;
      processingEl.className = 'processing-status processing';
      processingEl.classList.remove('hidden');
    }
  }

  /**
   * Hide processing indicator
   */
  hideProcessing() {
    const processingEl = document.getElementById('processingStatus');
    if (processingEl) {
      processingEl.classList.add('hidden');
      processingEl.className = 'processing-status hidden';
    }
  }

  /**
   * Show processing success briefly
   */
  showProcessingSuccess(message = 'Complete!', duration = 2000) {
    const processingEl = document.getElementById('processingStatus');
    const iconEl = processingEl?.querySelector('.processing-icon');
    const textEl = processingEl?.querySelector('.processing-text');

    if (processingEl && iconEl && textEl) {
      iconEl.textContent = '✅';
      textEl.textContent = message;
      processingEl.className = 'processing-status success';
      processingEl.classList.remove('hidden');

      setTimeout(() => {
        this.hideProcessing();
      }, duration);
    }
  }

  /**
   * Show processing error briefly
   */
  showProcessingError(message = 'Error occurred', duration = 3000) {
    const processingEl = document.getElementById('processingStatus');
    const iconEl = processingEl?.querySelector('.processing-icon');
    const textEl = processingEl?.querySelector('.processing-text');

    if (processingEl && iconEl && textEl) {
      iconEl.textContent = '❌';
      textEl.textContent = message;
      processingEl.className = 'processing-status error';
      processingEl.classList.remove('hidden');

      setTimeout(() => {
        this.hideProcessing();
      }, duration);
    }
  }

  /**
   * Export data as JSON
   */
  exportData() {
    const exportData = {
      user: this.currentUser,
      dailyLogs: this.dailyLogs,
      streaks: this.streaks,
      customRewards: this.customRewards,
      achievements: this.achievements,
      exportDate: new Date().toISOString(),
      version: '1.0',
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `bribeYourselfFit_backup_${
      new Date().toISOString().split('T')[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.showSuccess('Data exported successfully!');
  }

  /**
   * Import data from JSON file
   */
  importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // Validate imported data structure
        if (!this.validateImportData(importedData)) {
          this.showError('Invalid backup file format');
          return;
        }

        // Confirm import
        if (
          !confirm(
            'This will replace all current data. Are you sure you want to import?'
          )
        ) {
          return;
        }

        // Import data
        this.currentUser = importedData.user;
        this.dailyLogs = importedData.dailyLogs || {};
        this.streaks = importedData.streaks || this.initializeStreaks();
        this.customRewards = importedData.customRewards || [];
        this.achievements = importedData.achievements || [];

        // Save imported data
        this.saveData();

        // Refresh display
        this.updateDashboard();
        this.initializeDefaultMilestones();

        this.showSuccess('Data imported successfully!');

        // Refresh page to ensure clean state
        setTimeout(() => {
          location.reload();
        }, 1500);
      } catch (error) {
        console.error('Import error:', error);
        this.showError('Failed to import data. Please check the file format.');
      }
    };

    reader.readAsText(file);
  }

  /**
   * Validate imported data structure
   */
  validateImportData(data) {
    return (
      data &&
      data.user &&
      typeof data.user.startingWeight === 'number' &&
      typeof data.user.goalWeight === 'number' &&
      typeof data.user.dailySteps === 'number' &&
      typeof data.user.dailyExercise === 'number' &&
      typeof data.user.dailyWater === 'number'
    );
  }

  /**
   * Reset all data (updated version)
   */
  resetAllData() {
    if (
      !confirm(
        'This will delete ALL data including your profile, logs, and achievements. This cannot be undone. Are you sure?'
      )
    ) {
      return;
    }

    if (!confirm('Really sure? This will permanently delete everything!')) {
      return;
    }

    // Clear localStorage - add settings to the list
    const keysToRemove = [
      'byf_user',
      'byf_dailyLogs',
      'byf_streaks',
      'byf_customRewards',
      'byf_achievements',
      'byf_settings',
      'byf_theme',
    ];
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Reset app state
    this.currentUser = null;
    this.dailyLogs = {};
    this.streaks = {};
    this.customRewards = [];
    this.achievements = [];
    this.settings = this.getDefaultSettings(); // Add this line

    this.showSuccess('All data has been reset. Redirecting to setup...');

    // Refresh page after short delay
    setTimeout(() => {
      location.reload();
    }, 2000);
  }

  /**
   * Get app statistics for debugging/info
   */
  getAppStats() {
    const startTime = performance.now(); // Add this line
    const totalLogs = Object.keys(this.dailyLogs).length;
    const weightLogs = Object.values(this.dailyLogs).filter(
      (log) => log.weight !== null
    ).length;
    const totalExerciseMinutes = Object.values(this.dailyLogs).reduce(
      (sum, log) => sum + (log.exerciseMinutes || 0),
      0
    );
    const totalSteps = Object.values(this.dailyLogs).reduce(
      (sum, log) => sum + (log.steps || 0),
      0
    );
    const totalWater = Object.values(this.dailyLogs).reduce(
      (sum, log) => sum + (log.water || 0),
      0
    );

    const stats = {
      profileCreated: this.currentUser?.setupDate,
      totalDaysLogged: totalLogs,
      weightEntriesLogged: weightLogs,
      currentStreak: this.streaks.overall,
      longestStreak: Math.max(
        this.streaks.steps,
        this.streaks.exercise,
        this.streaks.water,
        this.streaks.wellness,
        this.streaks.overall
      ),
      totalExerciseMinutes,
      totalSteps,
      totalWaterLiters: totalWater,
      achievementsUnlocked: this.achievements.length,
      customRewards: this.customRewards.length,
    };

    if (this.currentUser) {
      stats.weightProgress = {
        starting: this.currentUser.startingWeight,
        current: this.currentUser.currentWeight,
        goal: this.currentUser.goalWeight,
        lost: this.currentUser.startingWeight - this.currentUser.currentWeight,
        remaining: Math.abs(
          this.currentUser.currentWeight - this.currentUser.goalWeight
        ),
      };
    }

    const loadTime = performance.now() - startTime;
    stats.performanceMs = Math.round(loadTime * 100) / 100;

    console.table(stats);
    return stats;
  }

  // Add these to your BribeYourselfFit class:

  /**
   * Handle import data button click
   */
  handleImportData() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];

    if (!file) {
      this.showError('Please select a backup file first');
      return;
    }

    this.importData(file);
  }

  /**
   * Reset functions for danger zone
   */
  resetStreaks() {
    if (!confirm('This will reset all your streaks to 0. Continue?')) return;

    this.streaks = this.initializeStreaks();
    this.saveData();
    this.updateDashboard();
    this.showSuccess('All streaks have been reset');
  }

  clearTodaysLog() {
    if (!confirm("This will clear today's fitness log. Continue?")) return;

    delete this.dailyLogs[this.currentDate];
    this.saveData();
    this.updateDashboard();
    this.showSuccess("Today's log has been cleared");
  }

  resetProfile() {
    if (!confirm('This will reset your profile but keep your logs. Continue?'))
      return;

    // Save current logs and achievements
    const savedLogs = { ...this.dailyLogs };
    const savedAchievements = [...this.achievements];

    // Reset to setup screen
    this.currentUser = null;
    this.saveData();
    this.showSetupScreen();

    this.showSuccess('Profile reset. Please set up your goals again.');
  }

  resetLogs() {
    if (
      !confirm(
        'This will delete ALL daily logs but keep your profile. Continue?'
      )
    )
      return;
    if (!confirm('Are you sure? This cannot be undone!')) return;

    this.dailyLogs = {};
    this.streaks = this.initializeStreaks();
    this.achievements = [];
    this.saveData();
    this.updateDashboard();
    this.showSuccess('All daily logs have been cleared');
  }

  /**
   * Debug method to check form and data state
   */
  debugFormState() {
    console.log('=== FORM DEBUG INFO ===');
    console.log('Current date:', this.currentDate);
    console.log("Today's log:", this.dailyLogs[this.currentDate]);
    console.log('All daily logs:', this.dailyLogs);

    // Check form elements
    const weightInput = document.getElementById('todayWeight');
    const stepsInput = document.getElementById('todaySteps');
    const exerciseInput = document.getElementById('todayExerciseMinutes');
    const waterInput = document.getElementById('todayWater');

    console.log('Form elements found:', {
      weight: !!weightInput,
      steps: !!stepsInput,
      exercise: !!exerciseInput,
      water: !!waterInput,
    });

    console.log('Form values:', {
      weight: weightInput?.value,
      steps: stepsInput?.value,
      exercise: exerciseInput?.value,
      water: waterInput?.value,
    });

    console.log(
      'Exercise checkboxes:',
      Array.from(document.querySelectorAll('.exercise-checkbox:checked')).map(
        (cb) => cb.value
      )
    );

    console.log(
      'Wellness checkboxes:',
      Array.from(document.querySelectorAll('.wellness-checkbox:checked')).map(
        (cb) => cb.dataset.wellness
      )
    );
    console.log('=====================');
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create global app instance
  window.app = new BribeYourselfFit();

  // Add some helpful global functions for development
  window.exportData = () => app.exportData();
  window.resetData = () => app.resetAllData();
  window.getStats = () => app.getAppStats();
  window.debugForm = () => app.debugFormState();

  // Add import function handler
  window.handleFileImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      app.importData(file);
    }
  };

  console.log('🎉 BribeYourselfFit initialized successfully!');
  console.log('Development commands available:');
  console.log('- exportData() - Export your data');
  console.log('- resetData() - Reset all data (careful!)');
  console.log('- getStats() - View app statistics');
  console.log('- debugForm() - Debug form state and data');
});

/**
 * Handle keyboard shortcuts for accessibility
 */
document.addEventListener('keydown', (e) => {
  if (e.altKey) {
    switch (e.key) {
      case '1':
        e.preventDefault();
        if (window.app) window.app.switchTab('dashboard');
        break;
      case '2':
        e.preventDefault();
        if (window.app) window.app.switchTab('charts');
        break;
      case '3':
        e.preventDefault();
        if (window.app) window.app.switchTab('rewards');
        break;
      case '4':
        e.preventDefault();
        if (window.app) window.app.switchTab('settings');
        break;
      case 't':
        e.preventDefault();
        if (window.app) window.app.toggleTheme();
        break;
    }
  }
});

/**
 * Handle window beforeunload to prevent data loss
 */
window.addEventListener('beforeunload', (e) => {
  // Check if there are unsaved changes (basic check)
  const forms = document.querySelectorAll('form');
  let hasUnsavedData = false;

  forms.forEach((form) => {
    const formData = new FormData(form);
    for (let [key, value] of formData.entries()) {
      if (value && value.toString().trim() !== '') {
        hasUnsavedData = true;
        break;
      }
    }
  });

  if (hasUnsavedData) {
    e.preventDefault();
    e.returnValue = 'You have unsaved data. Are you sure you want to leave?';
    return e.returnValue;
  }
});

/**
 * Performance monitoring
 */
const performanceObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    if (entry.entryType === 'navigation') {
      console.log(
        `Page load time: ${entry.loadEventEnd - entry.loadEventStart}ms`
      );
    }
  });
});

if (typeof PerformanceObserver !== 'undefined') {
  performanceObserver.observe({ entryTypes: ['navigation'] });
}

/**
 * Error handling for uncaught errors
 */
window.addEventListener('error', (e) => {
  console.error('Uncaught error:', e.error);
  if (window.app) {
    window.app.showError(
      'An unexpected error occurred. Please refresh the page.'
    );
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  if (window.app) {
    window.app.showError('An unexpected error occurred. Please try again.');
  }
});

// Fix for PWA install prompt errors
BribeYourselfFit.prototype.showInstallPrompt = function () {
  if (this.deferredPrompt) {
    // Only show install button if user hasn't dismissed it
    const existingBtn = document.getElementById('pwa-install-btn');
    if (existingBtn) return; // Don't create multiple buttons

    const installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';
    installBtn.textContent = '📱 Install App';
    installBtn.className = 'btn btn-primary';
    installBtn.style.cssText =
      'position: fixed; bottom: 20px; right: 20px; z-index: 1000; opacity: 0.9;';

    installBtn.addEventListener('click', async () => {
      try {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          const result = await this.deferredPrompt.userChoice;
          console.log('PWA install result:', result);
          this.deferredPrompt = null;
          installBtn.remove();
        }
      } catch (error) {
        console.error('Install prompt error:', error);
        installBtn.remove();
      }
    });

    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (installBtn.parentNode) {
        installBtn.remove();
      }
    }, 15000);

    document.body.appendChild(installBtn);
  }
};

// Debug function to check form state before saving
BribeYourselfFit.prototype.debugFormSave = function () {
  console.log('=== FORM SAVE DEBUG ===');
  console.log('Current date:', this.currentDate);
  console.log('Form elements:', {
    weight: document.getElementById('todayWeight')?.value,
    steps: document.getElementById('todaySteps')?.value,
    exercise: document.getElementById('todayExerciseMinutes')?.value,
    water: document.getElementById('todayWater')?.value,
  });
  console.log('Current user:', this.currentUser);
  console.log('Daily logs before save:', Object.keys(this.dailyLogs).length);
  console.log('=====================');
};

/**
 * Utility functions for date manipulation and formatting
 */
const DateUtils = {
  /**
   * Format date for display
   */
  formatDate(dateString, options = {}) {
    const date = new Date(dateString);
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
  },

  /**
   * Get days between two dates
   */
  daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(date1);
    const secondDate = new Date(date2);
    return Math.round(Math.abs((firstDate - secondDate) / oneDay));
  },

  /**
   * Check if date is today
   */
  isToday(dateString) {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  },

  /**
   * Get week number
   */
  getWeekNumber(dateString) {
    const date = new Date(dateString);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  },
};

// Make DateUtils available globally
window.DateUtils = DateUtils;

// PWA Event Listeners - Fixed Version
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('PWA install prompt available');
  e.preventDefault();
  if (window.app && typeof window.app.showInstallPrompt === 'function') {
    window.app.deferredPrompt = e;
    window.app.showInstallPrompt();
  }
});

window.addEventListener('appinstalled', () => {
  console.log('PWA installed successfully');
  if (window.app) {
    window.app.deferredPrompt = null;
  }
});
