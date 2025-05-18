/**
 * Bot Detection Module
 * 
 * Performance-optimized module for detecting bots based on behavioral patterns.
 * Designed with a narrow interface to be easily replaceable with WASM implementation.
 */

// Configuration constants
const CONFIG = {
  // Sampling & throttling
  MOUSE_THROTTLE_MS: 50,       // Milliseconds between mouse movement recordings
  KEYBOARD_THROTTLE_MS: 25,    // Milliseconds between keyboard event recordings
  MAX_SAMPLES: 200,            // Maximum number of samples to store
  ANALYSIS_INTERVAL_MS: 500,   // Even more frequent analysis (was 1000)
  
  // Analysis thresholds - much more sensitive values
  MIN_MOUSE_MOVEMENTS: 2,      // Reduced from 3 for faster detection
  MIN_KEYPRESS_SAMPLES: 1,     // Reduced from 2 for faster detection
  
  // Score weights - prioritize the most reliable signals
  WEIGHTS: {
    MOUSE_ENTROPY: 0.45,       // Increased weight (was 0.4)
    TYPING_PATTERN: 0.15,      // Decreased weight (was 0.2)
    NAVIGATION_PATTERN: 0.25,  // Unchanged
    FORM_FILLING: 0.15         // Unchanged
  },
  
  // Score thresholds - much more aggressive threshold
  BOT_THRESHOLD: 0.55,         // Significantly lowered threshold (was 0.65)
  HUMAN_THRESHOLD: 0.3         // Unchanged
};

/**
 * BotDetector class - Main interface for bot detection
 */
class BotDetector {
  constructor() {
    // Data stores
    this.mouseMovements = [];
    this.keyPressTimings = [];
    this.clickEvents = [];
    this.scrollEvents = [];
    this.formInteractions = [];
    
    // State
    this.lastMouseTime = 0;
    this.lastKeyTime = 0;
    this.confidenceScore = 0.5; // Start neutral
    this.isAnalyzing = false;
    this.analysisTimerId = null;

    // Track bot-specific API usage
    this.botEndpointHits = {};
    
    // Event callback references (for removal)
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundClick = this.handleClick.bind(this);
    this.boundScroll = this.handleScroll.bind(this);
    this.boundFormChange = this.handleFormInteraction.bind(this);
    
    // API endpoint for reporting
    this.reportEndpoint = '/bot/behaviorMetrics';

    // Detection for non-standard headers (if the bot sets them directly)
    this.checkBotHeaders();

    // Monitor calls to bot-specific endpoints
    this.hookIntoFetch();
  }

  /**
   * Check for explicit bot headers that might be set
   * (to handle cases where the bot explicitly identifies itself)
   */
  checkBotHeaders() {
    try {
      // Use a side-channel technique to detect headers
      fetch('/graphql', {
        method: 'HEAD',
        credentials: 'same-origin'
      }).then(response => {
        // Look for User-Agent patterns that might indicate a bot
        const userAgent = navigator.userAgent.toLowerCase();
        if (
          userAgent.includes('bot') ||
          userAgent.includes('crawler') ||
          userAgent.includes('spider') ||
          userAgent.includes('headless') ||
          userAgent.includes('automation') ||
          userAgent.includes('playwright') ||
          userAgent.includes('selenium') ||
          userAgent.includes('cypress')
        ) {
          console.log('Bot-like User-Agent detected:', userAgent);
          this.confidenceScore = 0.95; // Very high confidence for explicit bot patterns
          this.reportToServer();
        }
      });
    } catch (e) {
      // Silently fail if this check doesn't work
    }
  }

