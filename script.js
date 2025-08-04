/**
 * BribeYourselfFit - Airtable Version Integration
 *
 * This JavaScript file implements a complete fitness tracking system with:
 * - Cloud storage via Airtable API
 * - Offline-first sync with localStorage backup
 * - Real-time sync status indicators
 * - Progressive error handling and fallback
 * - Identical UX to localStorage version
 * - Structured database with relational data
 *
 * Airtable Storage Architecture:
 * - Primary: Airtable structured database (5 tables)
 * - Backup: localStorage for offline functionality
 * - Sync Strategy: Offline-first with background sync
 * - Error Handling: Progressive fallback with user feedback
 * - Data Structure: Relational tables vs flat JSON
 * - Enhanced Features: Field validation, data types, visual interface
 */

class BribeYourselfFitCloud {
  constructor() {
    // Initialize app state
    this.currentUser = null;
    this.dailyLogs = {};
    this.streaks = {};
    this.customRewards = [];
    this.achievements = [];
    this.defaultMilestones = [];
    this.currentTab = 'dashboard';
    this.chartPeriod = 7;
    this.currentDate = new Date().toISOString().split('T')[0];

    // Airtable configuration
    this.cloudConfig = {
      token: null,
      baseId: null,
      tableIds: {
        users: null,
        dailyLogs: null,
        settings: null,
        customRewards: null,
        achievements: null,
      },
      isConnected: false,
      lastSync: null,
      syncInProgress: false,
      retryCount: 0,
      maxRetries: 3,
    };

    // Sync queue for offline-first functionality
    this.syncQueue = [];
    this.autoSyncEnabled = true;
    this.syncNotifications = true;

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
   */
  init() {
    this.loadLocalData();
    this.loadCloudConfig();
    this.setupEventListeners();
    this.updateCurrentDate();

    // Show setup screen if no user profile exists or credentials missing
    if (
      !this.currentUser ||
      !this.cloudConfig.token ||
      !this.cloudConfig.baseId
    ) {
      this.showSetupScreen();
    } else {
      this.showAppScreen();
      this.updateDashboard();
      this.initializeCloudSync();
    }
  }

  /**
   * Load cloud configuration from localStorage
   */
  loadCloudConfig() {
    try {
      const savedConfig = localStorage.getItem('byf_cloud_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        this.cloudConfig = { ...this.cloudConfig, ...parsed };

        // Ensure tableIds object exists for backward compatibility
        if (!this.cloudConfig.tableIds) {
          this.cloudConfig.tableIds = {
            users: null,
            dailyLogs: null,
            settings: null,
            customRewards: null,
            achievements: null,
          };
        }
      }
    } catch (error) {
      console.error('Error loading cloud config:', error);
      this.showError('Failed to load cloud configuration. Using defaults.');
    }
  }

  /**
   * Export cloud data
   */
  async exportCloudData() {
    if (!this.cloudConfig.isConnected) {
      this.showError('Not connected to cloud storage');
      return;
    }

    try {
      const cloudData = await this.loadFromCloud();
      if (cloudData) {
        this.downloadData(cloudData, 'cloud');
        this.showSuccess('Cloud data exported successfully!');
      } else {
        this.showError('No cloud data found');
      }
    } catch (error) {
      console.error('Export cloud data error:', error);
      this.showError('Failed to export cloud data');
    }
  }

  /**
   * Export local data
   */
  exportLocalData() {
    const localData = {
      user: this.currentUser,
      dailyLogs: this.dailyLogs,
      streaks: this.streaks,
      customRewards: this.customRewards,
      achievements: this.achievements,
      exportDate: new Date().toISOString(),
      exportType: 'local',
      version: '1.1.0-cloud',
    };

    this.downloadData(localData, 'local');
    this.showSuccess('Local data exported successfully!');
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
    link.download = `BribeYourselfFit_${type}_backup_${
      new Date().toISOString().split('T')[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Reset local data only
   */
  resetLocalData() {
    if (
      !confirm(
        'This will delete all local data. Your cloud data will remain safe. Continue?'
      )
    ) {
      return;
    }

    // Clear localStorage
    const keysToRemove = [
      'byf_user',
      'byf_dailyLogs',
      'byf_streaks',
      'byf_customRewards',
      'byf_achievements',
    ];
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Reset app state
    this.currentUser = null;
    this.dailyLogs = {};
    this.streaks = {};
    this.customRewards = [];
    this.achievements = [];

    this.showSuccess('Local data cleared. Restart app to reload from cloud.');
  }

  /**
   * Reset cloud data only
   */
  async resetCloudData() {
    if (!this.cloudConfig.isConnected) {
      this.showError('Not connected to Airtable storage');
      return;
    }

    if (
      !confirm(
        'This will permanently delete all data from Airtable. This cannot be undone. Continue?'
      )
    ) {
      return;
    }

    if (
      !confirm(
        'Are you absolutely sure? This will delete ALL your fitness data from Airtable!'
      )
    ) {
      return;
    }

    try {
      // For Airtable, we'll clear all records from each table
      const tablesToClear = [
        'Users',
        'Daily%20Logs',
        'Settings',
        'Custom%20Rewards',
        'Achievements',
      ];

      for (const tableName of tablesToClear) {
        // Get all records first
        const listResponse = await fetch(
          `https://api.airtable.com/v0/${this.cloudConfig.baseId}/${tableName}`,
          {
            headers: {
              Authorization: `Bearer ${this.cloudConfig.token}`,
            },
          }
        );

        if (listResponse.ok) {
          const data = await listResponse.json();

          // Delete each record
          for (const record of data.records) {
            await fetch(
              `https://api.airtable.com/v0/${this.cloudConfig.baseId}/${tableName}/${record.id}`,
              {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${this.cloudConfig.token}`,
                },
              }
            );
          }
        }
      }

      this.showSuccess(
        'Airtable data deleted successfully. Local data preserved.'
      );
    } catch (error) {
      console.error('Reset Airtable data error:', error);
      this.showError('Failed to delete Airtable data');
    }
  }

  /**
   * Reset all data (local and cloud) - Enhanced for all 5 tables
   */
  async resetAllData() {
    if (
      !confirm(
        'This will delete ALL data from both local storage and Airtable. This cannot be undone. Continue?'
      )
    ) {
      return;
    }

    if (
      !confirm(
        'Final warning: This will permanently delete EVERYTHING from all 5 Airtable tables. Are you sure?'
      )
    ) {
      return;
    }

    try {
      // Delete Airtable data first (all 5 tables)
      if (this.cloudConfig.isConnected && this.cloudConfig.baseId) {
        console.log('🗑️ Clearing all Airtable tables...');

        const tablesToClear = [
          'Users',
          'Daily%20Logs',
          'Settings',
          'Custom%20Rewards',
          'Achievements',
        ];

        for (const tableName of tablesToClear) {
          console.log(`🗑️ Clearing ${tableName} table...`);

          // Get all records first
          const listResponse = await fetch(
            `https://api.airtable.com/v0/${this.cloudConfig.baseId}/${tableName}`,
            {
              headers: {
                Authorization: `Bearer ${this.cloudConfig.token}`,
              },
            }
          );

          if (listResponse.ok) {
            const data = await listResponse.json();
            console.log(`Found ${data.records.length} records in ${tableName}`);

            // Delete each record
            for (const record of data.records) {
              const deleteResponse = await fetch(
                `https://api.airtable.com/v0/${this.cloudConfig.baseId}/${tableName}/${record.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${this.cloudConfig.token}`,
                  },
                }
              );

              if (deleteResponse.ok) {
                console.log(`✅ Deleted record ${record.id} from ${tableName}`);
              } else {
                console.error(
                  `❌ Failed to delete record ${record.id} from ${tableName}`
                );
              }
            }

            console.log(`✅ ${tableName} table cleared`);
          } else {
            console.error(
              `❌ Failed to list records from ${tableName}:`,
              listResponse.status
            );
          }
        }
      }

      // Clear all localStorage
      const keysToRemove = [
        'byf_user',
        'byf_dailyLogs',
        'byf_streaks',
        'byf_customRewards',
        'byf_achievements',
        'byf_cloud_config',
        'byf_auto_sync',
        'byf_sync_notifications',
        'byf_settings',
      ];
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      this.showSuccess(
        'All data has been reset from both local storage and all 5 Airtable tables. Page will reload in 3 seconds...'
      );

