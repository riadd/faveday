# FaveDay App - Claude Documentation

## App Overview
FaveDay is a personal daily scoring/journaling application built with Electron. Users rate their days with scores and add notes with tags.

## Architecture
- **Frontend**: HTML/CSS/JavaScript with Mustache templates
- **Backend**: Electron main process (Node.js)
- **Data Storage**: JSON files in user's data directory
- **Tag System**: Comprehensive caching system for performance

## Key Files
- `app/js/faveday.js` - Main frontend logic, FaveDayApp class
- `app/main.js` - Electron main process, data handling
- `app/index.html` - UI templates (Mustache)
- `app/css/style.css` - Styling
- `tag-cache.json` - Cached tag statistics for performance

## Tag System Implementation
- Uses regex `/([#@])\p{L}[\p{L}\d]*/gui` for tag detection
- Two types: Topic tags (`#tag`) and Person tags (`@person`)
- Comprehensive caching system stores:
  - `totalUses` - Total usage count
  - `avgScore` - Average score of entries with this tag
  - `totalScore` - Sum of all scores for entries with this tag
  - `hotness` - Day-based weighted score (recent entries weighted higher)
  - `firstUsage`/`lastUsage` - Date tracking
  - `yearStats` - Usage breakdown by year
  - `peakYear`/`peakYearCount` - Most active year
  - `isPerson` - Whether it's a person tag
  - `recentActivity` - Used in current/previous year

## Recent Implementations
### Tags Page Sorting (Current Session)
- Extended tags page with 7 sorting options:
  1. Usage Count (default)
  2. Average Score 
  3. Total Score - sums all scores for the tag
  4. Hotness - day-based weighted scoring combining recency and quality
  5. A-Z (NEW - alphabetical sorting)
  6. Oldest (first usage)
  7. Newest (most recent usage)
- Uses cached tag statistics instead of recalculating
- Integrated sort controls into table header with active state indicators
- Added fallback date calculation for when cache doesn't have date fields yet
- Enhanced tag cache to include firstUsage/lastUsage timestamps

### Hotness Algorithm (Current Session)  
- **Purpose**: Surface tags that combine recent activity with quality scores AND total engagement
- **Methodology**: Sum of each individual score weighted by its recency (no averaging)
- **Formula**: `hotness = sum(score × weight)` 
- **Weight per Score**: `max(0.01, 0.6^yearsAgo)` (extremely aggressive exponential decay)
  - Current day: weight = 1.0 (full value)
  - 1 year ago: weight = 0.6 (60% value)  
  - 3 years ago: weight = 0.22 (22% value)
  - 5 years ago: weight = 0.08 (8% value)
  - 10+ years ago: weight = 0.006 (0.6% value, minimum 1%)
- **Key Advantage**: Consistent long-term activity can compete with single recent mentions
- **Example**: Tag with 10 old scores of 5.0 (hotness ~5.0) vs tag with 1 recent score of 5.0 (hotness ~5.0)

## UI/UX Improvements Made
- Moved sort controls from separate box into table header row for better integration
- Added visual indicators for currently active sort mode (.sort-active CSS class)
- Renamed "First"/"Recent" to "Oldest"/"Newest" for clearer distinction
- Fixed confusing tag-style button highlighting - now uses completely different styling 
- Improved active vs passive button contrast (white underline for active, NOT blue background)
- Removed ugly punctuation (colon, dash) and used better whitespace/spacing
- Active buttons use white underline to distinguish from blue tag buttons
- Passive buttons are subtle gray text, avoiding any color conflict with actual tags
- LEARNED: Never use same colors for meta-controls as content elements (tags are blue, so sort controls must be different)

## Development Best Practices Applied
- **Avoid fallback code duplication**: When tag cache was missing yearStats, removed clunky fallback calculations
- **Keep it simple**: No complex cache validation logic - user can just edit a score to trigger cache rebuild during development
- **Clean data flow**: Sparklines now rely purely on properly structured cache data, no duplicate logic

### Dashboard Widget Reordering
- Reordered bento-grid widgets per user request:
  1. Year 2025 (calendar progress) 
  2. Age 46 (life progress)
  3. Coverage
  4. Avg Score (moved up 2 positions)
  5. Total Entries (moved up 2 positions) 
  6. Avg Words/Day (moved up 2 positions)
  7. Last 5+ Score (moved down 2 positions)
  8. Last 1 Score (moved down 2 positions)
  9. Top Tag