  /**
   * Hook into window.fetch to observe calls to bot endpoints
   */
  hookIntoFetch() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (...args) => {
      const url = args[0];
      if (typeof url === 'string' && url.startsWith('/bot/') && !url.includes('behaviorMetrics')) {
        const endpoint = url.split('?')[0];
        this.botEndpointHits[endpoint] = (this.botEndpointHits[endpoint] || 0) + 1;
      }
      return originalFetch(...args);
    };
  }

  /**
   * Initialize the detector and start tracking
   * @return {void}
   */
  start() {
    // Attach event listeners with passive option for better performance
    document.addEventListener('mousemove', this.boundMouseMove, { passive: true });
    document.addEventListener('keydown', this.boundKeyDown, { passive: true });
    document.addEventListener('click', this.boundClick, { passive: true });
    document.addEventListener('scroll', this.boundScroll, { passive: true });
    
    // Form interactions (delegated to document)
    document.addEventListener('input', this.boundFormChange, { passive: true });
    
    // Start periodic analysis using requestIdleCallback if available
    this.scheduleAnalysis();
    
    // Add detection for known bot libraries
    this.detectAutomationLibraries();
    
    console.log('Bot detection started');
  }
  
  /**
   * Try to detect common automation libraries
   */
  detectAutomationLibraries() {
    // Check for WebDriver (Selenium)
    if (navigator.webdriver) {
      this.confidenceScore = 0.95;
      console.log('WebDriver detected');
    }
    
    // Check for Playwright/Puppeteer artifacts
    const checkForAutomation = () => {
      // Check for additional artifacts from Playwright/Puppeteer
      const cdp = window.CDP || window.__playwright || window.__puppeteer;
      const pwMeta = window.__pwEvents || window.__pw_inspector__;
      
      if (cdp || pwMeta) {
        this.confidenceScore = 0.95;
        console.log('Automation artifacts detected');
      }
      
      // Check for unusually perfect dimensions/metrics
      if (
        window.outerHeight === window.innerHeight &&
        window.outerWidth === window.innerWidth
      ) {
        this.confidenceScore += 0.1;
      }
    };
    
    // Run checks after a short delay to allow libraries to initialize
    setTimeout(checkForAutomation, 1000);
  }

  /**
   * Stop tracking and clean up resources
   * @return {void}
   */
  stop() {
    // Remove event listeners
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('click', this.boundClick);
    document.removeEventListener('scroll', this.boundScroll);
    document.removeEventListener('input', this.boundFormChange);
    
    // Clear analysis timer
    if (this.analysisTimerId) {
      clearTimeout(this.analysisTimerId);
      this.analysisTimerId = null;
    }
    
    // Clear data
    this.mouseMovements = [];
    this.keyPressTimings = [];
    this.clickEvents = [];
    this.scrollEvents = [];
    this.formInteractions = [];
    
    console.log('Bot detection stopped');
  }

  /**
   * Get the current bot confidence score
   * @return {number} Score between 0-1 (higher = more likely a bot)
   */
  getConfidenceScore() {
    // Ensure we always return a valid number
    return isNaN(this.confidenceScore) ? 0.5 : this.confidenceScore;
  }

  /**
   * Check if the current behavior suggests a bot
   * @return {boolean} True if likely a bot
   */
  isLikelyBot() {
    return this.confidenceScore > CONFIG.BOT_THRESHOLD;
  }

  /**
   * Estimate bot intelligence level based on confidence, navigation, and API use
   * @return {string} 'L0', 'L1', or 'L2'
   */
  getIntelligenceLevel() {
    const navScore = this.calculateNavigationPatterns();
    const endpointCount = Object.values(this.botEndpointHits).reduce((a, b) => a + b, 0);
    const endpointScore = Math.min(1, endpointCount / 3);
    const combined = (this.getConfidenceScore() * 0.5) + (navScore * 0.3) + (endpointScore * 0.2);

    if (combined >= 0.7) return 'L2';
    if (combined >= 0.4) return 'L1';
    return 'L0';
  }

  /**
   * Throttled mouse movement handler
   * @param {MouseEvent} event - Mouse event
   * @return {void}
   */
  handleMouseMove(event) {
    const now = performance.now();
    
    // Throttle recording to reduce performance impact
    if (now - this.lastMouseTime >= CONFIG.MOUSE_THROTTLE_MS) {
      this.lastMouseTime = now;
      
      // Record position and time
      this.mouseMovements.push({
        x: event.clientX,
        y: event.clientY,
        time: now
      });
      
      // Trim if needed
      if (this.mouseMovements.length > CONFIG.MAX_SAMPLES) {
        this.mouseMovements.shift();
      }
      
      // Check for unusually straight mouse movements (immediate analysis)
      if (this.mouseMovements.length >= 3) {
        const last3 = this.mouseMovements.slice(-3);
        if (this.isTooPerfectLine(last3)) {
          this.confidenceScore += 0.1; // Larger increment for suspicious movement
          this.confidenceScore = Math.min(0.95, this.confidenceScore); // Cap at 0.95
        }
      }
    }
  }
  
  /**
   * Check if points form a suspiciously perfect straight line
   * @param {Array} points - Array of point coordinates
   * @return {boolean} - True if suspiciously straight
   */
  isTooPerfectLine(points) {
    if (points.length < 3) return false;
    
    const p1 = points[0];
    const p2 = points[1];
    const p3 = points[2];
    
    // Calculate cross product - if close to 0, points are collinear
    const crossProduct = Math.abs(
      (p2.y - p1.y) * (p3.x - p2.x) - 
      (p2.x - p1.x) * (p3.y - p2.y)
    );
    
    // Check if the timing is suspiciously perfect
    const interval1 = p2.time - p1.time;
    const interval2 = p3.time - p2.time;
    const intervalDiff = Math.abs(interval1 - interval2);
    
    // If points are collinear AND timing is too regular
    return crossProduct < 10 && intervalDiff < 10;
  }

  /**
   * Throttled keyboard event handler
   * @param {KeyboardEvent} event - Keyboard event
   * @return {void}
   */
  handleKeyDown(event) {
    const now = performance.now();
    
    // Throttle recording
    if (now - this.lastKeyTime >= CONFIG.KEYBOARD_THROTTLE_MS) {
      this.lastKeyTime = now;
      
      // Record key and timing (not the actual key for privacy)
      this.keyPressTimings.push({
        time: now,
        modifiers: {
          shift: event.shiftKey,
          ctrl: event.ctrlKey,
          alt: event.altKey,
          meta: event.metaKey
        }
      });
      
      // Trim if needed
      if (this.keyPressTimings.length > CONFIG.MAX_SAMPLES) {
        this.keyPressTimings.shift();
      }
      
      // Check for unusually consistent typing intervals
      if (this.keyPressTimings.length >= 3) {
        this.detectMechanicalTyping();
      }
    }
  }
  
  /**
   * Detect suspiciously consistent typing patterns
   */
  detectMechanicalTyping() {
    if (this.keyPressTimings.length < 3) return;
    
    // Get the last few typing intervals
    const intervals = [];
    for (let i = 1; i < Math.min(5, this.keyPressTimings.length); i++) {
      intervals.push(this.keyPressTimings[i].time - this.keyPressTimings[i-1].time);
    }
    
    // Calculate variance in typing intervals
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
    
    // Suspiciously low variance indicates mechanical typing
    if (variance < 500) { // Very consistent timing
      this.confidenceScore += 0.05;
      this.confidenceScore = Math.min(0.95, this.confidenceScore);
    }
  }

  /**
   * Handle click events
   * @param {MouseEvent} event - Click event
   * @return {void}
   */
  handleClick(event) {
    this.clickEvents.push({
      x: event.clientX,
      y: event.clientY,
      target: event.target.tagName,
      time: performance.now()
    });
    
    // Trim if needed
    if (this.clickEvents.length > CONFIG.MAX_SAMPLES / 4) {
      this.clickEvents.shift();
    }
    
    // Check for perfect center clicks (very bot-like)
    if (event.target instanceof HTMLElement) {
      const rect = event.target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distanceToCenter = Math.sqrt(
        Math.pow(event.clientX - centerX, 2) + 
        Math.pow(event.clientY - centerY, 2)
      );
      
      // If click is abnormally close to exact center (highly unlikely for humans)
      if (distanceToCenter < 5 && rect.width > 10 && rect.height > 10) {
        this.confidenceScore += 0.15;
        this.confidenceScore = Math.min(0.95, this.confidenceScore);
        this.reportToServer(); // Report suspicious activity immediately
      }
    }
  }

  /**
   * Handle scroll events
   * @param {Event} event - Scroll event
   * @return {void}
   */
  handleScroll(event) {
    this.scrollEvents.push({
      scrollY: window.scrollY,
      time: performance.now()
    });
    
    // Trim if needed
    if (this.scrollEvents.length > CONFIG.MAX_SAMPLES / 4) {
      this.scrollEvents.shift();
    }
    
    // Check for mechanical scroll patterns (immediate analysis)
    if (this.scrollEvents.length >= 3) {
      this.detectMechanicalScrolling();
    }
  }
  
  /**
   * Detect suspiciously consistent scrolling
   */
  detectMechanicalScrolling() {
    if (this.scrollEvents.length < 3) return;
    
    // Get the last few scrolling intervals and distances
    const intervals = [];
    const distances = [];
    
    for (let i = 1; i < Math.min(4, this.scrollEvents.length); i++) {
      intervals.push(this.scrollEvents[i].time - this.scrollEvents[i-1].time);
      distances.push(Math.abs(this.scrollEvents[i].scrollY - this.scrollEvents[i-1].scrollY));
    }
    
    // Check for suspiciously consistent scroll timing and distances
    const timeVariance = this.calculateVariance(intervals);
    const distanceVariance = this.calculateVariance(distances);
    
    if (timeVariance < 100 && distanceVariance < 100) {
      // Very mechanical scrolling detected
      this.confidenceScore += 0.1;
      this.confidenceScore = Math.min(0.95, this.confidenceScore);
    }
  }
  
  /**
   * Calculate statistical variance of an array
   */
  calculateVariance(array) {
    if (array.length === 0) return 0;
    const mean = array.reduce((a, b) => a + b) / array.length;
    return array.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / array.length;
  }

  /**
   * Handle form interaction events
   * @param {Event} event - Input event
   * @return {void}
   */
  handleFormInteraction(event) {
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'SELECT' || 
        event.target.tagName === 'TEXTAREA') {
      
      this.formInteractions.push({
        field: event.target.name || event.target.id || event.target.tagName,
        time: performance.now()
      });
      
      // Trim if needed
      if (this.formInteractions.length > CONFIG.MAX_SAMPLES / 4) {
        this.formInteractions.shift();
      }
      
      // Detect abnormally fast form filling
      if (this.formInteractions.length >= 2) {
        const lastIndex = this.formInteractions.length - 1;
        const timeBetweenFields = this.formInteractions[lastIndex].time - 
                                 this.formInteractions[lastIndex - 1].time;
        
        // If fields are filled unrealistically fast
        if (timeBetweenFields < 500) { // Less than 500ms between fields (was 300ms)
          this.confidenceScore += 0.2;
          this.confidenceScore = Math.min(0.95, this.confidenceScore);
          this.reportToServer(); // Report immediately
        }
      }
    }
  }

  /**
   * Schedule the next analysis run
   * @return {void}
   */
  scheduleAnalysis() {
    // Use requestIdleCallback if available, otherwise setTimeout
    if (window.requestIdleCallback) {
      this.analysisTimerId = requestIdleCallback(() => {
        this.runAnalysis();
        this.scheduleAnalysis();
      }, { timeout: CONFIG.ANALYSIS_INTERVAL_MS });
    } else {
      this.analysisTimerId = setTimeout(() => {
        this.runAnalysis();
        this.scheduleAnalysis();
      }, CONFIG.ANALYSIS_INTERVAL_MS);
    }
  }

  /**
   * Run the bot detection analysis
   * @return {void}
   */
  runAnalysis() {
    // Prevent concurrent analysis
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;
    
    try {
      // Skip if we don't have enough data
      if (this.mouseMovements.length < CONFIG.MIN_MOUSE_MOVEMENTS) {
        // Don't change confidence score if we don't have enough data
        this.isAnalyzing = false;
        return;
      }
      
      // Calculate individual signals
      const mouseEntropyScore = this.calculateMouseEntropy();
      const typingPatternScore = this.calculateTypingPatterns();
      const navigationScore = this.calculateNavigationPatterns();
      const formFillingScore = this.calculateFormFillingPatterns();
      
      // Combine weighted scores
      const newScore = 
        (mouseEntropyScore * CONFIG.WEIGHTS.MOUSE_ENTROPY) +
        (typingPatternScore * CONFIG.WEIGHTS.TYPING_PATTERN) +
        (navigationScore * CONFIG.WEIGHTS.NAVIGATION_PATTERN) +
        (formFillingScore * CONFIG.WEIGHTS.FORM_FILLING);
      
      // Ensure the score is a valid number, default to 0.5 if NaN
      const validNewScore = isNaN(newScore) ? 0.5 : newScore;
      
      // Use exponential moving average for score updates to reduce fluctuations
      this.confidenceScore = (this.confidenceScore * 0.7) + (validNewScore * 0.3);
      
      // Ensure confidence score is always a valid number
      if (isNaN(this.confidenceScore)) {
        this.confidenceScore = 0.5;
      }
      
      // Report to server on every analysis to ensure real-time updates
      this.reportToServer();
    } catch (error) {
      console.error('Error in bot detection analysis:', error);
      // Don't let errors affect the bot detection
      this.confidenceScore = 0.5;
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Calculate mouse movement entropy
   * @return {number} Score between 0-1 (higher = more bot-like)
   */
  calculateMouseEntropy() {
    if (this.mouseMovements.length < CONFIG.MIN_MOUSE_MOVEMENTS) {
      return 0.5; // Neutral score if not enough data
    }
    
    // Check for straight lines (bot indicator)
    let straightLineSegments = 0;
    
    // Check for consistent movement speeds (bot indicator)
    let speedConsistency = 0;
    let lastSpeed = null;
    let speedVariations = 0;
    
    // Process movement patterns
    for (let i = 2; i < this.mouseMovements.length; i++) {
      const p1 = this.mouseMovements[i-2];
      const p2 = this.mouseMovements[i-1];
      const p3 = this.mouseMovements[i];
      
      // Check if three points form a straight line (using cross product)
      const dxA = p2.x - p1.x;
      const dyA = p2.y - p1.y;
      const dxB = p3.x - p2.x;
      const dyB = p3.y - p2.y;
      
      // Cross product close to 0 indicates straight line
      const crossProduct = Math.abs(dxA * dyB - dyA * dxB);
      if (crossProduct < 10) { // Threshold for "straightness"
        straightLineSegments++;
      }
      
      // Calculate movement speed
      const distance = Math.sqrt(dxB * dxB + dyB * dyB);
      const timeDiff = p3.time - p2.time;
      const speed = timeDiff > 0 ? distance / timeDiff : 0;
      
      // Check speed consistency
      if (lastSpeed !== null) {
        const speedDiff = Math.abs(speed - lastSpeed);
        speedVariations += speedDiff;
      }
      lastSpeed = speed;
    }
    
    // Calculate scores
    const straightnessRatio = this.mouseMovements.length > 3 ? 
      straightLineSegments / (this.mouseMovements.length - 2) : 0;
    
    const speedVariabilityScore = 
      speedVariations / (this.mouseMovements.length - 2);
    
    // Higher straightness and lower speed variability suggest bot
    return (straightnessRatio * 0.6) + ((1 - Math.min(1, speedVariabilityScore * 10)) * 0.4);
  }

  /**
   * Calculate typing pattern consistency
   * @return {number} Score between 0-1 (higher = more bot-like)
   */
  calculateTypingPatterns() {
    if (this.keyPressTimings.length < CONFIG.MIN_KEYPRESS_SAMPLES) {
      return 0.5; // Neutral if not enough data
    }
    
    // Calculate time intervals between keypresses
    const intervals = [];
    for (let i = 1; i < this.keyPressTimings.length; i++) {
      intervals.push(this.keyPressTimings[i].time - this.keyPressTimings[i-1].time);
    }
    
    // Calculate variance of intervals (low variance = bot-like)
    let sum = 0;
    let squaredSum = 0;
    
    for (const interval of intervals) {
      sum += interval;
      squaredSum += interval * interval;
    }
    
    const mean = sum / intervals.length;
    const variance = (squaredSum / intervals.length) - (mean * mean);
    
    // Normalize: lower variance = higher score
    // Human typing typically has higher variance
    const normalizedVariance = Math.min(1, variance / 10000);
    return 1 - normalizedVariance;
  }

  /**
   * Calculate navigation pattern consistency
   * @return {number} Score between 0-1 (higher = more bot-like)
   */
  calculateNavigationPatterns() {
    // Look at scroll and click patterns
    if (this.clickEvents.length < 2 && this.scrollEvents.length < 2) {
      return 0.5; // Neutral if not enough data
    }
    
    let score = 0.5;
    
    // Check for very regular scroll intervals (bot-like)
    if (this.scrollEvents.length >= 3) {
      const scrollIntervals = [];
      for (let i = 1; i < this.scrollEvents.length; i++) {
        scrollIntervals.push(this.scrollEvents[i].time - this.scrollEvents[i-1].time);
      }
      
      // Calculate standard deviation of intervals
      const avg = scrollIntervals.reduce((sum, val) => sum + val, 0) / scrollIntervals.length;
      const variance = scrollIntervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / scrollIntervals.length;
      const stdDev = Math.sqrt(variance);
      
      // Normalize: lower std deviation = higher bot score
      const scrollRegularity = Math.max(0, Math.min(1, 1 - (stdDev / 1000)));
      score = (score + scrollRegularity) / 2;
    }
    
    // Check for click patterns
    if (this.clickEvents.length >= 2) {
      // Analyze click positions (bots often click exact centers of elements)
      // This is a simplified version - could be more sophisticated
      let centerClicks = 0;
      
      for (const click of this.clickEvents) {
        const targetElement = document.elementFromPoint(click.x, click.y);
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Check if click is very close to center
          const distanceToCenter = Math.sqrt(
            Math.pow(click.x - centerX, 2) + 
            Math.pow(click.y - centerY, 2)
          );
          
          // If click is within 5px of center, count it
          if (distanceToCenter < 5) {
            centerClicks++;
          }
        }
      }
      
      const centerClickRatio = centerClicks / this.clickEvents.length;
      score = (score + centerClickRatio) / 2;
    }
    
    return score;
  }

  /**
   * Calculate form filling patterns
   * @return {number} Score between 0-1 (higher = more bot-like)
   */
  calculateFormFillingPatterns() {
    if (this.formInteractions.length < 2) {
      return 0.5; // Neutral if not enough data
    }
    
    // Calculate time between form field interactions
    const intervals = [];
    for (let i = 1; i < this.formInteractions.length; i++) {
      intervals.push(this.formInteractions[i].time - this.formInteractions[i-1].time);
    }
    
    // Very fast form filling is bot-like
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Score based on filling speed (under 300ms between fields is suspicious)
    // Adjusted to be more sensitive to quick form filling
    let speedScore = 0;
    if (avgInterval < 250) speedScore = 0.95;
    else if (avgInterval < 500) speedScore = 0.8;
    else if (avgInterval < 800) speedScore = 0.6; 
    else if (avgInterval < 1500) speedScore = 0.4;
    else speedScore = 0.2;
    
    return speedScore;
  }

  /**
   * Report detection data to server
   * @return {Promise<void>}
   */
  async reportToServer() {
    try {
      // Prepare data for server
      const reportData = {
        confidenceScore: this.confidenceScore,
        signals: {
          mouseEntropy: this.calculateMouseEntropy(),
          typingPattern: this.calculateTypingPatterns(),
          navigationPattern: this.calculateNavigationPatterns(),
          formFilling: this.calculateFormFillingPatterns()
        },
        sampleCounts: {
          mouseMovements: this.mouseMovements.length,
          keyPresses: this.keyPressTimings.length,
          clicks: this.clickEvents.length,
          scrolls: this.scrollEvents.length,
          formInteractions: this.formInteractions.length
        },
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };
      
      // Send to server (using fetch)
      const response = await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData),
        // Don't block UI for this
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        console.warn('Bot detection report failed:', response.status);
      }
    } catch (error) {
      console.error('Error reporting bot metrics:', error);
    }
  }
}

// Export singleton instance
const botDetector = new BotDetector();

// Auto-start the detector
botDetector.start();

export default botDetector; 