      // Reload page after delay
      setTimeout(() => {
        location.reload();
      }, 3000);
    } catch (error) {
      console.error('Reset all data error:', error);
      this.showError('Failed to reset all data');
    }
  }

  /**
   * Handle Airtable credentials update
   */
  async handleUpdateApiKey() {
    const newToken = prompt('Enter your new Airtable Personal Access Token:');
    if (!newToken) return;

    const newBaseId = prompt('Enter your Airtable Base ID:');
    if (!newBaseId) return;

    const oldToken = this.cloudConfig.token;
    const oldBaseId = this.cloudConfig.baseId;

    this.cloudConfig.token = newToken.trim();
    this.cloudConfig.baseId = newBaseId.trim();

    const success = await this.testCloudConnection();

    if (success) {
      this.saveCloudConfig();
      this.showSuccess('Airtable credentials updated successfully!');
      this.updateSettingsDisplay();
    } else {
      this.cloudConfig.token = oldToken;
      this.cloudConfig.baseId = oldBaseId;
      this.showError('Invalid credentials. Previous credentials restored.');
    }
  }

  /**
   * Update settings display
   */
  updateSettingsDisplay() {
    console.log('🔄 Updating settings display...');
    console.log('Current connection status:', this.cloudConfig.isConnected);
    console.log('Last sync:', this.cloudConfig.lastSync);

    // Update connection info - CRITICAL FIX
    const connectionStatusEl = document.getElementById(
      'settingsConnectionStatus'
    );
    if (connectionStatusEl) {
      const status = this.cloudConfig.isConnected
        ? '✅ Connected'
        : '❌ Disconnected';
      connectionStatusEl.textContent = status;
      console.log('✅ Connection status updated to:', status);
    } else {
      console.warn('❌ settingsConnectionStatus element not found');
    }

    // Update last sync time - CRITICAL FIX
    const lastSyncEl = document.getElementById('lastSyncTime');
    if (lastSyncEl) {
      if (this.cloudConfig.lastSync) {
        const lastSync = new Date(this.cloudConfig.lastSync);
        const syncTime = lastSync.toLocaleString();
        lastSyncEl.textContent = syncTime;
        console.log('✅ Last sync time updated to:', syncTime);
      } else {
        lastSyncEl.textContent = 'Never';
        console.log('✅ Last sync time set to: Never');
      }
    } else {
      console.warn('❌ lastSyncTime element not found');
    }

    // Update pending syncs count
    const pendingSyncsEl = document.getElementById('pendingSyncs');
    if (pendingSyncsEl) {
      const pendingCount = this.syncQueue
        ? this.syncQueue.filter((item) => !item.synced).length
        : 0;
      pendingSyncsEl.textContent = pendingCount.toString();
      console.log('✅ Pending syncs updated to:', pendingCount);

      // Style based on pending count
      if (pendingCount > 0) {
        pendingSyncsEl.style.color = 'var(--accent-warning)';
        pendingSyncsEl.style.fontWeight = 'bold';
      } else {
        pendingSyncsEl.style.color = 'var(--text-secondary)';
        pendingSyncsEl.style.fontWeight = 'normal';
      }
    }

    // Update API key display with masked value
    const settingsApiKeyEl = document.getElementById('settingsApiKey');
    if (settingsApiKeyEl && this.cloudConfig.token) {
      const maskedToken =
        this.cloudConfig.token.substring(0, 8) + '••••••••••••';
      settingsApiKeyEl.placeholder = maskedToken;
      console.log('✅ API key display updated');
    }

    // Update data statistics
    const totalEntriesEl = document.getElementById('totalDataEntries');
    if (totalEntriesEl) {
      const totalEntries = this.dailyLogs
        ? Object.keys(this.dailyLogs).length
        : 0;
      totalEntriesEl.textContent = totalEntries.toString();
      console.log('✅ Total entries updated to:', totalEntries);
    }

    const storageUsedEl = document.getElementById('storageUsed');
    if (storageUsedEl) {
      const dataSize = JSON.stringify({
        user: this.currentUser,
        dailyLogs: this.dailyLogs,
        streaks: this.streaks,
        customRewards: this.customRewards,
        achievements: this.achievements,
      }).length;
      const sizeInKB = Math.round(dataSize / 1024);
      storageUsedEl.textContent = `~${sizeInKB} KB`;
      console.log('✅ Storage used updated to:', `~${sizeInKB} KB`);
    }

    // Update user preferences checkboxes
    const autoSyncCheckbox = document.getElementById('autoSyncEnabled');
    if (autoSyncCheckbox) {
      autoSyncCheckbox.checked = this.autoSyncEnabled;
      console.log('✅ Auto sync checkbox updated to:', this.autoSyncEnabled);
    }

    const syncNotificationsCheckbox =
      document.getElementById('syncNotifications');
    if (syncNotificationsCheckbox) {
      syncNotificationsCheckbox.checked = this.syncNotifications;
      console.log(
        '✅ Sync notifications checkbox updated to:',
        this.syncNotifications
      );
    }

    // Update theme preference radio buttons
    if (this.settings) {
      const themePreference = this.settings.themePreference || 'system';
      const themeRadio = document.querySelector(
        `input[value="${themePreference}"]`
      );
      if (themeRadio) {
        themeRadio.checked = true;
        console.log('✅ Theme preference updated to:', themePreference);
      }

      // Update unit and format selectors
      const weightUnit = document.getElementById('weightUnit');
      const dateFormat = document.getElementById('dateFormat');
      const weekStart = document.getElementById('weekStart');

      if (weightUnit && this.settings.weightUnit) {
        weightUnit.value = this.settings.weightUnit;
        console.log('✅ Weight unit updated to:', this.settings.weightUnit);
      }
      if (dateFormat && this.settings.dateFormat) {
        dateFormat.value = this.settings.dateFormat;
        console.log('✅ Date format updated to:', this.settings.dateFormat);
      }
      if (weekStart && this.settings.weekStart) {
        weekStart.value = this.settings.weekStart;
        console.log('✅ Week start updated to:', this.settings.weekStart);
      }

      // Update goal threshold checkboxes
      const allowPartialSteps = document.getElementById('allowPartialSteps');
      const allowPartialExercise = document.getElementById(
        'allowPartialExercise'
      );
      const strictWellness = document.getElementById('strictWellness');

      if (allowPartialSteps) {
        allowPartialSteps.checked = this.settings.allowPartialSteps || false;
      }
      if (allowPartialExercise) {
        allowPartialExercise.checked =
          this.settings.allowPartialExercise || false;
      }
      if (strictWellness) {
        strictWellness.checked = this.settings.strictWellness || false;
      }
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

      if (settingsSteps) {
        settingsSteps.value = this.currentUser.dailySteps;
        console.log('✅ Steps goal updated to:', this.currentUser.dailySteps);
      }
      if (settingsExercise) {
        settingsExercise.value = this.currentUser.dailyExercise;
        console.log(
          '✅ Exercise goal updated to:',
          this.currentUser.dailyExercise
        );
      }
      if (settingsWater) {
        settingsWater.value = this.currentUser.dailyWater;
        console.log('✅ Water goal updated to:', this.currentUser.dailyWater);
      }

      // Handle weight conversion for settings inputs
      const weightUnit = this.settings?.weightUnit || 'lbs';
      if (settingsStartingWeight) {
        const displayStartingWeight =
          weightUnit === 'kg'
            ? (this.currentUser.startingWeight * 0.453592).toFixed(1)
            : this.currentUser.startingWeight;
        settingsStartingWeight.value = displayStartingWeight;
        console.log(
          '✅ Settings starting weight updated to:',
          displayStartingWeight,
          weightUnit
        );
      }
      if (settingsGoalWeight) {
        const displayGoalWeight =
          weightUnit === 'kg'
            ? (this.currentUser.goalWeight * 0.453592).toFixed(1)
            : this.currentUser.goalWeight;
        settingsGoalWeight.value = displayGoalWeight;
        console.log(
          '✅ Settings goal weight updated to:',
          displayGoalWeight,
          weightUnit
        );
      }
    }

    console.log('🎉 Settings display update complete');
  }

  /**
   * Update all weight displays when unit changes
   */
  updateWeightDisplays() {
    const weightUnit = this.settings?.weightUnit || 'lbs';
    console.log(`🔄 Updating weight displays to ${weightUnit}`);
    console.log('Settings check:', this.settings);

    if (!this.currentUser) {
      console.log('❌ No current user data available');
      return;
    }

    // Update quick stats in sidebar
    const currentWeightEl = document.getElementById('currentWeightDisplay');
    const goalWeightEl = document.getElementById('goalWeightDisplay');
    const weightToGoEl = document.getElementById('weightToGoDisplay');

    if (currentWeightEl) {
      const currentWeight =
        weightUnit === 'kg'
          ? (this.currentUser.currentWeight * 0.453592).toFixed(1)
          : this.currentUser.currentWeight;
      currentWeightEl.textContent = `${currentWeight} ${weightUnit}`;
      console.log(
        `✅ Updated current weight to: ${currentWeight} ${weightUnit}`
      );
    }

    if (goalWeightEl) {
      const goalWeight =
        weightUnit === 'kg'
          ? (this.currentUser.goalWeight * 0.453592).toFixed(1)
          : this.currentUser.goalWeight;
      goalWeightEl.textContent = `${goalWeight} ${weightUnit}`;
      console.log(`✅ Updated goal weight to: ${goalWeight} ${weightUnit}`);
    }

    if (weightToGoEl) {
      const currentWeight =
        weightUnit === 'kg'
          ? this.currentUser.currentWeight * 0.453592
          : this.currentUser.currentWeight;
      const goalWeight =
        weightUnit === 'kg'
          ? this.currentUser.goalWeight * 0.453592
          : this.currentUser.goalWeight;
      const weightToGo = Math.abs(currentWeight - goalWeight);
      weightToGoEl.textContent = `${weightToGo.toFixed(1)} ${weightUnit}`;
      console.log(
        `✅ Updated weight to go: ${weightToGo.toFixed(1)} ${weightUnit}`
      );
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

    // Update any chart labels if weight chart is visible
    if (this.currentTab === 'charts') {
      console.log('🔄 Re-rendering weight chart for unit change');
      setTimeout(() => {
        this.renderWeightChart();
      }, 100);
    }

    // Update settings input values if we're on the settings tab
    if (this.currentTab === 'settings' && this.currentUser) {
      const settingsStartingWeight = document.getElementById(
        'settingsStartingWeight'
      );
      const settingsGoalWeight = document.getElementById('settingsGoalWeight');

      if (settingsStartingWeight) {
        const displayStartingWeight =
          weightUnit === 'kg'
            ? (this.currentUser.startingWeight * 0.453592).toFixed(1)
            : this.currentUser.startingWeight;
        settingsStartingWeight.value = displayStartingWeight;
        console.log(
          `✅ Settings starting weight updated to: ${displayStartingWeight} ${weightUnit}`
        );
      }

      if (settingsGoalWeight) {
        const displayGoalWeight =
          weightUnit === 'kg'
            ? (this.currentUser.goalWeight * 0.453592).toFixed(1)
            : this.currentUser.goalWeight;
        settingsGoalWeight.value = displayGoalWeight;
        console.log(
          `✅ Settings goal weight updated to: ${displayGoalWeight} ${weightUnit}`
        );
      }
    }

    console.log(`✅ Weight displays update complete for ${weightUnit}`);
  }

  /**
   * View app statistics
   */
  viewAppStats() {
    const stats = this.getAppStats();

    const statsText = Object.entries(stats)
      .map(
        ([key, value]) =>
          `${key}: ${
            typeof value === 'object' ? JSON.stringify(value, null, 2) : value
          }`
      )
      .join('\n');

    // Create a modal or use alert for now
    alert(`BribeYourselfFit Cloud Statistics:\n\n${statsText}`);
    console.table(stats);
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
   * Update streak counters based on daily log
   */
  updateStreaks(logEntry) {
    const today = logEntry.date;
    const yesterday = this.getDateOffset(today, -1);

    // Check if goals are met
    const goalsMetToday = {
      steps: logEntry.steps >= this.currentUser.dailySteps,
      exercise: logEntry.exerciseMinutes >= this.currentUser.dailyExercise,
      water: logEntry.water >= this.currentUser.dailyWater,
      wellness: logEntry.wellnessScore >= 3,
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
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
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
   * Switch between tabs
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

    // Update tab content
    document.querySelectorAll('.tab-content').forEach((content) => {
      if (content.id === `${tabName}Tab`) {
        content.classList.remove('hidden');
        content.classList.add('active');
      } else {
        content.classList.add('hidden');
        content.classList.remove('active');
      }
    });

    // Load tab-specific content
    try {
      if (tabName === 'charts') {
        this.loadChartsTab();
      } else if (tabName === 'rewards') {
        this.loadRewardsTab();
      } else if (tabName === 'settings') {
        this.loadSettingsTab();
        // Force settings display update after tab switch
        setTimeout(() => {
          console.log('Force updating settings after tab switch...');
          this.updateSettingsDisplay();
        }, 200);
      }
    } catch (error) {
      console.error(`Error loading ${tabName} tab:`, error);
    }
  }

  /**
   * Save cloud configuration to localStorage
   */
  saveCloudConfig() {
    try {
      localStorage.setItem(
        'byf_cloud_config',
        JSON.stringify(this.cloudConfig)
      );
    } catch (error) {
      console.error('Error saving cloud config:', error);
    }
  }

  /**
   * Initialize cloud sync after app load
   */
  async initializeCloudSync() {
    if (this.cloudConfig.token && this.cloudConfig.baseId) {
      await this.testCloudConnection();
      if (this.cloudConfig.isConnected) {
        await this.performInitialSync();
        this.startAutoSync();
      }
    }
    this.updateSyncStatus();
  }

  /**
   * Test connection to Airtable
   */
  async testCloudConnection() {
    if (!this.cloudConfig.token || !this.cloudConfig.baseId) {
      this.updateConnectionStatus('error', 'Token and Base ID required');
      return false;
    }

    try {
      this.updateConnectionStatus('testing', 'Testing Airtable connection...');

      // Test connection by trying to read the base schema
      const response = await fetch(
        `https://api.airtable.com/v0/meta/bases/${this.cloudConfig.baseId}/tables`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.cloudConfig.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Verify we have the expected tables
        const tableNames = data.tables.map((table) => table.name);
        const requiredTables = [
          'Users',
          'Daily Logs',
          'Settings',
          'Custom Rewards',
          'Achievements',
        ];
        const missingTables = requiredTables.filter(
          (table) => !tableNames.includes(table)
        );

        if (missingTables.length > 0) {
          this.updateConnectionStatus(
            'error',
            `Missing required tables: ${missingTables.join(', ')}`
          );
          return false;
        }

        // Store table IDs for future use
        this.cloudConfig.tableIds = {};
        data.tables.forEach((table) => {
          switch (table.name) {
            case 'Users':
              this.cloudConfig.tableIds.users = table.id;
              break;
            case 'Daily Logs':
              this.cloudConfig.tableIds.dailyLogs = table.id;
              break;
            case 'Settings':
              this.cloudConfig.tableIds.settings = table.id;
              break;
            case 'Custom Rewards':
              this.cloudConfig.tableIds.customRewards = table.id;
              break;
            case 'Achievements':
              this.cloudConfig.tableIds.achievements = table.id;
              break;
          }
        });

        this.cloudConfig.isConnected = true;
        this.cloudConfig.retryCount = 0;
        this.updateConnectionStatus('connected', 'Connected to Airtable base');
        return true;
      } else {
        throw new Error(
          `Airtable API Error: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error('Airtable connection test failed:', error);
      this.cloudConfig.isConnected = false;
      this.updateConnectionStatus(
        'error',
        `Connection failed: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Validate Airtable token format before testing connection
   */
  validateApiKeyFormat(token) {
    // Airtable Personal Access Token format validation
    if (!token || typeof token !== 'string') {
      return {
        valid: false,
        message: 'Token is required',
      };
    }

    const trimmedToken = token.trim();

    // Airtable Personal Access Tokens start with 'pat' and are typically 17+ characters
    if (!trimmedToken.startsWith('pat') || trimmedToken.length < 17) {
      return {
        valid: false,
        message:
          'Airtable Personal Access Token should start with "pat" and be at least 17 characters long',
      };
    }

    // Check for valid characters (alphanumeric and specific symbols)
    const validTokenPattern = /^pat[A-Za-z0-9._-]+$/;
    if (!validTokenPattern.test(trimmedToken)) {
      return {
        valid: false,
        message:
          'Token contains invalid characters. Should only contain letters, numbers, dots, hyphens, and underscores',
      };
    }

    return {
      valid: true,
      message: 'Token format looks correct',
    };
  }

  /**
   * Validate Airtable Base ID format
   */
  validateBaseIdFormat(baseId) {
    // Airtable Base ID format validation
    if (!baseId || typeof baseId !== 'string') {
      return {
        valid: false,
        message: 'Base ID is required',
      };
    }

    const trimmedBaseId = baseId.trim();

    // Airtable Base IDs start with 'app' and are typically 17 characters total
    if (!trimmedBaseId.startsWith('app') || trimmedBaseId.length !== 17) {
      return {
        valid: false,
        message:
          'Airtable Base ID should start with "app" and be exactly 17 characters long',
      };
    }

    // Check for valid characters (alphanumeric)
    const validBaseIdPattern = /^app[A-Za-z0-9]+$/;
    if (!validBaseIdPattern.test(trimmedBaseId)) {
      return {
        valid: false,
        message:
          'Base ID contains invalid characters. Should only contain letters and numbers after "app"',
      };
    }

    return {
      valid: true,
      message: 'Base ID format looks correct',
    };
  }

  /**
   * Delete test data (cleanup) - Not needed for Airtable
   */
  async deleteTestBin(binId) {
    // Airtable doesn't need test bin cleanup like JSONBin
    // This function is kept for compatibility but does nothing
    console.log('Airtable test cleanup - no action needed');
  }

  /**
   * Perform initial sync when app loads
   */
  async performInitialSync() {
    if (!this.cloudConfig.isConnected || !this.cloudConfig.baseId) return;

    try {
      // Try to load data from cloud
      const cloudData = await this.loadFromCloud();

      if (cloudData) {
        // Check if cloud data is newer than local data
        const cloudTimestamp = new Date(cloudData.lastSync || 0);
        const localTimestamp = new Date(this.cloudConfig.lastSync || 0);

        if (cloudTimestamp > localTimestamp) {
          // Cloud data is newer, use it
          this.mergeCloudData(cloudData);
          this.showSuccess('💾 Synced data from cloud storage');
        } else {
          // Local data is newer or same, push to cloud
          await this.saveToCloud();
        }
      } else {
        // No cloud data exists, push local data
        await this.saveToCloud();
      }
    } catch (error) {
      console.error('Initial sync failed:', error);
      this.showError('Initial sync failed, using local data');
    }
  }

  /**
   * Load data from Airtable (simplified for now)
   */
  async loadFromCloud() {
    if (!this.cloudConfig.baseId || !this.cloudConfig.token) return null;

    try {
      // For now, we'll return null to focus on saving functionality
      // This would need to be implemented to read from all Airtable tables
      // and reconstruct the data structure
      console.log('Airtable data loading - simplified for initial version');
      return null;
    } catch (error) {
      console.error('Error loading from Airtable:', error);
      throw error;
    }
  }

  /**
   * Save data to Airtable
   */
  async saveToCloud() {
    console.log('saveToCloud called');

    // Reset sync flag first to prevent stuck states
    this.cloudConfig.syncInProgress = false;
    console.log('isConnected:', this.cloudConfig.isConnected);
    console.log('syncInProgress:', this.cloudConfig.syncInProgress);
    console.log('token exists:', !!this.cloudConfig.token);
    console.log('baseId exists:', !!this.cloudConfig.baseId);

    if (!this.cloudConfig.isConnected || this.cloudConfig.syncInProgress) {
      console.log('❌ Cannot sync: not connected or sync in progress');
      return false;
    }

    // Force connection check if we have credentials but isConnected is false
    if (
      !this.cloudConfig.isConnected &&
      this.cloudConfig.token &&
      this.cloudConfig.baseId
    ) {
      console.log('Have credentials but not connected, testing connection...');
      const connected = await this.testCloudConnection();
      if (!connected) {
        console.log('❌ Connection test failed');
        return false;
      }
    }

    try {
      this.cloudConfig.syncInProgress = true;
      this.updateSyncStatus('syncing');

      // Save to Users table
      await this.saveUserToAirtable();

      // Save daily logs to Daily Logs table
      await this.saveDailyLogsToAirtable();

      // Save streaks, rewards, and achievements
      await this.saveAppDataToAirtable();

      this.cloudConfig.lastSync = new Date().toISOString();
      this.cloudConfig.retryCount = 0;
      this.saveCloudConfig();

      this.updateSyncStatus('synced');
      this.processSyncQueue();

      if (this.syncNotifications) {
        this.showSuccess('☁️ Data synced to Airtable', 2000);
      }

      console.log('✅ Sync completed successfully');

      // Mark all pending items as synced
      this.markSyncQueueItemsCompleted('dailyLog');
      this.markSyncQueueItemsCompleted('customReward');
      this.markSyncQueueItemsCompleted('achievement');
      this.markSyncQueueItemsCompleted('settings');

      // Force process the queue to update pending count
      this.processSyncQueue();

      // Update settings display if we're on settings tab
      if (this.currentTab === 'settings') {
        setTimeout(() => this.updateSettingsDisplay(), 100);
      }

      return true;
    } catch (error) {
      console.error('❌ Error saving to Airtable:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response,
      });
      this.handleSyncError(error);
      return false;
    } finally {
      this.cloudConfig.syncInProgress = false;
      console.log('✅ syncInProgress reset to false');
    }
  }

  /**
   * Save user profile to Airtable Users table (with duplicate prevention)
   */
  async saveUserToAirtable() {
    if (!this.currentUser) return;

    try {
      // First, check if a user record already exists
      const existingResponse = await fetch(
        `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Users?filterByFormula={User ID}='user1'`,
        {
          headers: {
            Authorization: `Bearer ${this.cloudConfig.token}`,
          },
        }
      );

      if (existingResponse.ok) {
        const existingData = await existingResponse.json();

        if (existingData.records.length > 0) {
          // Record exists, update it
          const recordId = existingData.records[0].id;
          await this.updateUserRecord(recordId);
        } else {
          // No record exists, create new one
          await this.createUserRecord();
        }
      }
    } catch (error) {
      console.error('❌ Error processing user data:', error);
    }
  }

  /**
   * Create new user record
   */
  async createUserRecord() {
    const userData = {
      fields: {
        'User ID': 'user1',
        'Starting Weight': this.currentUser.startingWeight,
        'Current Weight': this.currentUser.currentWeight,
        'Goal Weight': this.currentUser.goalWeight,
        'Daily Steps': this.currentUser.dailySteps,
        'Daily Exercise': this.currentUser.dailyExercise,
        'Daily Water': this.currentUser.dailyWater,
        'Setup Date': this.convertDateForAirtable(
          this.currentUser.setupDate.split('T')[0]
        ),
        'Last Weight Update': this.currentUser.lastWeightUpdate
          ? this.currentUser.lastWeightUpdate.split('T')[0]
          : new Date().toISOString().split('T')[0],
      },
    };

    const response = await fetch(
      `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Users`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cloudConfig.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      }
    );

    if (response.ok) {
      console.log('✅ Created user profile in Airtable');
    } else {
      const errorText = await response.text();
      console.error(
        '❌ Failed to create user profile:',
        response.status,
        errorText
      );
    }
  }

  /**
   * Update existing user record
   */
  async updateUserRecord(recordId) {
    const userData = {
      fields: {
        'Current Weight': this.currentUser.currentWeight,
        'Goal Weight': this.currentUser.goalWeight,
        'Daily Steps': this.currentUser.dailySteps,
        'Daily Exercise': this.currentUser.dailyExercise,
        'Daily Water': this.currentUser.dailyWater,
        'Starting Weight': this.currentUser.startingWeight,
        'Last Weight Update': this.currentUser.lastWeightUpdate
          ? this.currentUser.lastWeightUpdate.split('T')[0]
          : new Date().toISOString().split('T')[0],
      },
    };

    const response = await fetch(
      `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Users/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.cloudConfig.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      }
    );

    if (response.ok) {
      console.log('✅ Updated user profile in Airtable');
    } else {
      const errorText = await response.text();
      console.error(
        '❌ Failed to update user profile:',
        response.status,
        errorText
      );
    }
  }

  /**
   * Save daily logs to Airtable Daily Logs table (with duplicate prevention)
   */
  async saveDailyLogsToAirtable() {
    const logEntries = Object.values(this.dailyLogs);

    for (const log of logEntries) {
      // Convert date format from YYYY-MM-DD to M/D/YYYY for Airtable search
      const searchDate = this.convertDateForAirtable(log.date);

      // First, check if a record already exists for this date
      try {
        const existingResponse = await fetch(
          `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Daily%20Logs?filterByFormula=IS_SAME(Date,'${searchDate}','day')`,
          {
            headers: {
              Authorization: `Bearer ${this.cloudConfig.token}`,
            },
          }
        );

        if (existingResponse.ok) {
          const existingData = await existingResponse.json();

          if (existingData.records.length > 0) {
            // Record exists, update it
            const recordId = existingData.records[0].id;
            await this.updateDailyLogRecord(recordId, log);
          } else {
            // No record exists, create new one
            await this.createDailyLogRecord(log);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing log for ${log.date}:`, error);
      }
    }
  }

  /**
   * Convert date from YYYY-MM-DD to M/D/YYYY format for Airtable
   */
  convertDateForAirtable(dateString) {
    // Parse date string manually to avoid timezone issues
    const [year, month, day] = dateString.split('-');
    return `${parseInt(month)}/${parseInt(day)}/${year}`;
  }

  /**
   * Create new daily log record
   */
  async createDailyLogRecord(log) {
    const logData = {
      fields: {
        Date: log.date,
        Weight: log.weight || null,
        Steps: log.steps || 0,
        'Exercise Minutes': log.exerciseMinutes || 0,
        'Exercise Types': log.exerciseTypes || [],
        Water: log.water || 0,
        'Wellness Score': log.wellnessScore || 0,
        'Wellness Items': log.wellnessItems || [],
        Timestamp: log.timestamp,
      },
    };

    const response = await fetch(
      `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Daily%20Logs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cloudConfig.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      }
    );

    if (response.ok) {
      console.log(`✅ Created new log for ${log.date}`);
    } else {
      const errorText = await response.text();
      console.error(
        `❌ Failed to create log for ${log.date}:`,
        response.status,
        errorText
      );
    }
  }

  /**
   * Update existing daily log record
   */
  async updateDailyLogRecord(recordId, log) {
    const logData = {
      fields: {
        Date: log.date,
        Weight: log.weight || null,
        Steps: log.steps || 0,
        'Exercise Minutes': log.exerciseMinutes || 0,
        'Exercise Types': log.exerciseTypes || [],
        Water: log.water || 0,
        'Wellness Score': log.wellnessScore || 0,
        'Wellness Items': log.wellnessItems || [],
        Timestamp: log.timestamp,
      },
    };

    const response = await fetch(
      `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Daily%20Logs/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.cloudConfig.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      }
    );

    if (response.ok) {
      console.log(`✅ Updated existing log for ${log.date}`);
    } else {
      const errorText = await response.text();
      console.error(
        `❌ Failed to update log for ${log.date}:`,
        response.status,
        errorText
      );
    }
  }

  /**
   * Save app data (streaks, rewards, achievements) to Airtable
   */
  async saveAppDataToAirtable() {
    console.log('📊 Saving app data to Airtable...');

    // Save settings to Settings table
    await this.saveSettingsToAirtable();

    // Save custom rewards to Custom Rewards table
    await this.saveCustomRewardsToAirtable();

    // Save achievements to Achievements table
    await this.saveAchievementsToAirtable();

    console.log('✅ All app data saved to Airtable');
  }

  /**
   * Save settings to Airtable Settings table (with enhanced duplicate prevention)
   */
  async saveSettingsToAirtable() {
    try {
      // Check if settings record exists
      const existingResponse = await fetch(
        `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Settings?filterByFormula={Setting Name}='user1_settings'`,
        {
          headers: {
            Authorization: `Bearer ${this.cloudConfig.token}`,
          },
        }
      );

      if (existingResponse.ok) {
        const existingData = await existingResponse.json();

        const currentSettings = {
          'Setting Name': 'user1_settings',
          'Theme Preference': this.settings?.themePreference || 'system',
          'Weight Unit': this.settings?.weightUnit || 'lbs',
          'Date Format': this.settings?.dateFormat || 'US',
          'Week Start': this.settings?.weekStart || 'sunday',
          'Allow Partial Steps': this.settings?.allowPartialSteps || false,
          'Allow Partial Exercise':
            this.settings?.allowPartialExercise || false,
          'Strict Wellness': this.settings?.strictWellness || false,
          'Last Updated': new Date().toISOString().split('T')[0], // Add current date
          Version: '1.1.0-airtable',
        };

        if (existingData.records.length > 0) {
          // Check if settings have actually changed
          const existingRecord = existingData.records[0];
          const settingsChanged = this.hasSettingsChanged(
            existingRecord.fields,
            currentSettings
          );

          if (settingsChanged) {
            console.log('🔧 Settings changed, updating record...');
            // Update existing record
            const recordId = existingRecord.id;
            const response = await fetch(
              `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Settings/${recordId}`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${this.cloudConfig.token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fields: currentSettings }),
              }
            );

            if (response.ok) {
              console.log('✅ Settings updated in Airtable');
            }
          } else {
            console.log('⏭️ Settings unchanged, skipping sync');
          }
        } else {
          // Create new record
          console.log('➕ Creating new settings record...');
          const response = await fetch(
            `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Settings`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.cloudConfig.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ fields: currentSettings }),
            }
          );

          if (response.ok) {
            console.log('✅ Settings created in Airtable');
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Settings save failed, will retry later:', error.message);
    }
  }

  /**
   * Check if settings have actually changed
   */
  hasSettingsChanged(existingFields, newFields) {
    const fieldsToCheck = [
      'Theme Preference',
      'Weight Unit',
      'Date Format',
      'Week Start',
      'Allow Partial Steps',
      'Allow Partial Exercise',
      'Strict Wellness',
    ];

    return fieldsToCheck.some((field) => {
      const existing = existingFields[field];
      const newValue = newFields[field];

      // Handle boolean conversion for checkboxes
      if (typeof newValue === 'boolean') {
        return Boolean(existing) !== newValue;
      }

      return existing !== newValue;
    });
  }

  /**
   * Save custom rewards to Airtable Custom Rewards table (with enhanced debugging)
   */
  async saveCustomRewardsToAirtable() {
    console.log('🎁 Starting custom rewards sync...');
    console.log('Custom rewards to sync:', this.customRewards);

    if (!this.customRewards || this.customRewards.length === 0) {
      console.log('📝 No custom rewards to sync (array empty or undefined)');
      return;
    }

    console.log(`📝 Found ${this.customRewards.length} custom rewards to sync`);

    try {
      // First, get existing rewards to avoid duplicates
      console.log('🔍 Checking existing rewards in Airtable...');
      const existingResponse = await fetch(
        `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Custom%20Rewards`,
        {
          headers: {
            Authorization: `Bearer ${this.cloudConfig.token}`,
          },
        }
      );

      let existingRewards = [];
      if (existingResponse.ok) {
        const existingData = await existingResponse.json();
        existingRewards = existingData.records;
        console.log(
          `🔍 Found ${existingRewards.length} existing rewards in Airtable`
        );
      } else {
        console.warn(
          '⚠️ Failed to fetch existing rewards:',
          existingResponse.status,
          existingResponse.statusText
        );
      }

      // Sync each custom reward
      for (const [index, reward] of this.customRewards.entries()) {
        console.log(`🎁 Processing reward ${index + 1}:`, reward);

        // Check if this reward already exists
        const exists = existingRewards.some(
          (existing) =>
            existing.fields.Description === reward.description &&
            existing.fields['Target Type'] ===
              (reward.type === 'streak'
                ? 'overall-streak'
                : reward.type === 'weight'
                ? 'weight-loss'
                : 'overall-streak')
        );

        if (exists) {
          console.log(
            `⏭️ Reward already exists in Airtable: ${reward.description}`
          );
          continue;
        }

        console.log(
          `➕ Creating new reward in Airtable: ${reward.description}`
        );

        // Map the reward type to match Airtable options
        let targetType = reward.type;
        if (reward.type === 'streak') targetType = 'overall-streak';
        if (reward.type === 'weight') targetType = 'weight-loss';
        if (reward.type === 'combo') targetType = 'overall-streak'; // or create a combo option if needed

        const rewardData = {
          fields: {
            Title: reward.description,
            Description: reward.description,
            'Target Type': targetType,
            'Target Value': reward.streakDays || reward.weightLoss || null,
            Claimed: false,
            'Created Date': reward.createdDate
              ? reward.createdDate.split('T')[0]
              : new Date().toISOString().split('T')[0],
          },
        };

        console.log('📤 Sending reward data to Airtable:', rewardData);

        const response = await fetch(
          `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Custom%20Rewards`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.cloudConfig.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(rewardData),
          }
        );

        if (response.ok) {
          const responseData = await response.json();
          console.log(
            `✅ Custom reward synced successfully: ${reward.description}`
          );
          console.log('📥 Airtable response:', responseData);
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to sync reward "${reward.description}":`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
        }
      }

      console.log('🎁 Custom rewards sync completed');
    } catch (error) {
      console.error('❌ Custom rewards sync failed with error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Save achievements to Airtable Achievements table (with duplicate prevention)
   */
  async saveAchievementsToAirtable() {
    if (!this.achievements || this.achievements.length === 0) {
      console.log('🏆 No achievements to sync');
      return;
    }

    console.log('🏆 Starting achievements sync...');
    console.log('🏆 Achievements to sync:', this.achievements);

    try {
      // First, get existing achievements to avoid duplicates
      const existingResponse = await fetch(
        `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Achievements`,
        {
          headers: {
            Authorization: `Bearer ${this.cloudConfig.token}`,
          },
        }
      );

      let existingAchievements = [];
      if (existingResponse.ok) {
        const existingData = await existingResponse.json();
        existingAchievements = existingData.records;
        console.log(
          `🔍 Found ${existingAchievements.length} existing achievements in Airtable`
        );
      }

      // Sync each achievement with duplicate checking
      for (const achievement of this.achievements) {
        console.log(`🏆 Processing achievement: ${achievement.title}`);

        // Check if this achievement already exists
        const exists = existingAchievements.some(
          (existing) =>
            existing.fields.Type ===
              (achievement.type === 'streak'
                ? 'overall-streak'
                : achievement.type === 'weight'
                ? 'weight-loss'
                : 'overall-streak') &&
            existing.fields.Value === achievement.value &&
            existing.fields.Title === achievement.title
        );

        if (exists) {
          console.log(
            `⏭️ Achievement already exists in Airtable: ${achievement.title}`
          );
          continue;
        }

        console.log(
          `➕ Creating new achievement in Airtable: ${achievement.title}`
        );

        // Map the achievement type to match Airtable options
        let achievementType = achievement.type;
        if (achievement.type === 'streak') achievementType = 'overall-streak';
        if (achievement.type === 'weight') achievementType = 'weight-loss';
        if (achievement.type === 'combo') achievementType = 'overall-streak';

        const achievementData = {
          fields: {
            Title: achievement.title,
            Type: achievementType,
            Description: achievement.description,
            'Date Achieved': achievement.claimedDate
              ? achievement.claimedDate.split('T')[0]
              : new Date().toISOString().split('T')[0],
            Value: achievement.value,
          },
        };

        console.log(
          '🏆 Sending achievement data to Airtable:',
          achievementData
        );

        const response = await fetch(
          `https://api.airtable.com/v0/${this.cloudConfig.baseId}/Achievements`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.cloudConfig.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(achievementData),
          }
        );

        if (response.ok) {
          const responseData = await response.json();
          console.log(`✅ Achievement synced: ${achievement.title}`);
          console.log('📥 Airtable response:', responseData);
        } else {
          const errorText = await response.text();
          console.error(
            `❌ Failed to sync achievement "${achievement.title}":`,
            {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
            }
          );
        }
      }

      console.log('🏆 Achievements sync completed');
    } catch (error) {
      console.error('❌ Achievements sync failed with error:', error);
    }
  }

  /**
   * Handle sync errors with progressive fallback and recovery
   */
  handleSyncError(error) {
    this.cloudConfig.retryCount++;

    if (this.cloudConfig.retryCount <= this.cloudConfig.maxRetries) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.min(
        1000 * Math.pow(2, this.cloudConfig.retryCount),
        30000
      );

      this.updateSyncStatus(
        'error',
        `Retrying in ${Math.round(retryDelay / 1000)}s... (${
          this.cloudConfig.retryCount
        }/${this.cloudConfig.maxRetries})`
      );

      setTimeout(() => {
        if (this.autoSyncEnabled) {
          this.saveToCloud();
        }
      }, retryDelay);
    } else {
      // Max retries reached, fall back to local storage
      this.updateSyncStatus(
        'offline',
        'Offline mode - will sync when reconnected'
      );

      // Reset retry count for next connection attempt
      this.cloudConfig.retryCount = 0;

      if (this.syncNotifications) {
        this.showError(
          'Sync failed after multiple attempts. Data saved locally and will sync when connection is restored.'
        );
      }
    }
  }

  /**
   * Attempt to recover sync connection
   */
  async recoverSyncConnection() {
    if (this.cloudConfig.retryCount >= this.cloudConfig.maxRetries) {
      console.log('Attempting to recover sync connection...');

      const connected = await this.testCloudConnection();
      if (connected && this.syncQueue.length > 0) {
        this.showSuccess('🔄 Connection restored! Syncing pending changes...');
        await this.saveToCloud();
      }
    }
  }

  /**
   * Check connection health periodically
   */
  async checkConnectionHealth() {
    if (
      !this.cloudConfig.token ||
      !this.cloudConfig.baseId ||
      !navigator.onLine
    )
      return false;

    try {
      // Simple connectivity test using Airtable API
      const response = await fetch(
        `https://api.airtable.com/v0/meta/bases/${this.cloudConfig.baseId}/tables`,
        {
          method: 'HEAD',
          headers: { Authorization: `Bearer ${this.cloudConfig.token}` },
        }
      );

      const isHealthy = response.status !== 0 && response.ok;

      if (isHealthy && !this.cloudConfig.isConnected) {
        // Connection restored
        this.cloudConfig.isConnected = true;
        this.updateSyncStatus('connected', 'Connection restored');

        if (this.syncQueue.length > 0) {
          await this.saveToCloud();
        }
      } else if (!isHealthy && this.cloudConfig.isConnected) {
        // Connection lost
        this.cloudConfig.isConnected = false;
        this.updateSyncStatus('offline', 'Connection lost');
      }

      return isHealthy;
    } catch (error) {
      console.warn('Connection health check failed:', error);
      return false;
    }
  }

  /**
   * Merge cloud data with local data
   */
  mergeCloudData(cloudData) {
    if (cloudData.user) this.currentUser = cloudData.user;
    if (cloudData.dailyLogs) this.dailyLogs = cloudData.dailyLogs;
    if (cloudData.streaks) this.streaks = cloudData.streaks;
    if (cloudData.customRewards) this.customRewards = cloudData.customRewards;
    if (cloudData.achievements) this.achievements = cloudData.achievements;

    // Save merged data locally
    this.saveLocalData();
    this.updateDashboard();
  }

  /**
   * Add item to sync queue
   */
  addToSyncQueue(action, data) {
    this.syncQueue.push({
      action,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
    });
  }

  /**
   * Process sync queue
   */
  processSyncQueue() {
    // Remove synced items and items older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    this.syncQueue = this.syncQueue.filter((item) => {
      return !item.synced && item.timestamp > oneDayAgo;
    });

    this.updatePendingSyncCount();

    // Log if we're dropping old items
    const totalItems = this.syncQueue.length;
    if (totalItems > 100) {
      console.warn(
        `Large sync queue detected: ${totalItems} items. Consider forcing a sync.`
      );
    }
  }

  /**
   * Mark sync queue items as completed
   */
  markSyncQueueItemsCompleted(action) {
    let markedCount = 0;
    this.syncQueue.forEach((item) => {
      if (item.action === action && !item.synced) {
        item.synced = true;
        markedCount++;
      }
    });

    if (markedCount > 0) {
      console.log(`✅ Marked ${markedCount} ${action} items as synced`);
      this.processSyncQueue();
    }
  }

  /**
   * Start automatic sync interval
   */
  startAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    // Sync every 5 minutes if auto sync is enabled
    this.autoSyncInterval = setInterval(() => {
      if (
        this.autoSyncEnabled &&
        this.cloudConfig.isConnected &&
        this.syncQueue.length > 0
      ) {
        this.saveToCloud();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Force immediate sync
   */
  async forceSync() {
    console.log('Force sync starting...');
    console.log('Connection status:', this.cloudConfig.isConnected);

    if (!this.cloudConfig.isConnected) {
      console.log('Not connected, testing connection first...');
      const connected = await this.testCloudConnection();
      if (!connected) {
        this.showError('Cannot sync - connection to cloud storage failed');
        return;
      }
    }

    console.log('Attempting to save to cloud...');
    const success = await this.saveToCloud();
    if (success) {
      this.showSuccess('✅ Force sync completed successfully');
      // Update settings display after successful sync
      this.updateSettingsDisplay();
    } else {
      this.showError('❌ Force sync failed');
    }
  }

  /**
   * Update sync status indicators
   */
  updateSyncStatus(status = null, message = null) {
    const syncStatusEl = document.getElementById('syncStatus');
    const dashboardSyncEl = document.getElementById('dashboardSync');

    if (!status) {
      // Determine status automatically
      if (!this.cloudConfig.token || !this.cloudConfig.baseId) {
        status = 'offline';
        message = 'Not Configured';
      } else if (!this.cloudConfig.isConnected) {
        status = 'error';
        message = 'Connection Failed';
      } else if (this.cloudConfig.syncInProgress) {
        status = 'syncing';
        message = 'Syncing...';
      } else {
        status = 'synced';
        message = 'Synced';
      }
    }

    // Update header sync status
    if (syncStatusEl) {
      syncStatusEl.className = `sync-status ${status}`;

      const iconEl = syncStatusEl.querySelector('.sync-icon');
      const textEl = syncStatusEl.querySelector('.sync-text');

      if (iconEl && textEl) {
        switch (status) {
          case 'connected':
          case 'synced':
            iconEl.textContent = '✅';
            textEl.textContent = message || 'Connected';
            break;
          case 'syncing':
            iconEl.textContent = '🔄';
            textEl.textContent = message || 'Syncing...';
            break;
          case 'error':
            iconEl.textContent = '❌';
            textEl.textContent = message || 'Error';
            break;
          case 'offline':
            iconEl.textContent = '⚠️';
            textEl.textContent = message || 'Offline';
            break;
          default:
            iconEl.textContent = '⚠️';
            textEl.textContent = message || 'Unknown';
        }
      }
    }

    // Update dashboard sync indicator
    if (dashboardSyncEl) {
      const dotEl = dashboardSyncEl.querySelector('.sync-dot');
      const labelEl = dashboardSyncEl.querySelector('.sync-label');

      if (dotEl && labelEl) {
        dotEl.className = `sync-dot ${status}`;
        labelEl.textContent =
          message || status.charAt(0).toUpperCase() + status.slice(1);
      }
    }
  }

  /**
   * Update connection status in setup/settings
   */
  updateConnectionStatus(status, message) {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
      statusEl.className = `connection-status ${status}`;
      statusEl.textContent = message;
      statusEl.classList.remove('hidden');
    }
  }

  /**
   * Update pending sync count with visual indicator (Enhanced to sync header badge)
   */
  updatePendingSyncCount() {
    const pendingCount = this.syncQueue.filter((item) => !item.synced).length;

    // Update settings page pending count
    const pendingSyncsEl = document.getElementById('pendingSyncs');
    if (pendingSyncsEl) {
      pendingSyncsEl.textContent = pendingCount.toString();

      // Add visual indicator if there are pending syncs
      if (pendingCount > 0) {
        pendingSyncsEl.style.color = 'var(--accent-warning)';
        pendingSyncsEl.style.fontWeight = 'bold';
        pendingSyncsEl.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
        pendingSyncsEl.style.padding = '2px 6px';
        pendingSyncsEl.style.borderRadius = '4px';
      } else {
        pendingSyncsEl.style.color = 'var(--accent-success)';
        pendingSyncsEl.style.fontWeight = 'bold';
        pendingSyncsEl.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
        pendingSyncsEl.style.padding = '2px 6px';
        pendingSyncsEl.style.borderRadius = '4px';
      }
    }

    // Update header badge to match
    const headerBadge = document.querySelector('.sync-status');
    if (headerBadge && pendingCount === 0) {
      // If no pending syncs, ensure header shows synced status
      this.updateSyncStatus('synced', 'Synced');
    }

    console.log(`📊 Pending sync count updated: ${pendingCount}`);
  }

  /**
   * Set up all event listeners for the application
   */
  setupEventListeners() {
    console.log('Setting up event listeners...');

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.attachEventListeners();
      });
    } else {
      // DOM already loaded, attach immediately
      this.attachEventListeners();
    }
  }

  /**
   * Attach all event listeners to DOM elements
   */
  attachEventListeners() {
    console.log('Attaching event listeners to DOM elements...');

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', this.toggleTheme.bind(this));
      console.log('✅ Theme toggle listener attached');
    }

    // Cloud setup form
    const cloudSetupForm = document.getElementById('cloudSetupForm');
    if (cloudSetupForm) {
      const testConnectionBtn = document.getElementById('testConnection');
      if (testConnectionBtn) {
        testConnectionBtn.addEventListener(
          'click',
          this.handleTestConnection.bind(this)
        );
        console.log('✅ Test connection listener attached');
      }

      const toggleApiKeyBtn = document.getElementById('toggleApiKey');
      if (toggleApiKeyBtn) {
        toggleApiKeyBtn.addEventListener('click', () =>
          this.togglePasswordVisibility('airtableToken')
        );
        console.log('✅ Toggle API key listener attached');
      }
    }

    // Setup form
    const setupForm = document.getElementById('setupForm');
    if (setupForm) {
      setupForm.addEventListener('submit', this.handleSetup.bind(this));
      console.log('✅ Setup form listener attached');
    }

    // Daily log form - CRITICAL FIX
    const dailyLogForm = document.getElementById('dailyLogForm');
    if (dailyLogForm) {
      // Remove any existing listeners first
      dailyLogForm.replaceWith(dailyLogForm.cloneNode(true));
      // Re-get the element and attach listener
      const newDailyLogForm = document.getElementById('dailyLogForm');
      newDailyLogForm.addEventListener(
        'submit',
        this.handleDailyLog.bind(this)
      );
      console.log('✅ Daily log form listener attached');
    } else {
      console.warn('❌ Daily log form not found');
    }

    // Wellness checkboxes
    const wellnessCheckboxes = document.querySelectorAll('.wellness-checkbox');
    wellnessCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', this.updateWellnessScore.bind(this));
    });
    console.log(
      `✅ ${wellnessCheckboxes.length} wellness checkbox listeners attached`
    );

    // Exercise type checkboxes
    const exerciseCheckboxes = document.querySelectorAll('.exercise-checkbox');
    exerciseCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener(
        'change',
        this.updateExerciseSelection.bind(this)
      );
    });
    console.log(
      `✅ ${exerciseCheckboxes.length} exercise checkbox listeners attached`
    );

    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });
    console.log(`✅ ${tabBtns.length} tab button listeners attached`);

    // Chart period controls
    const chartBtns = document.querySelectorAll('.chart-btn');
    chartBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.setChartPeriod(parseInt(e.target.dataset.period) || 'all');
      });
    });
    console.log(`✅ ${chartBtns.length} chart button listeners attached`);

    // Reward form
    const rewardForm = document.getElementById('rewardForm');
    if (rewardForm) {
      rewardForm.addEventListener('submit', this.handleCustomReward.bind(this));
      console.log('✅ Reward form listener attached');
    }

    // Reward type selector
    const rewardType = document.getElementById('rewardType');
    if (rewardType) {
      rewardType.addEventListener(
        'change',
        this.updateRewardCriteria.bind(this)
      );
      console.log('✅ Reward type selector listener attached');
    }

    // Calendar navigation
    const prevMonth = document.getElementById('prevMonth');
    const nextMonth = document.getElementById('nextMonth');
    if (prevMonth) {
      prevMonth.addEventListener('click', () => this.navigateCalendar(-1));
      console.log('✅ Previous month listener attached');
    }
    if (nextMonth) {
      nextMonth.addEventListener('click', () => this.navigateCalendar(1));
      console.log('✅ Next month listener attached');
    }

    // Settings event listeners
    this.setupSettingsEventListeners();

    console.log('🎉 All event listeners attached successfully');
  }

  /**
   * Setup settings-specific event listeners with proper DOM checking
   */
  setupSettingsEventListeners() {
    console.log('Setting up settings event listeners...');

    // Force sync button - CRITICAL FIX
    const forceSyncBtn = document.getElementById('forceSyncBtn');
    if (forceSyncBtn) {
      // Remove existing listener and add new one
      forceSyncBtn.replaceWith(forceSyncBtn.cloneNode(true));
      document.getElementById('forceSyncBtn').addEventListener('click', () => {
        console.log('Force sync clicked');
        this.forceSync();
      });
      console.log('✅ Force sync button listener attached');
    }

    // Test connection button in settings - CRITICAL FIX
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
      testConnectionBtn.replaceWith(testConnectionBtn.cloneNode(true));
      document
        .getElementById('testConnectionBtn')
        .addEventListener('click', () => {
          console.log('Test connection clicked from settings');
          this.handleTestConnection();
        });
      console.log('✅ Test connection button listener attached');
    }

    // Update API key button
    const updateApiKeyBtn = document.getElementById('updateApiKeyBtn');
    if (updateApiKeyBtn) {
      updateApiKeyBtn.addEventListener(
        'click',
        this.handleUpdateApiKey.bind(this)
      );
      console.log('✅ Update API key button listener attached');
    }

    // Toggle API key visibility in settings
    const toggleSettingsApiKey = document.getElementById(
      'toggleSettingsApiKey'
    );
    if (toggleSettingsApiKey) {
      toggleSettingsApiKey.addEventListener('click', () =>
        this.togglePasswordVisibility('settingsApiKey')
      );
      console.log('✅ Toggle settings API key listener attached');
    }

    // Auto sync toggle
    const autoSyncEnabled = document.getElementById('autoSyncEnabled');
    if (autoSyncEnabled) {
      autoSyncEnabled.addEventListener('change', (e) => {
        this.autoSyncEnabled = e.target.checked;
        localStorage.setItem('byf_auto_sync', this.autoSyncEnabled.toString());
        if (this.autoSyncEnabled) {
          this.startAutoSync();
        } else if (this.autoSyncInterval) {
          clearInterval(this.autoSyncInterval);
        }
      });
      console.log('✅ Auto sync toggle listener attached');
    }

    // Sync notifications toggle
    const syncNotifications = document.getElementById('syncNotifications');
    if (syncNotifications) {
      syncNotifications.addEventListener('change', (e) => {
        this.syncNotifications = e.target.checked;
        localStorage.setItem(
          'byf_sync_notifications',
          this.syncNotifications.toString()
        );
      });
      console.log('✅ Sync notifications toggle listener attached');
    }

    // Export buttons
    const exportCloudBtn = document.getElementById('exportCloudDataBtn');
    if (exportCloudBtn) {
      exportCloudBtn.addEventListener('click', this.exportCloudData.bind(this));
      console.log('✅ Export cloud button listener attached');
    }

    const exportLocalBtn = document.getElementById('exportLocalDataBtn');
    if (exportLocalBtn) {
      exportLocalBtn.addEventListener('click', this.exportLocalData.bind(this));
      console.log('✅ Export local button listener attached');
    }

    // Reset buttons
    const resetLocalBtn = document.getElementById('resetLocalDataBtn');
    if (resetLocalBtn) {
      resetLocalBtn.addEventListener('click', this.resetLocalData.bind(this));
    }

    const resetCloudBtn = document.getElementById('resetCloudDataBtn');
    if (resetCloudBtn) {
      resetCloudBtn.addEventListener('click', this.resetCloudData.bind(this));
    }

    const resetAllBtn = document.getElementById('resetAllDataBtn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', this.resetAllData.bind(this));
    }

    // View stats button
    const viewStatsBtn = document.getElementById('viewStatsBtn');
    if (viewStatsBtn) {
      viewStatsBtn.addEventListener('click', this.viewAppStats.bind(this));
    }

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
    console.log(`✅ ${themeRadios.length} theme radio listeners attached`);

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

    // Enhanced reset buttons
    const resetStreaksBtn = document.getElementById('resetStreaksBtn');
    const clearTodayBtn = document.getElementById('clearTodayBtn');
    const resetProfileBtn = document.getElementById('resetProfileBtn');
    const resetLogsBtn = document.getElementById('resetLogsBtn');

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

    console.log('✅ Settings event listeners setup complete');
  }

  /**
   * Setup settings-specific event listeners
   */
  setupSettingsEventListeners() {
    // Force sync button
    const forceSyncBtn = document.getElementById('forceSyncBtn');
    if (forceSyncBtn) {
      forceSyncBtn.addEventListener('click', this.forceSync.bind(this));
    }

    // Test connection button in settings
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener(
        'click',
        this.handleTestConnection.bind(this)
      );
    }

    // Update API key button
    const updateApiKeyBtn = document.getElementById('updateApiKeyBtn');
    if (updateApiKeyBtn) {
      updateApiKeyBtn.addEventListener(
        'click',
        this.handleUpdateApiKey.bind(this)
      );
    }

    // Toggle API key visibility in settings
    const toggleSettingsApiKey = document.getElementById(
      'toggleSettingsApiKey'
    );
    if (toggleSettingsApiKey) {
      toggleSettingsApiKey.addEventListener('click', () =>
        this.togglePasswordVisibility('settingsApiKey')
      );
    }

    // Auto sync toggle
    const autoSyncEnabled = document.getElementById('autoSyncEnabled');
    if (autoSyncEnabled) {
      autoSyncEnabled.addEventListener('change', (e) => {
        this.autoSyncEnabled = e.target.checked;
        localStorage.setItem('byf_auto_sync', this.autoSyncEnabled.toString());
        if (this.autoSyncEnabled) {
          this.startAutoSync();
        } else if (this.autoSyncInterval) {
          clearInterval(this.autoSyncInterval);
        }
      });
    }

    // Sync notifications toggle
    const syncNotifications = document.getElementById('syncNotifications');
    if (syncNotifications) {
      syncNotifications.addEventListener('change', (e) => {
        this.syncNotifications = e.target.checked;
        localStorage.setItem(
          'byf_sync_notifications',
          this.syncNotifications.toString()
        );
      });
    }

    // Export buttons
    const exportCloudBtn = document.getElementById('exportCloudDataBtn');
    if (exportCloudBtn) {
      exportCloudBtn.addEventListener('click', this.exportCloudData.bind(this));
    }

    const exportLocalBtn = document.getElementById('exportLocalDataBtn');
    if (exportLocalBtn) {
      exportLocalBtn.addEventListener('click', this.exportLocalData.bind(this));
    }

    // Reset buttons
    const resetLocalBtn = document.getElementById('resetLocalDataBtn');
    if (resetLocalBtn) {
      resetLocalBtn.addEventListener('click', this.resetLocalData.bind(this));
    }

    const resetCloudBtn = document.getElementById('resetCloudDataBtn');
    if (resetCloudBtn) {
      resetCloudBtn.addEventListener('click', this.resetCloudData.bind(this));
    }

    const resetAllBtn = document.getElementById('resetAllDataBtn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', this.resetAllData.bind(this));
    }

    // View stats button
    const viewStatsBtn = document.getElementById('viewStatsBtn');
    if (viewStatsBtn) {
      viewStatsBtn.addEventListener('click', this.viewAppStats.bind(this));
    }

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

    // Enhanced reset buttons
    const resetStreaksBtn = document.getElementById('resetStreaksBtn');
    const clearTodayBtn = document.getElementById('clearTodayBtn');
    const resetProfileBtn = document.getElementById('resetProfileBtn');
    const resetLogsBtn = document.getElementById('resetLogsBtn');

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

    // Import file handler (enhanced)
    const importFile = document.getElementById('importFile');
    if (importFile) {
      importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          // Use existing importData logic but ensure it syncs to cloud
          this.importData(file);
        }
      });
    }
  }

  /**
   * Enhanced test connection with better validation for Airtable
   */
  async handleTestConnection() {
    const tokenInput = document.getElementById('airtableToken');
    const baseIdInput = document.getElementById('airtableBaseId');
    const token = tokenInput ? tokenInput.value.trim() : '';
    const baseId = baseIdInput ? baseIdInput.value.trim() : '';

    // Validate token format first
    const tokenValidation = this.validateApiKeyFormat(token);
    if (!tokenValidation.valid) {
      this.updateConnectionStatus('error', tokenValidation.message);
      return;
    }

    // Validate base ID format
    const baseIdValidation = this.validateBaseIdFormat(baseId);
    if (!baseIdValidation.valid) {
      this.updateConnectionStatus('error', baseIdValidation.message);
      return;
    }

    // Show validation success message briefly
    this.updateConnectionStatus(
      'testing',
      'Credentials look good, testing connection...'
    );

    // Wait a moment then proceed with connection test
    setTimeout(async () => {
      // Temporarily set credentials for testing
      const originalToken = this.cloudConfig.token;
      const originalBaseId = this.cloudConfig.baseId;
      this.cloudConfig.token = token;
      this.cloudConfig.baseId = baseId;

      const success = await this.testCloudConnection();

      if (success) {
        this.updateConnectionStatus(
          'success',
          '✅ Connection successful! You can now complete your profile setup.'
        );
        this.saveCloudConfig();

        // Show profile section
        const profileSection = document.getElementById('profileSection');
        if (profileSection) {
          profileSection.style.display = 'block';
          profileSection.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        // Restore original credentials if test failed
        this.cloudConfig.token = originalToken;
        this.cloudConfig.baseId = originalBaseId;
      }
    }, 1000);
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      // Update button icon
      const toggleBtn = input.parentElement.querySelector('.toggle-password');
      if (toggleBtn) {
        toggleBtn.textContent = isPassword ? '🙈' : '👁️';
      }
    }
  }

  /**
   * Handle user profile setup with cloud integration
   */
  async handleSetup(e) {
    e.preventDefault();

    // Ensure Airtable credentials are set
    if (!this.cloudConfig.token || !this.cloudConfig.baseId) {
      this.showError('Please test your Airtable connection first');
      return;
    }

    const formData = new FormData(e.target);

    // Parse form values with validation
    const startingWeight = parseFloat(formData.get('startingWeight'));
    const goalWeight = parseFloat(formData.get('goalWeight'));
    const dailySteps = parseInt(formData.get('dailySteps'));
    const dailyExercise = parseInt(formData.get('dailyExercise'));
    const dailyWater = parseFloat(formData.get('dailyWater'));

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

    // Save locally first
    this.saveLocalData();

    // Try to sync to cloud
    const cloudSyncSuccess = await this.saveToCloud();

    // Show app regardless of cloud sync status
    this.showAppScreen();
    this.updateDashboard();
    this.initializeDefaultMilestones();

    if (cloudSyncSuccess) {
      this.showSuccess(
        '🎉 Profile created and synced to cloud! Start logging your fitness journey.'
      );
    } else {
      this.showSuccess(
        'Profile created! Data saved locally and will sync when cloud connection is restored.'
      );
    }
  }

  /**
   * Handle daily log submission with cloud sync
   */
  async handleDailyLog(e) {
    e.preventDefault();

    const today = this.currentDate;

    // Get form values
    const weightInput = document.getElementById('todayWeight');
    const stepsInput = document.getElementById('todaySteps');
    const exerciseInput = document.getElementById('todayExerciseMinutes');
    const waterInput = document.getElementById('todayWater');

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
      waterInput && waterInput.value !== '' ? parseFloat(waterInput.value) : 0;

    // Get selected exercise types
    const exerciseTypes = Array.from(
      document.querySelectorAll('.exercise-checkbox:checked')
    ).map((cb) => cb.value);

    // Get wellness score
    const wellnessItems = Array.from(
      document.querySelectorAll('.wellness-checkbox:checked')
    ).map((cb) => cb.dataset.wellness);
    const wellnessScore = wellnessItems.length;

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
      return;
    }

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

    // Save log entry locally first (offline-first approach)
    this.dailyLogs[today] = logEntry;

    // Update user's current weight if provided
    if (weight) {
      this.currentUser.currentWeight = weight;
      this.currentUser.lastWeightUpdate = new Date().toISOString();
    }

    // Update streaks
    this.updateStreaks(logEntry);

    // Save all data locally
    this.saveLocalData();

    // Add to sync queue and try cloud sync
    this.addToSyncQueue('dailyLog', logEntry);

    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      await this.saveToCloud();
    }

    // Update dashboard
    this.updateDashboard();

    // Check for achievements
    this.checkAchievements();

    this.showSuccess('✅ Daily log saved successfully!');
  }

  /**
   * Load all data from localStorage (backup storage)
   */
  loadLocalData() {
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

      // Load preferences
      this.autoSyncEnabled = localStorage.getItem('byf_auto_sync') !== 'false';
      this.syncNotifications =
        localStorage.getItem('byf_sync_notifications') !== 'false';

      // Load theme preference
      const savedTheme = localStorage.getItem('byf_theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.updateThemeToggle(savedTheme);
    } catch (error) {
      console.error('Error loading local data:', error);
      this.showError('Failed to load saved data. Starting fresh.');
    }

    this.loadSettingsFromStorage();
  }

  /**
   * Save all data to localStorage (backup storage)
   */
  saveLocalData() {
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
      console.error('Error saving local data:', error);
      this.showError('Failed to save data locally. Please try again.');
    }
  }

  /**
   * Load settings tab content
   */
  loadSettingsTab() {
    this.updateSettingsDisplay();
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
    this.updateSyncStatus();
  }

  /**
   * Update streak display in sidebar
   */
  updateStreakDisplay() {
    const currentStreakEl = document.getElementById('currentStreak');
    if (currentStreakEl) {
      currentStreakEl.textContent = this.streaks.overall;
    }

    const streakTypes = ['steps', 'exercise', 'water', 'wellness'];
    streakTypes.forEach((type) => {
      const streakEl = document.getElementById(`${type}Streak`);
      if (streakEl) {
        const valueEl = streakEl.querySelector('.streak-value');
        if (valueEl) {
          valueEl.textContent = this.streaks[type];
        }

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
   * Load today's data into the form
   */
  loadTodaysData() {
    const todaysLog = this.dailyLogs[this.currentDate];

    if (!todaysLog) return;

    // Load form values
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

    // Clear existing selections first
    document
      .querySelectorAll('.exercise-checkbox')
      .forEach((cb) => (cb.checked = false));
    document
      .querySelectorAll('.wellness-checkbox')
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
   * Toggle theme between light and dark
   */
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('byf_theme', newTheme);

    this.updateThemeToggle(newTheme);
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
   * Show main app screen
   */
  showAppScreen() {
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    this.initializeDefaultMilestones();
  }

  /**
   * Show success message
   */
  showSuccess(message, duration = 3000) {
    const existingMessages = document.querySelectorAll('.success-message');
    existingMessages.forEach((msg) => msg.remove());

    const successEl = document.createElement('div');
    successEl.className = 'success-message';
    successEl.textContent = message;

    document.body.appendChild(successEl);

    setTimeout(() => {
      successEl.classList.add('show');
    }, 100);

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
   * Get app statistics for debugging/info
   */
  getAppStats() {
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
      version: 'Airtable v1.1.0',
      cloudConnected: this.cloudConfig.isConnected,
      lastCloudSync: this.cloudConfig.lastSync,
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
      pendingSyncs: this.syncQueue.filter((item) => !item.synced).length,
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

    return stats;
  }

  /**
   * Handle theme preference changes (enhanced for cloud)
   */
  handleThemePreferenceChange(e) {
    const value = e.target.value;
    this.settings = this.settings || {};
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

    // Sync settings to cloud
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      this.saveToCloud();
    }
  }

  /**
   * Handle general setting changes (enhanced for cloud with UI updates)
   */
  handleSettingChange(e) {
    const setting = e.target.id;
    const value =
      e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    console.log(`🔧 Setting changed: ${setting} = ${value}`);

    this.settings = this.settings || {};
    this.settings[setting] = value;
    this.saveSettings();

    // Apply certain settings immediately with UI updates
    if (setting === 'weekStart') {
      // Re-render calendar if it's currently visible
      if (this.currentTab === 'charts') {
        this.renderStreakCalendar();
      }
    } else if (setting === 'weightUnit') {
      console.log(`🔄 Weight unit changed to: ${value}`);
      // Update all weight displays immediately
      this.updateWeightDisplays();
      // Also update the settings display to convert the input values
      setTimeout(() => {
        this.updateSettingsDisplay();
      }, 100);
    } else if (setting === 'dateFormat') {
      // Update date displays if needed
      this.updateCurrentDate();
    }

    // Sync settings to cloud
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      this.saveToCloud();
    }
  }

  /**
   * Handle daily goals update (enhanced for cloud)
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

    this.saveLocalData();
    this.updateDashboard();

    // Sync to cloud
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      this.saveToCloud();
      this.showSuccess('Daily goals updated and synced to cloud!');
    } else {
      this.showSuccess('Daily goals updated! Will sync when connected.');
    }
  }

  /**
   * Handle weight goals update (enhanced for cloud)
   */
  handleUpdateWeightGoals() {
    const goalWeightInput = document.getElementById('settingsGoalWeight');
    const goalWeight = parseFloat(goalWeightInput.value);

    // Validate input
    if (isNaN(goalWeight) || goalWeight < 50 || goalWeight > 1000) {
      this.showError('Goal weight must be between 50 and 1000 lbs');
      return;
    }

    if (Math.abs(goalWeight - this.currentUser.startingWeight) < 1) {
      this.showError(
        'Goal weight should be at least 1 lb different from starting weight'
      );
      return;
    }

    // Update goal weight
    this.currentUser.goalWeight = goalWeight;

    // Regenerate weight milestones
    this.initializeDefaultMilestones();

    this.saveLocalData();
    this.updateDashboard();

    // Sync to cloud
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      this.saveToCloud();
      this.showSuccess('Weight goal updated and synced to cloud!');
    } else {
      this.showSuccess('Weight goal updated! Will sync when connected.');
    }
  }

  /**
   * Reset functions adapted for cloud version
   */

  /**
   * Reset streaks only (cloud version)
   */
  resetStreaks() {
    if (!confirm('This will reset all your streaks to 0. Continue?')) return;

    this.streaks = this.initializeStreaks();
    this.saveLocalData();
    this.updateDashboard();

    // Sync to cloud
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      this.saveToCloud();
      this.showSuccess('All streaks reset and synced to cloud!');
    } else {
      this.showSuccess('All streaks reset! Will sync when connected.');
    }
  }

  /**
   * Clear today's log only (cloud version)
   */
  clearTodaysLog() {
    if (!confirm("This will clear today's fitness log. Continue?")) return;

    delete this.dailyLogs[this.currentDate];
    this.saveLocalData();
    this.updateDashboard();
    this.loadTodaysData(); // Refresh the form

    // Sync to cloud
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      this.saveToCloud();
      this.showSuccess("Today's log cleared and synced to cloud!");
    } else {
      this.showSuccess("Today's log cleared! Will sync when connected.");
    }
  }

  /**
   * Reset profile but keep logs (cloud version)
   */
  resetProfile() {
    if (
      !confirm(
        'This will reset your profile but keep your daily logs. Continue?'
      )
    )
      return;

    // Reset user profile
    this.currentUser = null;
    this.saveLocalData();

    // Sync to cloud
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      this.saveToCloud();
    }

    this.showSetupScreen();
    this.showSuccess('Profile reset. Please set up your goals again.');
  }

  /**
   * Clear all logs but keep profile (cloud version)
   */
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
    this.achievements = []; // Clear achievements since they're based on logs
    this.saveLocalData();
    this.updateDashboard();

    // Sync to cloud
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      this.saveToCloud();
      this.showSuccess('All daily logs cleared and synced to cloud!');
    } else {
      this.showSuccess('All daily logs cleared! Will sync when connected.');
    }
  }

  /**
   * Get default settings (for cloud version)
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

  /**
   * Save settings to localStorage (enhanced for cloud)
   */
  saveSettings() {
    try {
      localStorage.setItem('byf_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  /**
   * Load settings tab content (enhanced for cloud)
   */
  loadSettingsTab() {
    console.log('📋 Loading settings tab...');

    // Load settings from storage first
    this.loadSettingsFromStorage();

    // Update the display after a short delay to ensure DOM is ready
    setTimeout(() => {
      console.log('🔄 Delayed settings display update...');
      this.updateSettingsDisplay();
    }, 100);

    // Also add immediate update for good measure
    this.updateSettingsDisplay();

    console.log('✅ Settings tab loaded successfully');
  }

  /**
   * Setup event listeners specifically for settings tab elements
   */
  setupSettingsTabEventListeners() {
    // Force sync button
    const forceSyncBtn = document.getElementById('forceSyncBtn');
    if (forceSyncBtn) {
      // Remove existing listener and add new one
      forceSyncBtn.replaceWith(forceSyncBtn.cloneNode(true));
      document.getElementById('forceSyncBtn').addEventListener('click', () => {
        console.log('Force sync clicked from settings');
        this.forceSync();
      });
    }

    // Test connection button in settings
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
      // Remove existing listener and add new one
      testConnectionBtn.replaceWith(testConnectionBtn.cloneNode(true));
      document
        .getElementById('testConnectionBtn')
        .addEventListener('click', () => {
          console.log('Test connection clicked from settings');
          this.handleTestConnection();
        });
    }

    // Update API key button
    const updateApiKeyBtn = document.getElementById('updateApiKeyBtn');
    if (updateApiKeyBtn) {
      updateApiKeyBtn.replaceWith(updateApiKeyBtn.cloneNode(true));
      document
        .getElementById('updateApiKeyBtn')
        .addEventListener('click', () => {
          this.handleUpdateApiKey();
        });
    }

    console.log('Settings tab event listeners attached');
  }

  /**
   * Load settings from storage (new function)
   */
  loadSettingsFromStorage() {
    try {
      // Load settings from localStorage
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

    // Apply initial UI updates based on loaded settings
    if (this.settings.weightUnit && this.settings.weightUnit !== 'lbs') {
      // Delay to ensure DOM is ready
      setTimeout(() => {
        this.updateWeightDisplays();
      }, 500);
    }
  }

  /**
   * Setup system theme preference listener (new function)
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
   * Update settings display with enhanced DOM checking
   */
  updateSettingsDisplay() {
    console.log('🔄 Updating settings display...');
    console.log('Current connection status:', this.cloudConfig.isConnected);
    console.log('Last sync:', this.cloudConfig.lastSync);

    // Wait a moment for DOM to be ready if we're on settings tab
    if (this.currentTab === 'settings') {
      // Use setTimeout to ensure DOM elements are rendered
      setTimeout(() => {
        this.doSettingsDisplayUpdate();
      }, 50);
    } else {
      this.doSettingsDisplayUpdate();
    }
  }

  /**
   * Actually perform the settings display update
   */
  doSettingsDisplayUpdate() {
    console.log('🎯 Performing settings display update...');

    // Check if we're actually on the settings tab
    const settingsTab = document.getElementById('settingsTab');
    if (!settingsTab || settingsTab.classList.contains('hidden')) {
      console.log('⏭️ Not on settings tab, skipping update');
      return;
    }

    // Update connection status - CRITICAL FIX
    const connectionStatusEl = document.getElementById(
      'settingsConnectionStatus'
    );
    if (connectionStatusEl) {
      const status = this.cloudConfig.isConnected
        ? '✅ Connected'
        : '❌ Disconnected';
      connectionStatusEl.textContent = status;
      connectionStatusEl.style.color = this.cloudConfig.isConnected
        ? 'var(--accent-success)'
        : 'var(--accent-danger)';
      console.log('✅ Connection status updated to:', status);
    } else {
      console.warn('❌ settingsConnectionStatus element not found');
      // Let's check what settings elements exist
      console.log('Available settings elements:', {
        settingsTab: !!document.getElementById('settingsTab'),
        connectionInfo: !!document.getElementById('connectionInfo'),
        settingsContainer: !!document.querySelector('.settings-container'),
      });
    }

    // Update last sync time - CRITICAL FIX
    const lastSyncEl = document.getElementById('lastSyncTime');
    if (lastSyncEl) {
      if (this.cloudConfig.lastSync) {
        const lastSync = new Date(this.cloudConfig.lastSync);
        const syncTime = lastSync.toLocaleString();
        lastSyncEl.textContent = syncTime;
        lastSyncEl.style.color = 'var(--accent-success)';
        console.log('✅ Last sync time updated to:', syncTime);
      } else {
        lastSyncEl.textContent = 'Never';
        lastSyncEl.style.color = 'var(--text-secondary)';
        console.log('✅ Last sync time set to: Never');
      }
    } else {
      console.warn('❌ lastSyncTime element not found');
    }

    // Update pending syncs count with visual feedback
    const pendingSyncsEl = document.getElementById('pendingSyncs');
    if (pendingSyncsEl) {
      const pendingCount = this.syncQueue
        ? this.syncQueue.filter((item) => !item.synced).length
        : 0;
      pendingSyncsEl.textContent = pendingCount.toString();
      console.log('✅ Pending syncs updated to:', pendingCount);

      // Style based on pending count with more visible changes
      if (pendingCount > 0) {
        pendingSyncsEl.style.color = 'var(--accent-warning)';
        pendingSyncsEl.style.fontWeight = 'bold';
        pendingSyncsEl.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
        pendingSyncsEl.style.padding = '2px 6px';
        pendingSyncsEl.style.borderRadius = '4px';
      } else {
        pendingSyncsEl.style.color = 'var(--accent-success)';
        pendingSyncsEl.style.fontWeight = 'bold';
        pendingSyncsEl.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
        pendingSyncsEl.style.padding = '2px 6px';
        pendingSyncsEl.style.borderRadius = '4px';
      }
    } else {
      console.warn('❌ pendingSyncs element not found');
    }

    // Update API key display with masked value
    const settingsApiKeyEl = document.getElementById('settingsApiKey');
    if (settingsApiKeyEl && this.cloudConfig.token) {
      const maskedToken =
        this.cloudConfig.token.substring(0, 8) + '••••••••••••';
      settingsApiKeyEl.placeholder = maskedToken;
      console.log('✅ API key display updated');
    }

    // Update data statistics with better formatting
    const totalEntriesEl = document.getElementById('totalDataEntries');
    if (totalEntriesEl) {
      const totalEntries = this.dailyLogs
        ? Object.keys(this.dailyLogs).length
        : 0;
      totalEntriesEl.textContent = totalEntries.toString();
      totalEntriesEl.style.fontWeight = 'bold';
      totalEntriesEl.style.color = 'var(--accent-primary)';
      console.log('✅ Total entries updated to:', totalEntries);
    }

    const storageUsedEl = document.getElementById('storageUsed');
    if (storageUsedEl) {
      const dataSize = JSON.stringify({
        user: this.currentUser,
        dailyLogs: this.dailyLogs,
        streaks: this.streaks,
        customRewards: this.customRewards,
        achievements: this.achievements,
      }).length;
      const sizeInKB = Math.round(dataSize / 1024);
      storageUsedEl.textContent = `~${sizeInKB} KB`;
      storageUsedEl.style.fontWeight = 'bold';
      storageUsedEl.style.color = 'var(--accent-primary)';
      console.log('✅ Storage used updated to:', `~${sizeInKB} KB`);
    }

    // Update user preferences checkboxes
    const autoSyncCheckbox = document.getElementById('autoSyncEnabled');
    if (autoSyncCheckbox) {
      autoSyncCheckbox.checked = this.autoSyncEnabled;
      console.log('✅ Auto sync checkbox updated to:', this.autoSyncEnabled);
    }

    const syncNotificationsCheckbox =
      document.getElementById('syncNotifications');
    if (syncNotificationsCheckbox) {
      syncNotificationsCheckbox.checked = this.syncNotifications;
      console.log(
        '✅ Sync notifications checkbox updated to:',
        this.syncNotifications
      );
    }

    // Update theme preference radio buttons
    if (this.settings) {
      const themePreference = this.settings.themePreference || 'system';
      const themeRadio = document.querySelector(
        `input[value="${themePreference}"]`
      );
      if (themeRadio) {
        themeRadio.checked = true;
        console.log('✅ Theme preference updated to:', themePreference);
      }

      // Update unit and format selectors
      const weightUnit = document.getElementById('weightUnit');
      const dateFormat = document.getElementById('dateFormat');
      const weekStart = document.getElementById('weekStart');

      if (weightUnit && this.settings.weightUnit) {
        weightUnit.value = this.settings.weightUnit;
        console.log('✅ Weight unit updated to:', this.settings.weightUnit);
      }
      if (dateFormat && this.settings.dateFormat) {
        dateFormat.value = this.settings.dateFormat;
        console.log('✅ Date format updated to:', this.settings.dateFormat);
      }
      if (weekStart && this.settings.weekStart) {
        weekStart.value = this.settings.weekStart;
        console.log('✅ Week start updated to:', this.settings.weekStart);
      }

      // Update goal threshold checkboxes
      const allowPartialSteps = document.getElementById('allowPartialSteps');
      const allowPartialExercise = document.getElementById(
        'allowPartialExercise'
      );
      const strictWellness = document.getElementById('strictWellness');

      if (allowPartialSteps) {
        allowPartialSteps.checked = this.settings.allowPartialSteps || false;
      }
      if (allowPartialExercise) {
        allowPartialExercise.checked =
          this.settings.allowPartialExercise || false;
      }
      if (strictWellness) {
        strictWellness.checked = this.settings.strictWellness || false;
      }
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

      if (settingsSteps) {
        settingsSteps.value = this.currentUser.dailySteps;
        console.log('✅ Steps goal updated to:', this.currentUser.dailySteps);
      }
      if (settingsExercise) {
        settingsExercise.value = this.currentUser.dailyExercise;
        console.log(
          '✅ Exercise goal updated to:',
          this.currentUser.dailyExercise
        );
      }
      if (settingsWater) {
        settingsWater.value = this.currentUser.dailyWater;
        console.log('✅ Water goal updated to:', this.currentUser.dailyWater);
      }
      if (settingsStartingWeight) {
        settingsStartingWeight.value = this.currentUser.startingWeight;
      }
      if (settingsGoalWeight) {
        settingsGoalWeight.value = this.currentUser.goalWeight;
      }
    }

    console.log('🎉 Settings display update complete');
  }

  /**
   * Load charts tab content
   */
  loadChartsTab() {
    const isMobile = window.innerWidth <= 768;
    const delay = isMobile ? 300 : 100;

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          if (isMobile) {
            this.renderWeightChart();
            setTimeout(() => this.renderActivityChart(), 150);
            setTimeout(() => this.renderStreakCalendar(), 300);
          } else {
            this.renderWeightChart();
            this.renderActivityChart();
            this.renderStreakCalendar();
          }
        } catch (error) {
          console.error('Error rendering charts:', error);
        }
      }, delay);
    });
  }

  /**
   * Set chart period and update charts
   */
  setChartPeriod(period) {
    this.chartPeriod = period;

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

    this.renderWeightChart();
    this.renderActivityChart();
  }

  /**
   * Render weight progress chart using Canvas
   */
  renderWeightChart() {
    const canvas = document.getElementById('weightChart');
    if (!canvas) return;

    const container = canvas.parentElement;
    const isMobile = window.innerWidth <= 768;
    const pixelRatio = isMobile ? 1 : window.devicePixelRatio || 1;
    const containerWidth = container.offsetWidth || (isMobile ? 350 : 800);
    const containerHeight = container.offsetHeight || (isMobile ? 250 : 400);

    canvas.width = containerWidth * pixelRatio;
    canvas.height = containerHeight * pixelRatio;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    const width = containerWidth;
    const height = containerHeight;

    const padding = { top: 40, right: 40, bottom: 60, left: 60 };

    const weightData = this.getWeightData();
    if (weightData.length === 0) {
      this.drawNoDataMessage(ctx, width, height, 'No weight data available');
      return;
    }

    ctx.clearRect(0, 0, width, height);

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
    console.log(
      `📊 Goal weight for chart: ${goalWeightForChart.toFixed(1)} ${weightUnit}`
    );

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

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

    for (let i = 0; i <= 5; i++) {
      const weight = minWeight + (maxWeight - minWeight) * (i / 5);
      const y = yScale(weight);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

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

      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue('--accent-success');
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      const weightUnit = this.settings?.weightUnit || 'lbs';
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

    this.updateWeightTrend(weightData);
  }

  /**
   * Get filtered weight data based on chart period
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
   * Render activity summary chart
   */
  renderActivityChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    const container = canvas.parentElement;
    const isMobile = window.innerWidth <= 768;
    const pixelRatio = isMobile ? 1 : window.devicePixelRatio || 1;
    const containerWidth = container.offsetWidth || (isMobile ? 350 : 800);
    const containerHeight = container.offsetHeight || (isMobile ? 250 : 400);

    canvas.width = containerWidth * pixelRatio;
    canvas.height = containerHeight * pixelRatio;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    const width = containerWidth;
    const height = containerHeight;

    const activityData = this.getActivityData();
    if (activityData.length === 0) {
      this.drawNoDataMessage(ctx, width, height, 'No activity data available');
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 40, right: 40, bottom: 80, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const barWidth = (chartWidth / activityData.length) * 0.8;
    const barSpacing = (chartWidth / activityData.length) * 0.2;

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

    this.drawGoalLines(ctx, padding, chartWidth, chartHeight, {
      steps: this.currentUser.dailySteps / maxSteps,
      exercise: this.currentUser.dailyExercise / maxExercise,
      water: this.currentUser.dailyWater / maxWater,
    });

    activityData.forEach((data, index) => {
      const x = padding.left + index * (barWidth + barSpacing) + barSpacing / 2;

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

    this.drawActivityLegend(ctx, width, height, padding);

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
      ctx.fillStyle = getComputedStyle(
        document.documentElement
      ).getPropertyValue(item.color);
      ctx.fillRect(legendX, legendY, 12, 12);

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

    calendarContainer.innerHTML = '';

    const calendarGrid = document.createElement('div');
    calendarGrid.className = 'calendar-grid';

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

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    for (let i = 0; i < startingDayOfWeek; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'calendar-day other-month';
      calendarGrid.appendChild(emptyDay);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.textContent = day;

      const dateString = `${year}-${String(month + 1).padStart(
        2,
        '0'
      )}-${String(day).padStart(2, '0')}`;
      const dayLog = this.dailyLogs[dateString];

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
   * Check if day's goals were met
   */
  checkDayGoalsMet(dayLog) {
    const goalsmet = {
      steps: dayLog.steps >= this.currentUser.dailySteps,
      exercise: dayLog.exerciseMinutes >= this.currentUser.dailyExercise,
      water: dayLog.water >= this.currentUser.dailyWater,
      wellness: dayLog.wellnessScore >= 3,
    };

    const weeklyWeight = this.checkWeeklyWeight(dayLog.date);

    return {
      some: Object.values(goalsmet).some((met) => met),
      all: Object.values(goalsmet).every((met) => met) && weeklyWeight,
    };
  }

  // Include all rewards/milestone methods from the original version
  // These remain identical as they handle the gamification logic

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

      // Weight loss milestones (including custom rewards)
      ...this.generateWeightMilestones(),
    ];

    console.log(
      `🏆 Initialized ${this.defaultMilestones.length} total milestones`
    );
  }

  /**
   * Generate weight loss milestones based on user's goals
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

    if (!this.defaultMilestones) {
      this.initializeDefaultMilestones();
    }

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
   * Create milestone element
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

    // Handle both default and custom rewards
    let rewardText = 'Set custom reward...';
    let isEditable = true;

    if (milestone.isCustom && milestone.customReward) {
      rewardText = milestone.customReward.description;
      isEditable = false; // Custom milestone rewards aren't editable this way
    } else {
      const customReward = this.getCustomRewardForMilestone(milestone);
      if (customReward) {
        rewardText = customReward.description;
        isEditable = false; // Already has custom reward, not editable
      }
    }

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
      ${
        isEditable ? `onclick="app.editMilestoneReward(this)"` : ''
      }>${rewardText}</div>
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

    console.log(`🎯 Editing milestone: ${milestoneType} ${milestoneValue}`);

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
    const milestoneDescription =
      milestoneType === 'weight'
        ? `${milestoneValue} lbs lost`
        : `${milestoneValue} day streak`;

    const rewardDescription = prompt(
      `Set your custom reward for this milestone:\n\n${milestoneDescription}`,
      'Enter your reward (e.g., "Spa day", "New workout clothes", "Cheat meal")'
    );

    if (
      !rewardDescription ||
      rewardDescription.trim() === '' ||
      rewardDescription ===
        'Enter your reward (e.g., "Spa day", "New workout clothes", "Cheat meal")'
    ) {
      return;
    }

    // Create custom reward
    const customReward = {
      type: milestoneType,
      description: rewardDescription.trim(),
      createdDate: new Date().toISOString(),
    };

    if (milestoneType === 'weight') {
      customReward.weightLoss = milestoneValue;
    } else if (milestoneType === 'streak') {
      customReward.streakDays = milestoneValue;
    }

    this.customRewards.push(customReward);
    this.saveLocalData();

    // Add to sync queue and sync to Airtable
    this.addToSyncQueue('customReward', customReward);
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      this.saveToCloud();
    }

    // Refresh displays
    this.initializeDefaultMilestones();
    this.renderDefaultMilestones();
    this.renderCustomRewards();

    this.showSuccess(`Custom reward added: "${rewardDescription}"`);
    console.log(
      `✅ Custom reward created for ${milestoneType} ${milestoneValue}`
    );
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
   * Check if milestone has been claimed
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
  async claimMilestone(type, value) {
    const milestone = this.defaultMilestones.find(
      (m) => m.type === type && m.value === value
    );
    if (!milestone || !this.isMilestoneAchieved(milestone)) return;

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
    this.saveLocalData();

    // Add to sync queue and sync to cloud
    this.addToSyncQueue('achievement', achievement);
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      await this.saveToCloud();
    }

    this.showAchievementModal(achievement);
    this.renderDefaultMilestones();
    this.renderAchievementHistory();
  }

  /**
   * Handle custom reward form submission
   */
  async handleCustomReward(e) {
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
    this.saveLocalData();

    // Add to sync queue and sync to cloud
    this.addToSyncQueue('customReward', reward);
    if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
      await this.saveToCloud();
    }

    e.target.reset();
    this.updateRewardCriteria();
    this.renderCustomRewards();
    this.renderDefaultMilestones();

    // Refresh milestones to include the new custom reward
    this.initializeDefaultMilestones();

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
  async deleteCustomReward(index) {
    if (confirm('Are you sure you want to delete this reward?')) {
      this.customRewards.splice(index, 1);
      this.saveLocalData();

      // Add to sync queue and sync to cloud
      this.addToSyncQueue('deleteCustomReward', { index });
      if (this.autoSyncEnabled && this.cloudConfig.isConnected) {
        await this.saveToCloud();
      }

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
    let modal = document.getElementById('achievementModal');
    if (!modal) {
      modal = this.createAchievementModal();
      document.body.appendChild(modal);
    }

    const title = modal.querySelector('.modal-title');
    const message = modal.querySelector('.modal-message');

    title.textContent = '🎉 Achievement Claimed!';

    const rewardText = achievement.customReward
      ? ` Enjoy your reward: ${achievement.customReward.description}`
      : ` Consider setting a custom reward for future milestones!`;

    message.textContent = `${achievement.title} - ${achievement.description}.${rewardText}`;

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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create global app instance
  window.app = new BribeYourselfFitCloud();

  // Add helpful global functions for development and user access
  window.exportData = () => app.exportLocalData();
  window.exportCloudData = () => app.exportCloudData();
  window.forceSync = () => app.forceSync();
  window.testConnection = () => app.testCloudConnection();
  window.getStats = () => app.getAppStats();
  window.resetData = () => app.resetAllData();

  console.log('🎉 BribeYourselfFit Cloud initialized successfully!');
  console.log('Cloud commands available:');
  console.log('- exportData() - Export local data backup');
  console.log('- exportCloudData() - Export cloud data');
  console.log('- forceSync() - Force immediate sync');
  console.log('- testConnection() - Test cloud connection');
  console.log('- getStats() - View app statistics');
  console.log('- resetData() - Reset all data (careful!)');
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
      case 's':
        e.preventDefault();
        if (window.app) window.app.forceSync();
        break;
    }
  }
});

/**
 * Handle window beforeunload to prevent data loss
 */
window.addEventListener('beforeunload', (e) => {
  if (window.app && window.app.syncQueue && window.app.syncQueue.length > 0) {
    const unsyncedItems = window.app.syncQueue.filter(
      (item) => !item.synced
    ).length;
    if (unsyncedItems > 0) {
      e.preventDefault();
      e.returnValue = `You have ${unsyncedItems} unsynced changes. Are you sure you want to leave?`;
      return e.returnValue;
    }
  }
});

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

/**
 * Network status monitoring for sync
 */
window.addEventListener('online', () => {
  console.log('Network connection restored');
  if (window.app && window.app.autoSyncEnabled) {
    setTimeout(() => {
      window.app.testCloudConnection().then((connected) => {
        if (connected && window.app.syncQueue.length > 0) {
          window.app.forceSync();
        }
      });
    }, 1000);
  }
});

window.addEventListener('offline', () => {
  console.log('Network connection lost');
  if (window.app) {
    window.app.updateSyncStatus(
      'offline',
      'Offline - will sync when reconnected'
    );
  }
});

/**
 * PWA Event Listeners
 */
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('PWA install prompt available');
  e.preventDefault();
  if (window.app) {
    window.app.deferredPrompt = e;
    // Could show install button here
  }
});

window.addEventListener('appinstalled', () => {
  console.log('PWA installed successfully');
  if (window.app) {
    window.app.deferredPrompt = null;
    window.app.showSuccess(
      '🎉 App installed! You can now use BribeYourselfFit offline.'
    );
  }
});

/**
 * Service Worker registration for PWA functionality
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