### Tag Popup Sparklines (Current Session)
- Added tiny sparkline charts to tag popups showing usage distribution over years
- Uses existing yearStats data from tag cache system and full year timeline (this.years)
- Shows complete diary timeline: 3px bars for usage years, 2px dots for empty years
- Every tag gets a sparkline covering the full 10+ year timeline for context
- Hover tooltips show "Year: X uses" for all years (including 0 uses)
- Positioned inline between main stats and peak year info
- Bars scale relative to maximum usage year for that tag
- Empty years show as subtle dots (20% opacity) for visual reference
- Usage years show as bars (60% opacity) scaled to 2-12px height
- FIXED: Now readable - you can see which years correspond to which bars/dots

## User Preferences & Instructions
- **DO NOT run npm commands** - User handles app startup themselves
- Previous session was interrupted by npm command causing stall
- User prefers leveraging existing systems (like tag cache) over reimplementing
- Keep CLAUDE.md updated with learnings and design decisions

## Development Notes
- Global functions defined in `faveday.js` as `window.onFunctionName`
- Templates use Mustache syntax with partials
- Tag cache automatically updates when scores are saved
- IPC bridge in `preload.js` for main/renderer communication

## Architecture Refactoring (Current Session)
### Configuration Store Implementation (Latest Session)
**Fixed Score Aggregation Issue**: Replaced complex async config handling with simple synchronous config store to eliminate async shenanigans and data duplication.

**Problem**: ScoreCalculator was storing copies of config data via `setConfig()`, creating multiple sources of truth and potential synchronization issues.

**Solution**: Created `ConfigStore` singleton that provides single source of truth for all configuration:
- **`config-store.js`**: Synchronous config storage loaded once at startup
- **ScoreCalculator**: Now reads directly from `window.configStore` with no local storage
- **Settings changes**: Update configStore directly instead of API -> setConfig chains
- **Eliminated**: All `setConfig()` calls, async config loading in modules, data duplication

**Benefits**:
- Single source of truth for configuration
- No async complexity in score calculations  
- No risk of config synchronization bugs
- Simpler mental model and error-free config access

### Modular Design Implementation
Successfully extracted core functionality from monolithic FaveDayApp class into focused modules:

1. **ScoreCalculator** (`/app/lib/faveday/score-calculator.js`)
   - Centralized score calculation system with proper config caching
   - Handles average, median, and quality calculations consistently
   - Unit tested with 12 passing tests
   - Fixed default empty score functionality across all views

2. **DataManager** (`/app/lib/faveday/data-manager.js`)
   - Centralized data access and persistence operations
   - Handles score loading/saving, filtering, and enhancement
   - Provides consistent data interface across the application
   - Unit tested with 17 passing tests
   - Maintains backward compatibility with legacy `this.all` access patterns

3. **Router** (`/app/lib/faveday/router.js`)
   - Navigation and URL routing management
   - Browser history handling with proper state management
   - Route parsing and building utilities
   - Breadcrumb generation for better UX

4. **SettingsManager** (`/app/lib/faveday/settings-manager.js`)
   - User configuration and settings management
   - Handles birthdate, score types, life quality weights, default empty scores
   - Form validation and DOM manipulation for settings UI
   - Unit tested with 7 passing tests
   - Properly integrated with other modules via dependency injection

### Benefits Achieved
- **Single Source of Truth**: All score calculations now go through ScoreCalculator
- **Consistent Data Access**: DataManager provides unified interface for all data operations
- **Settings Isolation**: All configuration logic centralized in SettingsManager module
- **Better Testability**: Extracted modules can be unit tested independently (36 total tests)
- **Reduced Complexity**: Main FaveDayApp class reduced from 3421 to 3318 lines (~3% reduction)
- **Easier Maintenance**: Clear separation of concerns makes changes safer and more predictable
- **Improved Reliability**: Centralized systems prevent scattered calculation bugs
- **Focused Modules**: Each module has a single, clear responsibility

## Code Patterns
- CSS classes: `.tag` for topics, `.person` for people, `.recent` for recent activity
- Data attributes used for popups: `data-tag`, `data-uses`, `data-avg`, etc.
- Sorting implementations handle null values gracefully
- Templates kept simple, logic in JavaScript