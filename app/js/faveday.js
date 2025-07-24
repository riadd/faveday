
  Score = class Score {
    constructor(date, summary, notes) {
      this.date = date;
      this.summary = summary;
      this.notes = notes;
    }

    dateId() {
      return this.date.format("{yyyy}-{MM}-{dd}");
    }
    
    dateStr() {
      return this.date.format("{d} {Mon} {yyyy}");
    }

    monthId() {
      return this.date.format("{yyyy}-{MM}");
    }
  
    weekday() {
      return this.date.format("{Weekday}");
    }
    
    empty() {
      return this.summary == null ? 'empty' : '';
    }
  
    text() {
      // replace search tags
      let re = /([#@])\p{L}[\p{L}\d]*/gui; // p{L} is a unicode letter, \d is a digit
      let text = this.notes.replace(re, str => {
        let marker = str[0];
        let word = str.slice(1);

        if (marker === '#') {
          // For hashtags, use camelCaseToSpace
          return `<a class="tag" onclick="onShowSearch('${word}')">${this.camelCaseToSpace(word)}</a>`;
          
        } else if (marker === '@') {
          // For mentions, only keep the first word
          let firstWord = word.split(/(?=[A-Z])/)[0]; // Splits at uppercase letter boundaries
          return `<a class="person" onclick="onShowSearch('${word}')">${firstWord}</a>`;
        }
      });
      
      // replace new-lines
      return text.replace(/\n/g, "<br>");
    }

    enhancedText(tagCache) {
      // Clean approach: analyze raw text, then render everything in one pass
      const rawText = this.notes;
      
      // Constants
      const MIN_TAG_USES = 3;
      const MIN_WORD_LENGTH = 2;
      
      // STEP 1: Find all existing tags in raw text
      const existingTags = [];
      const tagRegex = /([#@])\p{L}[\p{L}\d]*/gui;
      let match;
      while ((match = tagRegex.exec(rawText)) !== null) {
        existingTags.push({
          full: match[0],
          marker: match[1], 
          word: match[0].slice(1),
          start: match.index,
          end: match.index + match[0].length
        });
      }
      
      // STEP 2: Find potential suggestions using helper methods
      let suggestions = [];
      if (tagCache) {
        const suggestedWords = new Set(); // Shared between both methods to prevent conflicts
        const personSuggestions = this.findPersonSuggestions(rawText, existingTags, tagCache, MIN_TAG_USES, MIN_WORD_LENGTH, suggestedWords);
        const topicSuggestions = this.findTopicSuggestions(rawText, existingTags, tagCache, MIN_TAG_USES, MIN_WORD_LENGTH, suggestedWords);
        suggestions = [...personSuggestions, ...topicSuggestions];
      }
      
      // STEP 3: Render everything in order of position
      const allElements = [
        ...existingTags.map(tag => ({...tag, type: 'existing'})),
        ...suggestions // Keep original type ('person', etc.)
      ].sort((a, b) => a.start - b.start);
      
      // Build final HTML
      let result = '';
      let lastPos = 0;
      
      allElements.forEach(element => {
        // Add text before this element
        result += rawText.slice(lastPos, element.start);
        
        if (element.type === 'existing') {
          // Render existing tag with metadata
          const tagKey = element.word.toLowerCase();
          const tagStats = tagCache?.[tagKey];
          const isRecent = tagStats?.recentActivity || false;
          const isPerson = tagStats?.isPerson || element.marker === '@';
          
          let classes = isPerson ? 'person' : 'tag';
          if (isRecent) classes += ' recent';
          
          let dataAttrs = '';
          if (tagStats) {
            const yearStats = tagStats.yearStats || {};
            const originalName = tagStats.originalName || tagKey;
            dataAttrs = `data-tag="${tagKey}" data-original-name="${originalName}" data-uses="${tagStats.totalUses}" data-avg="${tagStats.avgScore.toFixed(1)}" data-peak="${tagStats.peakYear}" data-peak-count="${tagStats.peakYearCount}" data-is-person="${isPerson}" data-year-stats='${JSON.stringify(yearStats)}'`;
          }

          if (element.marker === '#') {
            result += `<a class="${classes}" ${dataAttrs} onclick="onShowSearch('${element.word}')">${this.camelCaseToSpace(element.word)}</a>`;
          } else {
            const firstWord = element.word.split(/(?=[A-Z])/)[0];
            result += `<a class="${classes}" ${dataAttrs} onclick="onShowSearch('${element.word}')">${firstWord}</a>`;
          }
        } else {
          // Render suggestion
          const firstNameAttr = element.firstName ? ` data-first-name="${element.firstName}"` : '';
          result += `<span class="tag-suggestion ${element.type}" data-original-text="${element.text}" data-suggested-tag="${element.suggestedTag}"${firstNameAttr} onclick="onShowTagSuggestion(this)">${element.text}</span>`;
        }
        
        lastPos = element.end;
      });
      
      // Add remaining text
      result += rawText.slice(lastPos);
      
      return result.replace(/\n/g, "<br>");
    }

    // Initialize shared tag parser
    getTagParser() {
      if (!this._tagParser) {
        this._tagParser = new TagParser();
      }
      return this._tagParser;
    }

    camelCaseToSpace(str) {
      return this.getTagParser().camelCaseToSpace(str);
    }

    checkOverlap(suggestionStart, suggestionEnd, existingTags) {
      return this.getTagParser().checkOverlap(suggestionStart, suggestionEnd, existingTags);
    }

    createWordRegex(word) {
      return this.getTagParser().createWordRegex(word);
    }

    // Extract person suggestions from raw text
    findPersonSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords = new Set()) {
      return this.getTagParser().findPersonSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords);
    }

    // Extract topic suggestions from raw text  
    findTopicSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords = new Set()) {
      return this.getTagParser().findTopicSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords);
    }

  
    styleClass() {
      return this.summary == null ? 'val0' : 'val' + this.summary;
    }
    
    summaryText() {
      return this.summary || "?"
    }
}

  FaveDayApp = class FaveDayApp {  
    constructor() {
      Sugar.extend();
      
      this.showSearch = this.showSearch.bind(this);
      this.tmplScores = Hogan.compile($('#tmpl-scores').html());
      
      // Handle Enter key separately
      $('#search input').keydown((event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.showSearch();
          return;
        }
      });
      
      $('#search input').keyup((event) => {
        // Clear existing timeout
        if (this.searchTime != null) {
          window.clearTimeout(this.searchTime);
        }
        
        const searchValue = event.target.value;
        
        // Only trigger real-time search for 4+ characters
        if (searchValue.length >= 4) {
          this.searchTime = window.setTimeout(this.showSearch, 500);
        } else if (searchValue.length === 0) {
          // If search is cleared, show dashboard
          this.showDashboard();
        }
      });

      this.showEmpty = false;
      this.tagsOnly = false;
      this.tagCache = {};

      this.loadScores();
    }
    
    fmtDiff(val, currentVal) {
      if (val === 0) return '';
      
      // Calculate percentage change
      const percentageChange = currentVal > 0 ? Math.round((val / currentVal) * 100) : 0;
      const sign = val > 0 ? '+' : '';
      const arrow = val > 0 ? '▲' : '▼';
      const absPercentage = Math.abs(percentageChange);
      
      return `${arrow} ${sign}${absPercentage}%`;
    }
    
    showSummary(scores) {
      const OPENAI_API_KEY = 'XXX';

      const requestData = {
        model: "gpt-3.5-turbo",
        // messages: [
        //   {
        //     role: "system",
        //     content: "You are a digital diary assistant."
        //   },
        //   {
        //     role: "user",
        //     content: "Summarize the highlights from the following diary entries into bullet points in html ul format. Use no more than 5 bulletpoints. Use the same language as in the journal entries:"+ scores.map(s => s.notes).join(' ')
        //   }
        // ]
        
        // messages: [
        //   {
        //     role: "system",
        //     content: "You are a wellbeing mentor modeled to speak and think like Jean-Luc Picard of the TNG Enterprise."
        //   },
        //   {
        //     role: "user",
        //     content: "Provide actionable commentary and draw upon comparisons with historic events and figures - tapping into Picard's deep appreciation of European history. Write from the perspective of being Picard. Keep it short, no more than 3 sentences. You must use the same language as in the journal entries:"+ scores.map(s => s.notes).join(' ')
        //   }
        // ]

        messages: [
          {
            role: "system",
            content: "You are: Jean Luc Picard."
          },
          {
            role: "user",
            content: "You must provide concrete actionable guidance based on the understand of the following journal entries written by your friend. Draw upon historic references based on the life of the figure. Write no more than 3 sentences. You must use the same language as in the journal entries:"+ scores.map(s => s.notes).join(' ')
          }
        ]
      };

      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(requestData)
      })
        .then(response => response.json())
        .then(data => $('#ai').html(data.choices[0].message.content ))
        .catch(error => console.error('Error:', error));
    }
    
    async loadScores() {
      // load scores only returns raw lines since we have to pass primitive data over the bridge
      let data = await window.api.loadScores();

      this.all = []
      for (let rawScore of data)
        this.all.push(new Score(rawScore.date, rawScore.summary, rawScore.notes))
      
      // Load tag cache
      this.tagCache = await window.api.getTagCache();
        
      this.onScoreAdded();
    }

    async saveScores() {
      let rawScores = [];
      
      for (const score of this.all) {
        rawScores.push({
          date: score.date,
          summary: score.summary,
          notes: score.notes
        });
      }

      await window.api.saveScores(rawScores);
      // Reload tag cache after saving
      this.tagCache = await window.api.getTagCache();
    }

    setupDemoUser() {
      var i, score;
      $('#userName').html('Demo User');
      this.all = (function() {
        var j, results;
        results = [];
        for (i = j = 0; j <= 800; i = ++j) {
          results.push(score = new Score(Date.create().addDays(-i), Math.floor((Math.random() * 5) + 1), demoNotes.sample()));
        }
        return results;
      })();
      return this.onScoreAdded();
    }

    onScoreAdded() {
      // todo: rename to allYears or something
      // this.years = (() => {
      //   const startYear = this.all.first().date.getFullYear();
      //   const endYear = this.all.last().date.getFullYear();
      //   const yearRange = [];
      //
      //   for (let year = startYear; year <= endYear; year++) {
      //     yearRange.push(year);
      //   }
      //
      //   return yearRange;
      // }).apply(this);

      this.all.sort((a, b) => b.date - a.date); // sort in descending order
      
      let minYear = this.all.last().date.getFullYear();
      let maxYear = this.all.first().date.getFullYear();
      
      this.years = [];
      for (let year = minYear; year <= maxYear; year++) {
        this.years.push(year);
      }

      $('#topArea').show();
      $('#loading').hide();
      
      handleRoute();
    }

    onScoreAddedAndNavigateBack() {
      // Update the data like onScoreAdded but navigate back instead of handling current route
      this.all.sort((a, b) => b.date - a.date); // sort in descending order
      
      let minYear = this.all.last().date.getFullYear();
      let maxYear = this.all.first().date.getFullYear();
      
      this.years = [];
      for (let year = minYear; year <= maxYear; year++) {
        this.years.push(year);
      }

      $('#topArea').show();
      $('#loading').hide();
      
      // Navigate back to previous page instead of handling current route
      if (window.history.length > 1) {
        history.back();
      } else {
        // Fallback to dashboard if no history
        this.showDashboard();
      }
    }

    getOrdinalSuffix(day) {
      const lastDigit = day % 10;
      const lastTwoDigits = day % 100;
      
      // Handle special cases for 11th, 12th, 13th
      if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return 'th';
      }
      
      // Handle 1st, 2nd, 3rd, and everything else
      switch (lastDigit) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    }

    formatDateWithOrdinal(date) {
      const day = date.getDate();
      const month = date.format("{Month}");
      const year = date.format("{yyyy}");
      const ordinalSuffix = this.getOrdinalSuffix(day);
      
      return `${month} ${day}${ordinalSuffix}, ${year}`;
    }

    showToaster(message, type = 'success', duration = 3000) {
      const toaster = document.getElementById('toaster');
      const toasterMessage = document.getElementById('toaster-message');
      
      if (!toaster || !toasterMessage) {
        console.error('Toaster elements not found');
        return;
      }

      // Update message
      toasterMessage.textContent = message;
      
      // Update styling based on type
      if (type === 'success') {
        toaster.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
        toaster.querySelector('.toaster-icon').textContent = '✓';
      } else if (type === 'error') {
        toaster.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        toaster.querySelector('.toaster-icon').textContent = '✗';
      } else if (type === 'info') {
        toaster.style.background = 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)';
        toaster.querySelector('.toaster-icon').textContent = 'ℹ';
      }
      
      // Show toaster
      toaster.classList.add('show');
      
      // Hide after duration
      setTimeout(() => {
        toaster.classList.remove('show');
      }, duration);
    }

    showError() {
      return this.render('#tmpl-landing', '#content', {
        error: 'Could not connect :-('
      }, {});
    }

    render(templateId, viewId, atts, partials) {
      var view;
      view = Hogan.compile($(templateId).html());
      return $(viewId).html(view.render(atts, partials));
    }

    enhanceScoresForDisplay(scores) {
      // Add enhanced text with tag cache data to scores
      if (!scores || !Array.isArray(scores)) {
        console.warn('enhanceScoresForDisplay called with non-array:', scores);
        return [];
      }
      
      return scores.map(score => {
        return {
          // Copy all existing properties that the template needs
          date: score.date,
          summary: score.summary,
          notes: score.notes,
          dateStr: score.dateStr(),
          monthId: score.monthId(),
          weekday: score.weekday(),
          styleClass: score.styleClass(),
          summaryText: score.summaryText(),
          dateId: score.dateId(),
          empty: score.empty(),
          // Use enhanced text instead of regular text
          text: score.enhancedText ? score.enhancedText(this.tagCache) : score.text()
        };
      });
    }

    toggleScoreDialogue() {
      if ($('#addScore').is(':visible')) {
        $('#addScore').hide();
        $('#addScoreBtn .btn').removeClass('active');
      } else {
        $('#datePicker').text(Date.create().format("{dd}-{mm}-{yyyy}"));
        $('#addScoreBtn .btn').addClass('active');
        $('#addScore').show();
      }
    }
    
    toggleShowEmpty() {
      this.showEmpty = !this.showEmpty;
      
      if (this.showEmpty)
        $('.empty').show();
      else
        $('.empty').hide();
    }
    
    getOverview(scores) {
      let overview = [0,0,0,0,0]
      
      for (let score of scores)
        overview[score.summary-1] += 1;
      
      return {
        count1: 100*overview[0]/overview.sum(),
        count2: 100*overview[1]/overview.sum(),
        count3: 100*overview[2]/overview.sum(),
        count4: 100*overview[3]/overview.sum(),
        count5: 100*overview[4]/overview.sum(),
      }
    }
    
    getMaxStreak(scores, onlyFirst= false) {
      let maxStreakCount = 0;
      let maxStreakStart = null;
      let maxStreakEnd = null;
      
      let streakCount = 0;
      let streakStart = null;
      let streakEnd = null;
      
      let prevDate = null;
      
      for (let score of scores) {
        const currentDate = new Date(score.date);
        currentDate.setHours(0, 0, 0, 0); // Normalize to start of day

        if (prevDate) {
          // Check if the current date is consecutive
          const timeDiff = currentDate - prevDate;
          const dayDiff = Math.abs(timeDiff / (1000 * 3600 * 24));

          if (dayDiff === 1) {
            streakCount++;
          } else {
            if (onlyFirst && streakCount >= 2) break;
            
            streakCount = 1;
            streakStart = currentDate;
          }
        } else {
          streakCount = 1;
          streakStart = currentDate;
        }

        if (streakCount > maxStreakCount) {
          maxStreakCount = streakCount;
          maxStreakStart = streakStart;
          maxStreakEnd = currentDate;
        }

        prevDate = currentDate;
      }
      
      return {
        count: maxStreakCount, 
        start: maxStreakEnd.format("{d} {Mon} {yyyy}"), 
        end: maxStreakStart.format("{d} {Mon} {yyyy}")
      }
    }
    
    getScores(year, month, date) {
      return this.all.filter(s =>
        (year == null || s.date.getFullYear() === year) &&
        (month == null || s.date.getMonth() === month-1) &&
        (date == null || s.date.getDate() === date)
      );
    }

    async showDashboard() {
      $('#search input')[0].value = "";
      
      // Safety check for this.all
      if (!this.all || !Array.isArray(this.all)) {
        console.warn('No scores loaded yet');
        return;
      }
      
      let recent = this.all.slice(0, 3);
      
      let filteredBestScores = this.all.filter(function(s) {
        return s.summary === 5;
      });
      let bestScores = filteredBestScores.length > 0 ? filteredBestScores.sample() : [];
      // Ensure bestScores is always an array
      if (!Array.isArray(bestScores)) {
        bestScores = bestScores ? [bestScores] : [];
      }
      
      let today = Date.create();
      let toDay = today.getDay();
      let toWeek = today.getISOWeek();
      
      // Get scores for this exact day of the week and week
      let todayScores = this.all.filter(s =>
        s.date.getDay() === toDay && s.date.getISOWeek() === toWeek
      );
      
      // Get anniversary days (same month and day across all years)
      let anniversaryScores = this.all.filter(s =>
        s.date.getMonth() === today.getMonth() && s.date.getDate() === today.getDate()
      );
      
      let anniversaryStats = null;
      if (anniversaryScores.length > 0) {
        anniversaryStats = {
          count: anniversaryScores.length,
          avgScore: anniversaryScores.average(s => s.summary).format(2)
        };
      }
      
      let diff = null;
      let prevMonthScores = this.getScores(today.getFullYear(), today.getMonth()) // month-1
      if (prevMonthScores.length > 0)
      {
        let curMonthScores = this.getScores(today.getFullYear(), today.getMonth()+1) // month
        
        let prevAvg = prevMonthScores.average(s => s.summary)
        let curAvg = curMonthScores.average(s => s.summary)
        diff = this.fmtDiff(curAvg - prevAvg, prevAvg)
      }

      // Get config for birthdate
      const config = await window.api.getConfig();
      
      // Calculate progress data
      const calendarProgress = this.getCalendarYearProgress();
      const lifeProgress = config.birthdate ? this.getLifeYearProgress(config.birthdate) : null;
      const coverage = this.getCoverageProgress();
      const thirtyDayStats = this.getThirtyDayComparisons();

      this.pushHistory('/', '');
      
      return this.render('#tmpl-dashboard', '#content', {
        recentScores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(recent)}),
        bestScores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(bestScores)}),
        hasTodayScores: todayScores.length > 0,
        todayScores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(todayScores)}),
        anniversaryStats: anniversaryStats,
        years: this.years.map(y => ({year: y})),
        streak: this.getMaxStreak(this.all, true),
        diff: diff,
        footer: `Total Scores: ${this.all.length}`,
        calendarProgress: calendarProgress,
        lifeProgress: lifeProgress,
        coverage: coverage,
        thirtyDayStats: thirtyDayStats
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    isValidMonth(date, date1, date2) {
      return date.isBetween(date1, date2) ? date.format("{yyyy}-{MM}") : null;
    }

    showMonth(yearNum, monthNum) {
      this.showEmpty = false;
      
      let monthDate = Date.create(`${yearNum}-${monthNum}`);
      let title = monthDate.format('{Month} {yyyy}');

      let monthScores = this.all.filter(s =>
        s.date.getFullYear() === yearNum &&
        s.date.getMonth() === monthNum-1
      );
      
      let prevYearDate = new Date(monthDate).addYears(-1);
      let prevMonthDate = new Date(monthDate).addMonths(-1);
      let nextMonthDate = new Date(monthDate).addMonths(1);
      let nextYearDate = new Date(monthDate).addYears(1);
      
      this.pushHistory(`/month/${yearNum}/${monthNum}`, title);

      //this.showSummary(monthScores);

      let virtualMonthScores = []
      for (let dateNum=1; dateNum<=31; dateNum++) {
        // Find the last entry for this date (most recent if multiple exist)
        let matches = monthScores.filter(s => 
          s.date.getFullYear() === yearNum &&
          s.date.getMonth() === monthNum-1 &&
          s.date.getDate() === dateNum);
        let score = matches.length > 0 ? matches[matches.length - 1] : null;
        
        if (score == null)
        {
          score = new Score(
            new Date(yearNum, monthNum-1, dateNum),
            null,
            '')
        }
        
        virtualMonthScores.push(score)
      }
      
      let tags = this.getTags(monthScores); 
      let firstDate = this.all[0].date;
      let lastDate = this.all.last().date;
      
      this.render('#tmpl-month', '#content', {
        title: title,
        scores: virtualMonthScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(virtualMonthScores)}),
        years: this.years.map(y => ({year: y})),
        
        hasTags: tags.length > 0,
        tags: tags,
        
        prevYear: this.isValidMonth(prevYearDate, firstDate, lastDate),
        prevMonth: this.isValidMonth(prevMonthDate, firstDate, lastDate),
        nextMonth: this.isValidMonth(nextMonthDate, firstDate, lastDate),
        nextYear: this.isValidMonth(nextYearDate, firstDate, lastDate),
        
        average: monthScores.average(s => s.summary).format(2),
        overview: this.getOverview(monthScores)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
        scoreBar: Hogan.compile($('#tmpl-score-bar').html())
      });

      document.getElementById('showEmptyToggle').addEventListener('change', function() {
        this.toggleShowEmpty();
      }.bind(this));
    }

    showMonths(monthId) {
      let monthNum = parseInt(monthId)-1;
      let date = new Date(2024, monthNum, 1);

      // all scores of this month
      let monthScores = this.all.filter(s =>
        s.date.getMonth() === monthNum
      );

      // scores of this month by year
      let byYear = monthScores.groupBy(s => s.date.getFullYear());
      let allMonths = [];

      const dayNums = Array.from({ length: 31 }, (_, index) => index + 1); // 1..31

      let year = null;
      for (year in byYear) {
        // we don't just iterate over byYear because we also care about empty month entries
        let oneMonth = byYear[year];
        let monthDate = new Date(year, monthNum, 1);

        allMonths.push({
          date: year,
          monthId:  monthDate.format('{yyyy}-{MM}'),
          totalAvg: oneMonth.average(s => s.summary).format(2),
          totalCount: oneMonth.length,
          totalWords: (oneMonth.map(s => s.notes.split(' ').length).sum() / 1000.0).format(1),
          days: dayNums.map(d => {
            return {
              val: oneMonth.find(s => s.date.getDate() === d)?.summary ?? 0,
              weekday: Date.create(`${year}-${parseInt(monthId) + 1}-${d}`).getDay()
            }
          }), 
        });
      }

      let title = date.format('{Month}');
      this.pushHistory(`/months/${monthId}`, title);

      let randomScores = monthScores.filter(s => s.summary >=3).sample(5);
      let bestScores = monthScores.filter(s => s.summary === 5).sample(1).sortBy(s => s.date, true);

      return this.render('#tmpl-months', '#content', {
        title: title,
        average: monthScores.average(s => s.summary).format(2),
        months: allMonths.reverse(),
        years: this.years.map(y => ({year: y})),
        scores: randomScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(randomScores)}),
        inspiration: bestScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(bestScores)}),
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
      });
    }

    updateRandomInspiration() {
      let bestScores = this.all.filter(s => s.summary === 5).sample();
      if (!Array.isArray(bestScores)) {
        bestScores = bestScores ? [bestScores] : [];
      }
      return $('#bestScores').html(this.tmplScores.render({ scores: this.enhanceScoresForDisplay(bestScores) }));
    }

    showYears() {
      const lerp = (t, a, b, i) =>
        Math.floor(t * parseInt(a[i], 16) + (1 - t) * parseInt(b[i], 16));
      
      const interpCol = function(t, col1, col2) {
        let c1 = [col1.slice(1, 3), col1.slice(3, 5), col1.slice(5, 7)];
        let c2 = [col2.slice(1, 3), col2.slice(3, 5), col2.slice(5, 7)];
        return `rgb(${lerp(t, c1, c2, 0)}, ${lerp(t, c1, c2, 1)}, ${lerp(t, c1, c2, 2)})`;
      };

      const getColorForVal = val => {
        if (val >= 5.00) return '#33AA66';
        if (val >= 4.00) return interpCol(val - 4, '#9AD600', '#33AA66');
        if (val >= 3.00) return interpCol(val - 3, '#FFAD26', '#9AD600');
        if (val >= 2.00) return interpCol(val - 2, '#FFB399', '#FFAD26');
        if (val >= 1.00) return interpCol(val - 1, '#FF794D', '#FFB399');
        return '#444' 
      };

      const  getYearMonths = function(oneYear) {
        let byMonth = oneYear.groupBy(s => s.date.getMonth());
        const monthNums = Array.from({ length: 12 }, (_, index) => index); // 0..11
        
        return monthNums.map(function(m) {
          let scores = byMonth[m] ?? [];
          
          return {
            avg: scores.filter(s => s.summary > 0).average(s => s.summary),
            dateId: scores.first()?.date.format("{yyyy}-{MM}"),
            sz: scores.length * 0.8
          };
        });
      };
      
      const getYearInspiration = (yearScores) => {
        const inspiration = yearScores
          .filter(s => s.summary >= 4)
          .sample(2)
          .sortBy(s => s.date, true);

        return inspiration.isEmpty() ? null : this.tmplScores.render({ scores: this.enhanceScoresForDisplay(inspiration) });
      };

      let byYear = this.all.groupBy(s => s.date.getFullYear());
      let allYears = [];
      
      let year = null;
      for (year in byYear) {
        let oneYear = byYear[year];

        allYears.push({
          year: year,
          totalAvg: oneYear.average(s => s.summary).format(2),
          totalCount: oneYear.length,
          words: (oneYear.map(s => s.notes.split(' ').length).sum() / 1000.0).format(1),
          months: getYearMonths(oneYear),
          inspiration: getYearInspiration(oneYear),
        });
      }
      
      //let maxAvg = allYears.map(s => s.months.max(m => m.avg).first().avg).max().first();
      //let minAvg = allYears.map(s => s.months.min(m => m.avg).first().avg).min().first();
      
      for (const oneYear of allYears) {
        for (const oneMonth of oneYear.months) {
          // removed normalization for now. too complicated
          //const normalizedVal = (oneMonth.avg - minAvg) / (maxAvg - minAvg);
          //oneMonth.col = getColorForVal(1 + 4 * normalizedVal);

          oneMonth.col = getColorForVal(oneMonth.avg);
          oneMonth.avg = oneMonth.avg.toFixed(2);
        }
        
        oneYear.rank = allYears.filter(y => y.totalAvg > oneYear.totalAvg).length + 1;
        oneYear.rankStr = oneYear.rank < 4 ? `<span class="rank">${oneYear.rank}</span>` : '';
      }
       
      let inspiration = [];
      for (year in byYear) {
        let oneYear = byYear[year];
        
        inspiration.push({
          year: year,
          insp: getYearInspiration(oneYear)
        });
      }

      let bestDays = [];
      for (let i= 0; i < 7; i++) {
        bestDays.push(this.all.filter(d => d.date.getDay() === i).average(s => s.summary));
      }

      let bestMonths = [];
      for (let i= 0; i < 12; i++) {
        bestMonths.push(this.all.filter(d => d.date.getMonth() === i).average(s => s.summary));
      }

      let bestSeasons = [];
      for (let i = 0; i < 4; i++) {
        // Season mapping: 0=Winter, 1=Spring, 2=Summer, 3=Autumn
        let seasonMonths;
        switch(i) {
          case 0: seasonMonths = [11, 0, 1]; break; // Winter: Dec, Jan, Feb
          case 1: seasonMonths = [2, 3, 4]; break;  // Spring: Mar, Apr, May
          case 2: seasonMonths = [5, 6, 7]; break;  // Summer: Jun, Jul, Aug
          case 3: seasonMonths = [8, 9, 10]; break; // Autumn: Sep, Oct, Nov
        }
        
        let seasonScores = this.all.filter(d => seasonMonths.includes(d.date.getMonth()));
        bestSeasons.push(seasonScores.average(s => s.summary));
      }

      // Find maximum values for highlighting
      const maxDay = Math.max(...bestDays);
      const maxMonth = Math.max(...bestMonths);
      const maxSeason = Math.max(...bestSeasons);

      this.pushHistory('/years', 'Years');
      
      return this.render('#tmpl-years', '#content', {
        scores: allYears.reverse(),
        inspiration: inspiration.filter(i => i.insp != null).reverse(),
        years: this.years.map(y => ({year: y})),
        bestDays: bestDays.map((s, i) => ({
          value: s.format(2),
          isMax: s === maxDay
        })),
        bestMonths: bestMonths.map((s, i) => ({
          value: s.format(2),
          isMax: s === maxMonth
        })),
        bestSeasons: bestSeasons.map((s, i) => ({
          value: s.format(2),
          isMax: s === maxSeason
        })),
        streak: this.getMaxStreak(this.all),
        overview: this.getOverview(this.all)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
        scoreBar: Hogan.compile($('#tmpl-score-bar').html())
      });
    }

    pushHistory(url, title) {
      document.title = (title.length > 0) ? `Faveday - ${title}` : 'Faveday';
      // Only push to history if we're not currently handling a popstate event
      // and if the current URL is different from the one we're trying to push
      if (!window.poppingState && window.location.pathname !== url) {
        history.pushState({}, '', url);
      }
    }
    
    getTags(scores, sortBy = 'count') {
      // Use cached tag statistics instead of recalculating
      const re = /([#@])\p{L}[\p{L}\d]*/gui;
      
      let currentTagCounts = {};
      let personTags = new Set();
      
      // Only count current tags in the scores (for filtering purposes)
      for (let score of scores) {
        let matches = score.notes.match(re);
        if (matches) {
          matches.forEach(match => {
            let marker = match[0];
            let tagName = match.slice(1).toLowerCase();
            currentTagCounts[tagName] = (currentTagCounts[tagName] || 0) + 1;
            
            if (marker === '@') {
              personTags.add(tagName);
            }
          });
        }
      }

      // Build results using cached data
      let results = [];
      for (let tagName of Object.keys(currentTagCounts)) {
        const cachedStats = this.tagCache[tagName];
        const currentCount = currentTagCounts[tagName];
        
        // Determine if it's a person tag (from current usage or cache)
        const isPerson = personTags.has(tagName) || (cachedStats?.isPerson) || false;
        const isRecent = cachedStats?.recentActivity || false;
        
        // Use cached statistics when available, fallback to current data
        const totalUses = cachedStats?.totalUses || currentCount;
        const avgScore = cachedStats?.avgScore || 0;
        
        // For date sorting, calculate from current scores if cache doesn't have dates yet
        let firstUsage = null;
        let lastUsage = null;
        
        if (cachedStats?.firstUsage && cachedStats?.lastUsage) {
          firstUsage = new Date(cachedStats.firstUsage);
          lastUsage = new Date(cachedStats.lastUsage);
        } else {
          // Fallback: calculate from current scores if cache missing dates
          for (let score of scores) {
            let matches = score.notes.match(/[#@]\p{L}+/gui) || [];
            for (let match of matches) {
              if (match.slice(1).toLowerCase() === tagName) {
                if (!firstUsage || score.date < firstUsage) firstUsage = score.date;
                if (!lastUsage || score.date > lastUsage) lastUsage = score.date;
              }
            }
          }
        }
        const peakYear = cachedStats?.peakYear || 'unknown';
        const peakYearCount = cachedStats?.peakYearCount || 0;
        
        // Simple CSS classes
        let classes = '';
        if (isPerson) {
          classes += 'person ';
        } else {
          classes += 'tag '; // Topic tags need the 'tag' class for popup detection!
        }
        if (isRecent) classes += 'recent ';
        classes = classes.trim();
        
        // Data attributes for popup
        const yearStats = cachedStats?.yearStats || {};
        const dataAttrs = `data-tag="${tagName}" data-uses="${totalUses}" data-avg="${avgScore.toFixed(1)}" data-peak="${peakYear}" data-peak-count="${peakYearCount}" data-is-person="${isPerson}" data-year-stats='${JSON.stringify(yearStats)}'`;
        
        results.push({
          tag: tagName,
          count: totalUses,
          avgScore: avgScore,
          firstUsage: firstUsage,
          lastUsage: lastUsage,
          weight: 1, // No weight-based sizing
          color: '', // No inline color
          classes: classes,
          dataAttrs: dataAttrs
        });
      }

      // Sort based on selected criteria
      switch (sortBy) {
        case 'avgScore':
          return results.sort((a, b) => b.avgScore - a.avgScore);
        case 'firstUsage':
          return results.sort((a, b) => {
            if (!a.firstUsage && !b.firstUsage) return 0;
            if (!a.firstUsage) return 1;
            if (!b.firstUsage) return -1;
            return a.firstUsage - b.firstUsage;
          });
        case 'lastUsage':
          return results.sort((a, b) => {
            if (!a.lastUsage && !b.lastUsage) return 0;
            if (!a.lastUsage) return 1;
            if (!b.lastUsage) return -1;
            return b.lastUsage - a.lastUsage;
          });
        case 'count':
        default:
          return results.sort((a, b) => b.count - a.count);
      }
    }
    
    getGroupedTags(scores, sortBy = 'count') {
      // Get all tags and separate by type
      const allTags = this.getTags(scores, sortBy);
      
      const companions = allTags.filter(tag => tag.classes.includes('person')).slice(0, 8);
      const landmarks = allTags.filter(tag => !tag.classes.includes('person')).slice(0, 12);
      
      return {
        companions: companions,
        landmarks: landmarks,
        hasCompanions: companions.length > 0,
        hasLandmarks: landmarks.length > 0
      };
    }
    
    showTags(sortBy = 'count') {
      let tags = this.getTags(this.all, sortBy).slice(0,250);
      
      this.pushHistory(`/tags`, 'Tags');

      return this.render('#tmpl-tags', '#content', {
        years: this.years.map(y => ({year: y})),
        tags: tags,
        sortBy: sortBy,
        sortOptions: {
          count: sortBy === 'count',
          avgScore: sortBy === 'avgScore', 
          firstUsage: sortBy === 'firstUsage',
          lastUsage: sortBy === 'lastUsage'
        }
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    showYear(yearNum) {
      let year = parseInt(yearNum);
      let oneYear = this.getScores(year)
      let byMonth = oneYear.groupBy(s => s.date.getMonth());
      
      const monthNums = Array.from({ length: 12 }, (_, index) => index); // 0..11
      const dayNums = Array.from({ length: 31 }, (_, index) => index + 1); // 1..31
      
      let months = monthNums.map(month => {
        let scores = byMonth[month] ?? [];
        let date = Date.create(`${year}-${parseInt(month) + 1}`);

        let days = dayNums.map(dayNum => {
          let date = Date.create(`${year}-${parseInt(month) + 1}-${dayNum}`);
          
          return {
            val: isNaN(date) ? "X" : scores.find(s => s.date.getDate() === dayNum)?.summary ?? 0,
            weekday: date.getDay()
          }
        });
        
        let offset = days[0].weekday // 0 is sunday
        for (let i=0; i<offset; i++)
          days.splice(i, 0, {val:"X", weekday:i});
        
        return {
          date: date.format('{Mon} {yyyy}'),
          avg: scores.average(s => s.summary).format(2),
          link: `/month/${yearNum}/${parseInt(month) + 1}`,
          monthId: date.format('{yyyy}-{MM}'),
          monthsId: date.format('{MM}'),
          days: days
        }
      });
      
      months.reverse();
      let randomScores = oneYear.filter(s => s.summary >=3).sample(5);
      let bestScores = oneYear.filter(s => s.summary === 5).sample(1).sortBy(s => s.date, true);

      this.pushHistory(`/year/${year}`, year);
      
      return this.render('#tmpl-year', '#content', {
        year: year,
        average: oneYear.average(s => s.summary).format(2),
        scores: randomScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(randomScores)}),
        inspiration: bestScores.isEmpty() ? [] : this.tmplScores.render({scores: this.enhanceScoresForDisplay(bestScores)}),
        months: months,
        years: this.years.map(y => ({year: y})),
        streak: this.getMaxStreak(oneYear),
        overview: this.getOverview(oneYear)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
        scoreBar: Hogan.compile($('#tmpl-score-bar').html())
      });
    }

    showSearch(id) {
      const searchInput = $('#search input')[0];
      if (!searchInput) {
        console.error('Search input not found');
        return this.showDashboard();
      }
      
      id = searchInput.value;
      
      if (id.length < 1) {
        return this.showDashboard();
      }
      
      let foundScores = this.all;
      let keywords = [];
      let ref = id.split(' ');
      
      for (let j = 0, len = ref.length; j < len; j++) {
        let needle = ref[j];
        
        if (needle.length < 1) {
          continue;
        }
        
        needle = needle.toLowerCase();
        
        if (needle[0] === '=') {
          let score = parseInt(needle[1], 10)
          foundScores = foundScores.filter(s => s.summary === score);
          
        } else if (needle[0] === '>') {
          let score = parseInt(needle[1], 10)
          foundScores = foundScores.filter(s => s.summary >= score);
          
        } else if (needle[0] === '<') {
          let score = parseInt(needle[1], 10)
          foundScores = foundScores.filter(s => s.summary <= score);
          
        } else {
          // arbitrary date criteria
          let date = Date.create(needle);
          if (date.isValid()) {
            foundScores = foundScores.filter(s => s.date.is(needle));
            
          // text criteria
          } else if (needle.length > 0) {
            if (this.tagsOnly) {
              // Tag-only search: look for #needle or @needle
              const tagRegex = new RegExp(`[#@]${needle.toLowerCase()}\\b`, 'i');
              foundScores = foundScores.filter(s => tagRegex.test(s.notes.toLowerCase()));
            } else {
              // Regular text search
              const needleLower = needle.toLowerCase();
              const regex = new RegExp(`\\b${needleLower}`, 'i'); // 'i' makes it case-insensitive
              foundScores = foundScores.filter(s => regex.test(s.notes));
            }
            
            keywords.push(needle);
          }
        }
      }
      
      let hits = this.years.map(y => ({
        year: y,
        count: foundScores.filter(s => s.date.getFullYear() === y).length
      }));
      
      // Create chart data for all years (including empty ones)
      const maxHits = Math.max(...hits.map(h => h.count), 1);
      const yearChart = this.years.map(year => {
        const yearScores = foundScores.filter(s => s.date.getFullYear() === year);
        const count = yearScores.length;
        const avgScore = count > 0 ? yearScores.average(s => s.summary) : 0;
        const percentage = foundScores.length > 0 ? Math.round((count / foundScores.length) * 100) : 0;
        
        return {
          year: year,
          count: count,
          avgScore: avgScore,
          percentage: percentage,
          hasResults: count > 0,
          height: count > 0 ? Math.max(3, Math.round((count / maxHits) * 40)) : 0
        };
      });
      
      // Group scores by year for better organization
      const scoresByYear = foundScores.length > 0 ? foundScores.groupBy(s => s.date.getFullYear()) : {};
      const yearGroups = [];
      
      // Create year groups in reverse chronological order (newest first)
      for (let year of this.years.slice().reverse()) {
        const yearScores = scoresByYear[year] || [];
        if (yearScores.length > 0) {
          yearGroups.push({
            year: year,
            count: yearScores.length,
            scores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(yearScores)})
          });
        }
      }
      
      this.render('#tmpl-search', '#content', {
        count: foundScores.length,
        hasResults: foundScores.length > 0,
        average: foundScores.length > 0 ? foundScores.average(s => s.summary).format(2) : "0.00",
        scores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(foundScores)}),
        yearGroups: yearGroups,
        years: this.years.map(y => ({year: y})),
        hits: hits.filter(hit => hit.count > 0),
        yearChart: yearChart,
        firstYear: this.years[0],
        lastYear: this.years[this.years.length - 1],
        streak: foundScores.length > 0 ? this.getMaxStreak(foundScores) : {count: 0, start: "", end: ""},
        tags: foundScores.length > 0 ? this.getTags(foundScores) : [],
        tagGroups: foundScores.length > 0 ? this.getGroupedTags(foundScores) : null,
        tagsOnly: this.tagsOnly
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
      
      // Apply search highlighting while preserving tag suggestions
      let notesElem = $('.notes');
      for (let k = 0; k < notesElem.length; k++) {
        let elem = notesElem[k];

        for (let n = 0; n < keywords.length; n++) {
          let keyword = keywords[n];
          
          // Create a more sophisticated regex that avoids matching inside tag suggestions
          // We need to avoid matching content inside elements with class "tag-suggestion"
          const textNodes = this.getTextNodesWithoutTagSuggestions(elem);
          
          textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const regex = new RegExp(`(${keyword})`, 'ig');
            
            if (regex.test(text)) {
              // Create a temporary container to hold the highlighted content
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = text.replace(regex, "<em>$1</em>");
              
              // Replace the text node with the highlighted content
              const fragment = document.createDocumentFragment();
              while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
              }
              textNode.parentNode.replaceChild(fragment, textNode);
            }
          });
        }
      }

      this.pushHistory(`/search/${id}`, id);
    }
    
    showEditScore(dateId) {
      if (dateId == null)
      {
        let now = new Date();
        if (now.getHours() < 18)
          now.addDays(-1);

        dateId = now.format("{yyyy}-{MM}-{dd}");
      }
        
      // if ($('#editScore').is(':visible')) {
      //   this.hideEditScore();
      //   return;
      // }
      
      $('#editScore').show();
      $('#content').hide();
      
      // Find the last entry for this date (most recent if multiple exist)
      let matches = this.all.filter(s => s.dateId() === dateId)
      let score = matches.length > 0 ? matches[matches.length - 1] : null
      
      if (score == null) {
        score = new Score(new Date(), 3, '')
      }

      this.updateScoreProgress(score.notes)
      this.selectScoreVal(score.summary);
      
      let date = new Date(dateId);
      let dateLabel = Sugar.Date.format(date, '{d} {Month} {yyyy} ({Weekday})')
      $('#editScore .date .thisDay').text(dateLabel);
      
      let nextDay = date.addDays(1)
      let prevDay = date.addDays(-1)
      
      let textarea = $('#editScore textarea')
      textarea.val(score.notes);
      textarea.focus(); // Focus on the textarea
      textarea.get(0).setSelectionRange(score.notes.length, score.notes.length);
    }
    
    hideEditScore() {
      $('#editScore').hide();
      $('#content').show();
    }
    
    selectScoreVal(val) {
      this.currentVal = val;

      const buttons = document.querySelectorAll('.valButton');
      buttons.forEach(button => {
        button.classList.remove('val1', 'val2', 'val3', 'val4', 'val5');
      });

      const selectedButton = buttons[val - 1];
      selectedButton.classList.add(`val${val}`);
    }
    
    selectDay(dayDiff) {
      let dateLabel = $('#editScore .date .thisDay').text()
      let date = new Date(dateLabel);
      let nextDate = date.addDays(dayDiff) 
      this.showEditScore(nextDate.format("{yyyy}-{MM}-{dd}"));
    }

    submitScore() {
      let dateLabel = $('#editScore .date .thisDay').text()
      let dateId = new Date(dateLabel).format("{yyyy}-{MM}-{dd}")

      let score = this.all.find(s => s.dateId() === dateId)
      let isNew = false;
      
      if (score == null)
      {
        score = new Score(new Date(), 3, '')
        this.all.push(score)
        isNew = true;
      }
      
      let notes = $('#editScore textarea').val();
      
      score.date = new Date(dateId)
      score.summary = this.currentVal
      score.notes = notes
      
      console.log(`${isNew ? 'added' : 'edited'} score (${this.currentVal}): ${notes}`)
      
      // Format date for toaster notification
      const formattedDate = this.formatDateWithOrdinal(score.date);
      const action = isNew ? 'added' : 'updated';
      this.showToaster(`Date ${formattedDate} ${action}.`);
      
      this.hideEditScore();
      this.onScoreAddedAndNavigateBack();
      this.saveScores()
    }
    
    updateScoreProgress(text) {
      const maxWords = 100; // Set the maximum word count for full progress
      const wordCount = text === '' ? 0 : text.split(/\s+/).length; // Split the text by spaces

      // Calculate progress percentage
      const progressValue = Math.min((wordCount / maxWords) * 100, 100); // Limit to 100%

      // Update the progress bar
      document.getElementById('editScoreProgress').value = progressValue;
    }

    getCalendarYearProgress() {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear(), 11, 31);
      const daysPassed = Math.floor((now - yearStart) / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = Math.floor((yearEnd - yearStart) / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        year: now.getFullYear(),
        daysPassed: daysPassed,
        totalDays: totalDays,
        percentage: Math.round((daysPassed / totalDays) * 100)
      };
    }

    getLifeYearProgress(birthdate) {
      if (!birthdate) return null;
      
      const now = new Date();
      const birth = new Date(birthdate);
      
      // Calculate current life year (age)
      let lifeYear = now.getFullYear() - birth.getFullYear();
      const monthDiff = now.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
        lifeYear--;
      }
      
      // Calculate life year boundaries
      const lifeYearStart = new Date(birth.getFullYear() + lifeYear, birth.getMonth(), birth.getDate());
      const lifeYearEnd = new Date(birth.getFullYear() + lifeYear + 1, birth.getMonth(), birth.getDate() - 1);
      
      const daysPassed = Math.floor((now - lifeYearStart) / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = Math.floor((lifeYearEnd - lifeYearStart) / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        age: lifeYear, // Actual current age
        nextAge: lifeYear + 1, // Next age they will turn
        daysPassed: daysPassed,
        totalDays: totalDays,
        percentage: Math.round((daysPassed / totalDays) * 100)
      };
    }

    getDaysSinceLastScore(targetScore) {
      const now = new Date();
      const targetScores = this.all.filter(s => s.summary === targetScore);
      
      if (targetScores.length === 0) {
        return null; // No scores of this type found
      }
      
      const latestScore = targetScores.sort((a, b) => b.date - a.date)[0];
      const daysDiff = Math.floor((now - latestScore.date) / (1000 * 60 * 60 * 24));
      
      // Calculate trend by comparing current vs previous 30-day periods
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(now.getDate() - 60);
      
      // Get most recent target score in last 30 days
      const currentPeriodScores = this.all.filter(s => 
        s.summary === targetScore && s.date >= thirtyDaysAgo
      );
      const currentDays = currentPeriodScores.length > 0 ? 
        Math.floor((now - currentPeriodScores.sort((a, b) => b.date - a.date)[0].date) / (1000 * 60 * 60 * 24)) : 
        null;
      
      // Get most recent target score in previous 30 days (30-60 days ago)
      const previousPeriodScores = this.all.filter(s => 
        s.summary === targetScore && s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo
      );
      const previousDays = previousPeriodScores.length > 0 ? 
        Math.floor((thirtyDaysAgo - previousPeriodScores.sort((a, b) => b.date - a.date)[0].date) / (1000 * 60 * 60 * 24)) : 
        null;
      
      // Calculate trend based on score type
      let trend = 'same';
      let trendDisplay = '';
      
      if (currentDays !== null && previousDays !== null) {
        const diff = currentDays - previousDays;
        
        if (targetScore >= 4) {
          // For high scores (4+): lower days since = better (inverted logic)
          if (diff < 0) {
            trend = 'up'; // More recent high score = better
            trendDisplay = `↗ ${Math.abs(diff)} days more recent`;
          } else if (diff > 0) {
            trend = 'down'; // Less recent high score = worse
            trendDisplay = `↘ +${diff} days longer ago`;
          }
        } else {
          // For low scores (1-2): higher days since = better (normal logic)
          if (diff > 0) {
            trend = 'up'; // Longer since low score = better
            trendDisplay = `↗ +${diff} days longer ago`;
          } else if (diff < 0) {
            trend = 'down'; // More recent low score = worse
            trendDisplay = `↘ ${Math.abs(diff)} days more recent`;
          }
        }
      }
      
      return {
        days: daysDiff,
        lastDate: latestScore.dateStr(),
        dateId: latestScore.dateId(),
        trend: trend,
        trendDisplay: trendDisplay
      };
    }

    getCoverageProgress() {
      const now = new Date();
      const threeSixtyFiveDaysAgo = new Date(now);
      threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
      
      // Calculate for previous year (730 days ago to 365 days ago)
      const sevenThirtyDaysAgo = new Date(now);
      sevenThirtyDaysAgo.setDate(now.getDate() - 730);
      
      // Get the earliest score date to determine actual range
      const firstScoreDate = this.all.length > 0 ? this.all[this.all.length - 1].date : now;
      
      // Current year range
      const currentRangeStart = threeSixtyFiveDaysAgo > firstScoreDate ? threeSixtyFiveDaysAgo : firstScoreDate;
      const currentDaysPassed = Math.floor((now - currentRangeStart) / (1000 * 60 * 60 * 24)) + 1;
      const currentEntriesInRange = this.all.filter(score => score.date >= currentRangeStart).length;
      const currentPercentage = currentDaysPassed > 0 ? Math.round((currentEntriesInRange / currentDaysPassed) * 100) : 0;
      
      // Previous year range
      const previousRangeStart = sevenThirtyDaysAgo > firstScoreDate ? sevenThirtyDaysAgo : firstScoreDate;
      const previousYearEntries = this.all.filter(score => 
        score.date >= previousRangeStart && score.date < threeSixtyFiveDaysAgo
      ).length;
      const previousYearDays = Math.floor((threeSixtyFiveDaysAgo - previousRangeStart) / (1000 * 60 * 60 * 24));
      const previousPercentage = previousYearDays > 0 ? Math.round((previousYearEntries / previousYearDays) * 100) : 0;
      
      // Calculate delta
      const delta = currentPercentage - previousPercentage;
      const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
      const deltaDisplay = delta === 0 ? '' : 
        delta > 0 ? `↗ +${delta}%` : `↘ -${Math.abs(delta)}%`;
      
      return {
        entriesMade: currentEntriesInRange,
        daysPassed: currentDaysPassed,
        percentage: currentPercentage,
        previousPercentage: previousPercentage,
        delta: delta,
        trend: trend,
        deltaDisplay: deltaDisplay
      };
    }

    getThirtyDayComparisons() {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(now.getDate() - 60);

      // Current 30 days
      const currentPeriod = this.all.filter(s => s.date >= thirtyDaysAgo && s.date <= now);
      
      // Previous 30 days (31-60 days ago)
      const previousPeriod = this.all.filter(s => s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo);

      // Word count comparison
      const currentWordCount = currentPeriod.reduce((sum, score) => sum + (score.notes ? score.notes.split(/\s+/).length : 0), 0);
      const previousWordCount = previousPeriod.reduce((sum, score) => sum + (score.notes ? score.notes.split(/\s+/).length : 0), 0);
      const currentAvgWords = currentPeriod.length > 0 ? Math.round(currentWordCount / 30) : 0;
      const previousAvgWords = previousPeriod.length > 0 ? Math.round(previousWordCount / 30) : 0;
      const wordsDiff = currentAvgWords - previousAvgWords;

      // Entry count comparison
      const currentEntries = currentPeriod.length;
      const previousEntries = previousPeriod.length;
      const entriesDiff = currentEntries - previousEntries;

      // Average score comparison
      const currentAvgScore = currentPeriod.length > 0 ? currentPeriod.reduce((sum, s) => sum + s.summary, 0) / currentPeriod.length : 0;
      const previousAvgScore = previousPeriod.length > 0 ? previousPeriod.reduce((sum, s) => sum + s.summary, 0) / previousPeriod.length : 0;
      const scoreDiff = currentAvgScore - previousAvgScore;

      // Most used tag in recent 30 days
      const tagCounts = {};
      currentPeriod.forEach(score => {
        const tags = score.notes.match(/[#@]\p{L}+/gui) || [];
        tags.forEach(tag => {
          const cleanTag = tag.slice(1).toLowerCase();
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        });
      });
      
      const topTag = Object.entries(tagCounts).length > 0 
        ? Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0] 
        : null;

      const formatTrend = (diff, trend, currentVal) => {
        if (diff === 0) return '';
        const arrow = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
        const sign = diff > 0 ? '+' : '';
        
        // Calculate percentage change
        const percentageChange = currentVal > 0 ? Math.round((diff / currentVal) * 100) : 0;
        const absPercentage = Math.abs(percentageChange);
        
        return ` ${arrow} ${sign}${absPercentage}%`;
      };

      return {
        words: {
          current: currentAvgWords,
          previous: previousAvgWords,
          diff: wordsDiff,
          trend: wordsDiff > 0 ? 'up' : wordsDiff < 0 ? 'down' : 'same',
          trendDisplay: formatTrend(wordsDiff, wordsDiff > 0 ? 'up' : wordsDiff < 0 ? 'down' : 'same', previousAvgWords)
        },
        entries: {
          current: currentEntries,
          previous: previousEntries,
          diff: entriesDiff,
          trend: entriesDiff > 0 ? 'up' : entriesDiff < 0 ? 'down' : 'same',
          trendDisplay: formatTrend(entriesDiff, entriesDiff > 0 ? 'up' : entriesDiff < 0 ? 'down' : 'same', previousEntries)
        },
        score: {
          current: Math.round(currentAvgScore * 10) / 10,
          previous: Math.round(previousAvgScore * 10) / 10,
          diff: Math.round(scoreDiff * 10) / 10,
          trend: scoreDiff > 0 ? 'up' : scoreDiff < 0 ? 'down' : 'same',
          trendDisplay: formatTrend(Math.round(scoreDiff * 10) / 10, scoreDiff > 0 ? 'up' : scoreDiff < 0 ? 'down' : 'same', Math.round(previousAvgScore * 10) / 10),
          trendEmoji: scoreDiff > 0 ? '📈' : scoreDiff < 0 ? '📉' : '➡️'
        },
        topTag: topTag ? { tag: topTag[0], count: topTag[1] } : null,
        lastHighScore: this.getDaysSinceLastScore(5),
        lastLowScore: this.getDaysSinceLastScore(1)
      };
    }

    getPersonMentionsRatio() {
      const now = new Date();
      const threeSixtyFiveDaysAgo = new Date(now);
      threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
      const sevenThirtyDaysAgo = new Date(now);
      sevenThirtyDaysAgo.setDate(now.getDate() - 730);
      
      // Current period (last 365 days)
      const currentEntries = this.all.filter(score => score.date >= threeSixtyFiveDaysAgo);
      const currentEntriesWithPeople = currentEntries.filter(score => 
        score.notes && score.notes.match(/@\p{L}[\p{L}\d]*/gu)
      );
      
      // Previous period (365 days before that)
      const previousEntries = this.all.filter(score => 
        score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo
      );
      const previousEntriesWithPeople = previousEntries.filter(score => 
        score.notes && score.notes.match(/@\p{L}[\p{L}\d]*/gu)
      );
      
      const currentPercentage = currentEntries.length > 0 ? 
        Math.round((currentEntriesWithPeople.length / currentEntries.length) * 100) : 0;
      const previousPercentage = previousEntries.length > 0 ? 
        Math.round((previousEntriesWithPeople.length / previousEntries.length) * 100) : 0;
      
      // Calculate trend
      const diff = currentPercentage - previousPercentage;
      const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
      const trendDisplay = diff === 0 ? '' : 
        diff > 0 ? `↗ +${Math.abs(diff)}%` : `↘ -${Math.abs(diff)}%`;
      
      return {
        percentage: currentPercentage,
        daysWithPeople: currentEntriesWithPeople.length,
        totalDays: currentEntries.length,
        trend: trend,
        trendDisplay: trendDisplay,
        previousPercentage: previousPercentage
      };
    }

    getLazySundays() {
      const now = new Date();
      const threeSixtyFiveDaysAgo = new Date(now);
      threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
      const sevenThirtyDaysAgo = new Date(now);
      sevenThirtyDaysAgo.setDate(now.getDate() - 730);
      
      // Current period
      const currentSundays = this.all.filter(score => 
        score.date >= threeSixtyFiveDaysAgo && score.date.getDay() === 0
      );
      const currentLazySundays = currentSundays.filter(score => score.summary <= 2);
      
      // Previous period
      const previousSundays = this.all.filter(score => 
        score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo && score.date.getDay() === 0
      );
      const previousLazySundays = previousSundays.filter(score => score.summary <= 2);
      
      const currentPercentage = currentSundays.length > 0 ? 
        Math.round((currentLazySundays.length / currentSundays.length) * 100) : 0;
      const previousPercentage = previousSundays.length > 0 ? 
        Math.round((previousLazySundays.length / previousSundays.length) * 100) : 0;
      
      // Calculate trend (note: for lazy days, more is bad, so invert the trend logic)
      const diff = currentPercentage - previousPercentage;
      const trend = diff > 0 ? 'down' : diff < 0 ? 'up' : 'same'; // Inverted: more lazy = down trend
      const trendDisplay = diff === 0 ? '' : 
        diff > 0 ? `↘ +${Math.abs(diff)}%` : `↗ -${Math.abs(diff)}%`;
      
      return {
        percentage: currentPercentage,
        lazyCount: currentLazySundays.length,
        totalSundays: currentSundays.length,
        trend: trend,
        trendDisplay: trendDisplay,
        previousPercentage: previousPercentage
      };
    }

    getLazySaturdays() {
      const now = new Date();
      const threeSixtyFiveDaysAgo = new Date(now);
      threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
      const sevenThirtyDaysAgo = new Date(now);
      sevenThirtyDaysAgo.setDate(now.getDate() - 730);
      
      // Current period
      const currentSaturdays = this.all.filter(score => 
        score.date >= threeSixtyFiveDaysAgo && score.date.getDay() === 6
      );
      const currentLazySaturdays = currentSaturdays.filter(score => score.summary <= 2);
      
      // Previous period
      const previousSaturdays = this.all.filter(score => 
        score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo && score.date.getDay() === 6
      );
      const previousLazySaturdays = previousSaturdays.filter(score => score.summary <= 2);
      
      const currentPercentage = currentSaturdays.length > 0 ? 
        Math.round((currentLazySaturdays.length / currentSaturdays.length) * 100) : 0;
      const previousPercentage = previousSaturdays.length > 0 ? 
        Math.round((previousLazySaturdays.length / previousSaturdays.length) * 100) : 0;
      
      // Calculate trend (note: for lazy days, more is bad, so invert the trend logic)
      const diff = currentPercentage - previousPercentage;
      const trend = diff > 0 ? 'down' : diff < 0 ? 'up' : 'same'; // Inverted: more lazy = down trend
      const trendDisplay = diff === 0 ? '' : 
        diff > 0 ? `↘ +${Math.abs(diff)}%` : `↗ -${Math.abs(diff)}%`;
      
      return {
        percentage: currentPercentage,
        lazyCount: currentLazySaturdays.length,
        totalSaturdays: currentSaturdays.length,
        trend: trend,
        trendDisplay: trendDisplay,
        previousPercentage: previousPercentage
      };
    }

    getTotalOverview() {
      const totalEntries = this.all.length;
      const totalScoreSum = this.all.reduce((sum, score) => sum + (score.summary || 0), 0);
      const avgScore = totalEntries > 0 ? (totalScoreSum / totalEntries).toFixed(1) : '0.0';
      
      return {
        totalEntries: totalEntries,
        totalScoreAvg: avgScore
      };
    }

    getFiveScoreDaysCount() {
      const now = new Date();
      const threeSixtyFiveDaysAgo = new Date(now);
      threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
      const sevenThirtyDaysAgo = new Date(now);
      sevenThirtyDaysAgo.setDate(now.getDate() - 730);
      
      // Current period
      const currentFiveScoreDays = this.all.filter(score => 
        score.date >= threeSixtyFiveDaysAgo && score.summary === 5
      ).length;
      
      // Previous period
      const previousFiveScoreDays = this.all.filter(score => 
        score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo && score.summary === 5
      ).length;
      
      // Calculate trend
      const diff = currentFiveScoreDays - previousFiveScoreDays;
      const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
      const trendDisplay = diff === 0 ? '' : 
        diff > 0 ? `↗ +${Math.abs(diff)}` : `↘ -${Math.abs(diff)}`;
      
      return {
        count: currentFiveScoreDays,
        previousCount: previousFiveScoreDays,
        trend: trend,
        trendDisplay: trendDisplay
      };
    }

    getAverageDurationBetweenHighScores() {
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(now.getFullYear() - 2);
      
      // Helper function to calculate average duration
      const calculateAverageDuration = (entries) => {
        const highScoreEntries = entries.filter(score => score.summary >= 4)
          .sort((a, b) => a.date - b.date);
        
        if (highScoreEntries.length < 2) return null;
        
        const durations = [];
        for (let i = 1; i < highScoreEntries.length; i++) {
          const daysDiff = Math.floor((highScoreEntries[i].date - highScoreEntries[i-1].date) / (1000 * 60 * 60 * 24));
          durations.push(daysDiff);
        }
        
        return durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : null;
      };
      
      // Current year (last 365 days)
      const currentYearEntries = this.all.filter(score => score.date >= oneYearAgo);
      const currentAvgDuration = calculateAverageDuration(currentYearEntries);
      
      // Previous year (365 days before that)
      const previousYearEntries = this.all.filter(score => 
        score.date >= twoYearsAgo && score.date < oneYearAgo
      );
      const previousAvgDuration = calculateAverageDuration(previousYearEntries);
      
      // Calculate trend (note: for duration, lower is better, so trend logic is inverted)
      let trend = 'same';
      let trendDisplay = '';
      
      if (currentAvgDuration !== null && previousAvgDuration !== null) {
        const diff = currentAvgDuration - previousAvgDuration;
        if (diff < 0) {
          trend = 'up'; // Getting better (lower duration)
          trendDisplay = `↗ ${Math.abs(diff)} days less`;
        } else if (diff > 0) {
          trend = 'down'; // Getting worse (higher duration)
          trendDisplay = `↘ +${diff} days more`;
        }
      }
      
      return {
        averageDays: currentAvgDuration,
        previousAverageDays: previousAvgDuration,
        trend: trend,
        trendDisplay: trendDisplay
      };
    }

    getLazyWorkweeks() {
      const now = new Date();
      const threeSixtyFiveDaysAgo = new Date(now);
      threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
      const sevenThirtyDaysAgo = new Date(now);
      sevenThirtyDaysAgo.setDate(now.getDate() - 730);
      
      // Helper function to get Monday of the week for a given date
      const getMondayOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
      };
      
      // Current period workweeks
      const currentEntries = this.all.filter(score => score.date >= threeSixtyFiveDaysAgo);
      const currentWorkweeks = new Map();
      
      currentEntries.forEach(entry => {
        const dayOfWeek = entry.date.getDay();
        // Only count Monday (1) through Friday (5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const monday = getMondayOfWeek(entry.date);
          const weekKey = monday.toISOString().split('T')[0];
          
          if (!currentWorkweeks.has(weekKey)) {
            currentWorkweeks.set(weekKey, 0);
          }
          currentWorkweeks.set(weekKey, currentWorkweeks.get(weekKey) + entry.summary);
        }
      });
      
      const currentLazyWorkweeks = Array.from(currentWorkweeks.values()).filter(total => total <= 10);
      const currentTotalWorkweeks = currentWorkweeks.size;
      
      // Previous period workweeks
      const previousEntries = this.all.filter(score => 
        score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo
      );
      const previousWorkweeks = new Map();
      
      previousEntries.forEach(entry => {
        const dayOfWeek = entry.date.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const monday = getMondayOfWeek(entry.date);
          const weekKey = monday.toISOString().split('T')[0];
          
          if (!previousWorkweeks.has(weekKey)) {
            previousWorkweeks.set(weekKey, 0);
          }
          previousWorkweeks.set(weekKey, previousWorkweeks.get(weekKey) + entry.summary);
        }
      });
      
      const previousLazyWorkweeks = Array.from(previousWorkweeks.values()).filter(total => total <= 10);
      const previousTotalWorkweeks = previousWorkweeks.size;
      
      const currentPercentage = currentTotalWorkweeks > 0 ? 
        Math.round((currentLazyWorkweeks.length / currentTotalWorkweeks) * 100) : 0;
      const previousPercentage = previousTotalWorkweeks > 0 ? 
        Math.round((previousLazyWorkweeks.length / previousTotalWorkweeks) * 100) : 0;
      
      // Calculate trend (note: for lazy workweeks, more is bad, so invert the trend logic)
      const diff = currentPercentage - previousPercentage;
      const trend = diff > 0 ? 'down' : diff < 0 ? 'up' : 'same'; // Inverted: more lazy = down trend
      const trendDisplay = diff === 0 ? '' : 
        diff > 0 ? `↘ +${Math.abs(diff)}%` : `↗ -${Math.abs(diff)}%`;
      
      return {
        percentage: currentPercentage,
        lazyCount: currentLazyWorkweeks.length,
        totalWorkweeks: currentTotalWorkweeks,
        trend: trend,
        trendDisplay: trendDisplay,
        previousPercentage: previousPercentage
      };
    }

    getTrendingTopics() {
      // Get recent 30-day usage for topic tags (#tags)
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      
      const recentEntries = this.all.filter(s => s.date >= thirtyDaysAgo);
      const recentTopicCounts = {};
      
      recentEntries.forEach(score => {
        const topicTags = score.notes.match(/#\p{L}[\p{L}\d]*/gu) || [];
        topicTags.forEach(tag => {
          const cleanTag = tag.slice(1).toLowerCase();
          recentTopicCounts[cleanTag] = (recentTopicCounts[cleanTag] || 0) + 1;
        });
      });
      
      // Load tag cache to get historical usage
      let tagCache = {};
      try {
        tagCache = JSON.parse(localStorage.getItem('tagCache') || '{}');
      } catch (e) {
        console.warn('Could not load tag cache for trending topics');
      }
      
      // Find tags with recent surge that aren't staples
      const trendingTopics = [];
      Object.entries(recentTopicCounts).forEach(([tag, recentCount]) => {
        const cacheData = tagCache[tag];
        if (!cacheData || cacheData.isPerson) return; // Skip people tags or missing cache
        
        const totalUses = cacheData.totalUses || 0;
        const historicalAvg = totalUses > 0 ? totalUses / Math.max(1, Object.keys(cacheData.yearStats || {}).length) : 0;
        
        // Only include tags that:
        // 1. Have recent activity (>= 2 uses in 30 days)  
        // 2. Show surge (recent usage > 2x historical average)
        // 3. Aren't super common staples (< 50 total historical uses)
        if (recentCount >= 2 && recentCount > (historicalAvg * 2) && totalUses < 50) {
          const surgeRatio = historicalAvg > 0 ? (recentCount / historicalAvg) : recentCount;
          trendingTopics.push({
            tag: tag,
            recentCount: recentCount,
            surgeRatio: Math.round(surgeRatio * 10) / 10,
            avgScore: cacheData.avgScore || 0
          });
        }
      });
      
      // Sort by surge ratio (highest surge first)
      trendingTopics.sort((a, b) => b.surgeRatio - a.surgeRatio);
      
      return trendingTopics.length > 0 ? trendingTopics[0] : null;
    }

    getTrendingPeople() {
      // Get recent 30-day usage for person tags (@tags)
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      
      const recentEntries = this.all.filter(s => s.date >= thirtyDaysAgo);
      const recentPersonCounts = {};
      
      recentEntries.forEach(score => {
        const personTags = score.notes.match(/@\p{L}[\p{L}\d]*/gu) || [];
        personTags.forEach(tag => {
          const cleanTag = tag.slice(1).toLowerCase();
          recentPersonCounts[cleanTag] = (recentPersonCounts[cleanTag] || 0) + 1;
        });
      });
      
      // Load tag cache to get historical usage
      let tagCache = {};
      try {
        tagCache = JSON.parse(localStorage.getItem('tagCache') || '{}');
      } catch (e) {
        console.warn('Could not load tag cache for trending people');
      }
      
      // Find people with recent activity surge
      const trendingPeople = [];
      Object.entries(recentPersonCounts).forEach(([person, recentCount]) => {
        const cacheData = tagCache[person];
        if (!cacheData || !cacheData.isPerson) return; // Skip topic tags or missing cache
        
        const totalUses = cacheData.totalUses || 0;
        const historicalAvg = totalUses > 0 ? totalUses / Math.max(1, Object.keys(cacheData.yearStats || {}).length) : 0;
        
        // Only include people that:
        // 1. Have recent activity (>= 2 mentions in 30 days)
        // 2. Show surge (recent mentions > 1.5x historical average) 
        // 3. Aren't constant mentions (< 30 total historical uses)
        if (recentCount >= 2 && recentCount > (historicalAvg * 1.5) && totalUses < 30) {
          const surgeRatio = historicalAvg > 0 ? (recentCount / historicalAvg) : recentCount;
          trendingPeople.push({
            person: person,
            recentCount: recentCount,
            surgeRatio: Math.round(surgeRatio * 10) / 10,
            avgScore: cacheData.avgScore || 0
          });
        }
      });
      
      // Sort by surge ratio (highest surge first)
      trendingPeople.sort((a, b) => b.surgeRatio - a.surgeRatio);
      
      return trendingPeople.length > 0 ? trendingPeople[0] : null;
    }

    getScoreConsistency() {
      const now = new Date();
      const threeSixtyFiveDaysAgo = new Date(now);
      threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
      const sevenThirtyDaysAgo = new Date(now);
      sevenThirtyDaysAgo.setDate(now.getDate() - 730);
      
      // Helper function to calculate standard deviation
      const calculateStandardDeviation = (scores) => {
        if (scores.length === 0) return 0;
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
        return Math.sqrt(avgSquaredDiff);
      };
      
      // Current period (last 365 days)
      const currentEntries = this.all.filter(score => score.date >= threeSixtyFiveDaysAgo);
      const currentScores = currentEntries.map(entry => entry.summary);
      const currentStdDev = calculateStandardDeviation(currentScores);
      
      // Previous period (365 days before that)
      const previousEntries = this.all.filter(score => 
        score.date >= sevenThirtyDaysAgo && score.date < threeSixtyFiveDaysAgo
      );
      const previousScores = previousEntries.map(entry => entry.summary);
      const previousStdDev = calculateStandardDeviation(previousScores);
      
      // Calculate consistency score (inverted - lower std dev = higher consistency)
      const currentConsistency = currentStdDev > 0 ? Math.round((2.0 / currentStdDev) * 100) / 100 : 5.0;
      const previousConsistency = previousStdDev > 0 ? Math.round((2.0 / previousStdDev) * 100) / 100 : 5.0;
      
      // Calculate trend (higher consistency = better trend)
      const diff = currentConsistency - previousConsistency;
      const trend = diff > 0.1 ? 'up' : diff < -0.1 ? 'down' : 'same';
      
      const trendDisplay = Math.abs(diff) < 0.1 ? '' : 
        diff > 0 ? `↗ +${Math.round(Math.abs(diff) * 100) / 100}` : `↘ -${Math.round(Math.abs(diff) * 100) / 100}`;
      
      return {
        consistency: currentConsistency,
        stdDev: Math.round(currentStdDev * 100) / 100,
        previousConsistency: previousConsistency,
        previousStdDev: Math.round(previousStdDev * 100) / 100,
        entryCount: currentEntries.length,
        trend: trend,
        trendDisplay: trendDisplay
      };
    }

    getSuperTag() {
      // Get recent 30-day usage for all tags
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      
      const recentEntries = this.all.filter(s => s.date >= thirtyDaysAgo);
      const recentTagData = {};
      
      // Collect recent tag usage with scores
      recentEntries.forEach(score => {
        const allTags = score.notes.match(/[#@]\p{L}[\p{L}\d]*/gu) || [];
        allTags.forEach(tag => {
          const cleanTag = tag.slice(1).toLowerCase();
          if (!recentTagData[cleanTag]) {
            recentTagData[cleanTag] = {
              scores: [],
              count: 0,
              isPersonTag: tag.startsWith('@')
            };
          }
          recentTagData[cleanTag].scores.push(score.summary);
          recentTagData[cleanTag].count++;
        });
      });
      
      // Load tag cache for historical context
      let tagCache = {};
      try {
        tagCache = JSON.parse(localStorage.getItem('tagCache') || '{}');
      } catch (e) {
        console.warn('Could not load tag cache for super tag calculation');
      }
      
      // Calculate Super Tag score using weighted formula
      const superTagCandidates = [];
      Object.entries(recentTagData).forEach(([tag, data]) => {
        // Must have at least 2 recent uses to be considered
        if (data.count < 2) return;
        
        const avgScore = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
        const recentCount = data.count;
        
        // Get historical context from cache
        const cacheData = tagCache[tag] || {};
        const totalHistoricalUses = cacheData.totalUses || recentCount;
        
        /**
         * SUPER TAG WEIGHTED FORMULA:
         * 
         * superScore = (avgScore * sqrt(recentCount)) / frequencyBias
         * 
         * Where:
         * - avgScore: Average score of entries with this tag (quality component)
         * - sqrt(recentCount): Diminishing returns on usage (prevents spam, rewards meaningful use)
         * - frequencyBias: Normalizes against over/under-used tags
         * 
         * frequencyBias = 1 + (totalUses / expectedUses)^0.5
         * - expectedUses = estimated reasonable usage over time
         * - This prevents both single-use bias AND overused tag bias
         */
        
        const expectedUses = Math.max(5, Math.min(30, totalHistoricalUses * 0.3)); // Reasonable range
        const frequencyBias = 1 + Math.pow(totalHistoricalUses / expectedUses, 0.5);
        const usageWeight = Math.sqrt(recentCount);
        const superScore = (avgScore * usageWeight) / frequencyBias;
        
        superTagCandidates.push({
          tag: tag,
          superScore: Math.round(superScore * 100) / 100,
          avgScore: Math.round(avgScore * 10) / 10,
          recentCount: recentCount,
          totalUses: totalHistoricalUses,
          frequencyBias: Math.round(frequencyBias * 100) / 100,
          isPersonTag: data.isPersonTag
        });
      });
      
      // Sort by super score (highest first)
      superTagCandidates.sort((a, b) => b.superScore - a.superScore);
      
      return superTagCandidates.length > 0 ? superTagCandidates[0] : null;
    }

    getSeasonProgress() {
      const now = new Date();
      const year = now.getFullYear();
      
      // Define season boundaries (Northern Hemisphere)
      const seasons = {
        'Spring': { start: new Date(year, 2, 20), end: new Date(year, 5, 20) }, // Mar 20 - Jun 20
        'Summer': { start: new Date(year, 5, 21), end: new Date(year, 8, 22) }, // Jun 21 - Sep 22
        'Fall': { start: new Date(year, 8, 23), end: new Date(year, 11, 20) },   // Sep 23 - Dec 20
        'Winter': { start: new Date(year, 11, 21), end: new Date(year + 1, 2, 19) } // Dec 21 - Mar 19
      };
      
      // Determine current season
      let currentSeason = null;
      let seasonStart = null;
      let seasonEnd = null;
      
      for (const [season, dates] of Object.entries(seasons)) {
        if (season === 'Winter') {
          // Winter spans across years
          const winterStart = new Date(year - 1, 11, 21);
          const winterEnd = new Date(year, 2, 19);
          if (now >= winterStart || now <= winterEnd) {
            currentSeason = season;
            seasonStart = now.getMonth() < 3 ? winterStart : new Date(year, 11, 21);
            seasonEnd = now.getMonth() < 3 ? winterEnd : new Date(year + 1, 2, 19);
            break;
          }
        } else {
          if (now >= dates.start && now <= dates.end) {
            currentSeason = season;
            seasonStart = dates.start;
            seasonEnd = dates.end;
            break;
          }
        }
      }
      
      if (!currentSeason) {
        // Fallback logic
        const month = now.getMonth();
        if (month >= 2 && month <= 4) {
          currentSeason = 'Spring';
          seasonStart = new Date(year, 2, 20);
          seasonEnd = new Date(year, 5, 20);
        } else if (month >= 5 && month <= 7) {
          currentSeason = 'Summer';
          seasonStart = new Date(year, 5, 21);
          seasonEnd = new Date(year, 8, 22);
        } else if (month >= 8 && month <= 10) {
          currentSeason = 'Fall';
          seasonStart = new Date(year, 8, 23);
          seasonEnd = new Date(year, 11, 20);
        } else {
          currentSeason = 'Winter';
          seasonStart = new Date(year, 11, 21);
          seasonEnd = new Date(year + 1, 2, 19);
        }
      }
      
      // Calculate progress
      const totalDays = Math.ceil((seasonEnd - seasonStart) / (1000 * 60 * 60 * 24));
      const daysPassed = Math.ceil((now - seasonStart) / (1000 * 60 * 60 * 24));
      const percentage = Math.round((daysPassed / totalDays) * 100);
      
      // Season emojis
      const seasonEmojis = {
        'Spring': '🌸',
        'Summer': '☀️', 
        'Fall': '🍂',
        'Winter': '❄️'
      };
      
      return {
        season: currentSeason,
        emoji: seasonEmojis[currentSeason] || '📅',
        percentage: Math.min(100, Math.max(0, percentage)),
        daysPassed: Math.max(0, daysPassed),
        totalDays: totalDays,
        seasonStart: seasonStart.toDateString(),
        seasonEnd: seasonEnd.toDateString()
      };
    }

    async showJourneyAnalytics() {
      // Get config for birthdate
      const config = await window.api.getConfig();
      
      // Calculate all widget data
      const calendarProgress = this.getCalendarYearProgress();
      const lifeProgress = config.birthdate ? this.getLifeYearProgress(config.birthdate) : null;
      const coverage = this.getCoverageProgress();
      const thirtyDayStats = this.getThirtyDayComparisons();
      
      // New analytics widgets  
      const personMentions = this.getPersonMentionsRatio();
      const lazySundays = this.getLazySundays();
      const lazySaturdays = this.getLazySaturdays();
      const totalOverview = this.getTotalOverview();
      const fiveScoreDays = this.getFiveScoreDaysCount();
      const avgDurationHighScores = this.getAverageDurationBetweenHighScores();
      
      // Latest widget additions
      const lazyWorkweeks = this.getLazyWorkweeks();
      const trendingTopics = this.getTrendingTopics(); 
      const trendingPeople = this.getTrendingPeople();
      const consistency = this.getScoreConsistency();
      const superTag = this.getSuperTag();
      const seasonProgress = this.getSeasonProgress();
      
      this.pushHistory('/analytics', 'Analytics');
      
      return this.render('#tmpl-journey-analytics', '#content', {
        years: this.years.map(y => ({year: y})),
        calendarProgress: calendarProgress,
        lifeProgress: lifeProgress,
        coverage: coverage,
        thirtyDayStats: thirtyDayStats,
        personMentions: personMentions,
        lazySundays: lazySundays,
        lazySaturdays: lazySaturdays,
        totalOverview: totalOverview,
        fiveScoreDays: fiveScoreDays,
        avgDurationHighScores: avgDurationHighScores,
        // New widgets
        lazyWorkweeks: lazyWorkweeks,
        trendingTopics: trendingTopics,
        trendingPeople: trendingPeople,
        consistency: consistency,
        superTag: superTag,
        seasonProgress: seasonProgress
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    async showSettings() {
      const config = await window.api.getConfig();
      
      this.pushHistory('/settings', 'Settings');
      
      return this.render('#tmpl-settings', '#content', {
        birthdate: config.birthdate || '',
        currentFolder: config.filesPath || 'Not set',
        years: this.years.map(y => ({year: y}))
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    async saveBirthdate() {
      const birthdateInput = document.getElementById('birthdate-input');
      const birthdate = birthdateInput.value;
      
      if (birthdate) {
        await window.api.setBirthdate(birthdate);
        // Refresh dashboard to show new progress
        this.showDashboard();
      }
    }

    runDiagnostics() {
      const results = [];
      const dateMap = new Map();
      
      // Check for duplicate dates
      this.all.forEach(entry => {
        const dateId = entry.dateId();
        if (dateMap.has(dateId)) {
          dateMap.get(dateId).push(entry);
        } else {
          dateMap.set(dateId, [entry]);
        }
      });
      
      // Find duplicates
      const duplicates = [];
      dateMap.forEach((entries, dateId) => {
        if (entries.length > 1) {
          duplicates.push({ dateId, count: entries.length, entries });
        }
      });
      
      // Check for missing scores
      const missingScores = this.all.filter(entry => 
        entry.summary === null || entry.summary === undefined
      );
      
      // Check for invalid dates
      const invalidDates = this.all.filter(entry => {
        const date = entry.date;
        return isNaN(date.getTime()) || 
               date.getFullYear() < 1900 || 
               date.getFullYear() > 2100;
      });
      
      // Check for entries with no notes
      const emptyNotes = this.all.filter(entry => 
        !entry.notes || entry.notes.trim() === ''
      );
      
      // Generate report
      let html = '<div style="font-family: monospace; font-size: 12px; line-height: 1.4;">';
      
      if (duplicates.length > 0) {
        html += '<div style="color: #ff6b6b; margin-bottom: 15px;"><strong>🔴 Duplicate Dates:</strong></div>';
        duplicates.forEach(dup => {
          html += `<div style="margin-left: 20px; margin-bottom: 5px;">`;
          html += `<strong>${dup.dateId}</strong> - ${dup.count} entries<br>`;
          dup.entries.forEach((entry, idx) => {
            html += `<span style="margin-left: 20px;">Entry ${idx + 1}: Score ${entry.summary || 'null'}, Notes: "${entry.notes.substring(0, 50)}..."</span><br>`;
          });
          html += '</div>';
        });
      }
      
      if (missingScores.length > 0) {
        html += '<div style="color: #ffa500; margin-bottom: 15px;"><strong>🟡 Missing Scores:</strong></div>';
        missingScores.forEach(entry => {
          html += `<div style="margin-left: 20px;">${entry.dateId()} - Score: ${entry.summary}</div>`;
        });
      }
      
      if (invalidDates.length > 0) {
        html += '<div style="color: #ff6b6b; margin-bottom: 15px;"><strong>🔴 Invalid Dates:</strong></div>';
        invalidDates.forEach(entry => {
          html += `<div style="margin-left: 20px;">Date: ${entry.date}, Score: ${entry.summary}</div>`;
        });
      }
      
      if (emptyNotes.length > 0) {
        html += '<div style="color: #87ceeb; margin-bottom: 15px;"><strong>🔵 Empty Notes:</strong></div>';
        emptyNotes.forEach(entry => {
          html += `<div style="margin-left: 20px;">${entry.dateId()} - Score: ${entry.summary}</div>`;
        });
      }
      
      if (duplicates.length === 0 && missingScores.length === 0 && invalidDates.length === 0 && emptyNotes.length === 0) {
        html += '<div style="color: #90ee90;"><strong>✅ All Good!</strong><br>No data integrity issues found.</div>';
      }
      
      html += '</div>';
      
      // Show results
      document.getElementById('diagnostics-results').style.display = 'block';
      document.getElementById('diagnostics-content').innerHTML = html;
    }

    getTextNodesWithoutTagSuggestions(element) {
      const textNodes = [];
      
      function collectTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Skip tag suggestion elements to preserve their functionality
          if (node.classList && node.classList.contains('tag-suggestion')) {
            return;
          }
          
          // Recursively collect text nodes from child elements
          for (let child of node.childNodes) {
            collectTextNodes(child);
          }
        }
      }
      
      collectTextNodes(element);
      return textNodes;
    }

    showTagSuggestion(element) {
      const popup = document.getElementById('tag-suggestion-popup');
      const optionsContainer = document.getElementById('suggestion-options');
      
      if (!popup || !optionsContainer) {
        console.error('Missing popup elements:', {popup, optionsContainer});
        return;
      }
      
      const originalText = element.getAttribute('data-original-text');
      const suggestedTag = element.getAttribute('data-suggested-tag');
      const firstName = element.getAttribute('data-first-name');
      const isPersonSuggestion = element.classList.contains('person');
      
      // Clear previous options
      optionsContainer.innerHTML = '';
      
      if (isPersonSuggestion) {
        // For person suggestions, show multiple options for the same first name if available
        if (firstName) {
          const personTags = Object.keys(this.tagCache).filter(tag => 
            this.tagCache[tag].isPerson && 
            (this.tagCache[tag].originalName || tag).toLowerCase().startsWith(firstName.toLowerCase())
          );
          
          personTags.forEach(personTag => {
            const fullName = this.tagCache[personTag].originalName || personTag;
            const button = document.createElement('button');
            button.className = 'suggestion-button person';
            button.innerHTML = `
              <span class="button-icon">👤</span>
              <span class="button-text">Convert to @${fullName}</span>
            `;
            button.onclick = () => {
              this.convertToTag(originalText, `@${fullName}`, element);
              this.hideTagSuggestion();
            };
            optionsContainer.appendChild(button);
          });
        } else {
          // Just show the single suggested person tag
          const button = document.createElement('button');
          button.className = 'suggestion-button person';
          button.innerHTML = `
            <span class="button-icon">👤</span>
            <span class="button-text">Convert to ${suggestedTag}</span>
          `;
          button.onclick = () => {
            this.convertToTag(originalText, suggestedTag, element);
            this.hideTagSuggestion();
          };
          optionsContainer.appendChild(button);
        }
      } else {
        // For topic suggestions, show single option
        const button = document.createElement('button');
        button.className = 'suggestion-button topic';
        button.innerHTML = `
          <span class="button-icon">🏷️</span>
          <span class="button-text">Convert to ${suggestedTag}</span>
        `;
        button.onclick = () => {
          this.convertToTag(originalText, suggestedTag, element);
          this.hideTagSuggestion();
        };
        optionsContainer.appendChild(button);
      }
      
      // Position popup near the element
      const rect = element.getBoundingClientRect();
      popup.style.position = 'fixed';
      popup.style.left = rect.left + 'px';
      popup.style.top = (rect.bottom + 5) + 'px';
      popup.classList.add('visible');
      
      // Hide popup when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.hideTagSuggestionOnClickOutside.bind(this));
      }, 100);
    }

    hideTagSuggestion() {
      const popup = document.getElementById('tag-suggestion-popup');
      popup.classList.remove('visible');
      document.removeEventListener('click', this.hideTagSuggestionOnClickOutside.bind(this));
    }

    hideTagSuggestionOnClickOutside(event) {
      const popup = document.getElementById('tag-suggestion-popup');
      if (!popup.contains(event.target) && !event.target.classList.contains('tag-suggestion')) {
        this.hideTagSuggestion();
      }
    }

    async convertToTag(originalText, newTag, element) {
      const parentRow = element.closest('tr');
      const notesCell = parentRow?.querySelector('.notes');
      
      if (!notesCell) {
        console.error('No notes cell found for tag conversion');
        return;
      }
      
      // Find the score entry that contains this element
      const dateElement = parentRow.querySelector('.date a');
      let targetScore = null;
      
      if (dateElement) {
        const dateId = dateElement.getAttribute('data-date-id');
        
        if (dateId) {
          targetScore = this.all.find(score => score.dateId() === dateId);
        } else {
          // Fallback to text matching for older entries
          const dateText = dateElement.textContent.replace(/\s+/g, ' ').trim();
          targetScore = this.all.find(score => score.dateStr() === dateText);
        }
      }
      
      if (!targetScore) {
        console.error('No target score found for tag conversion');
        return;
      }
      
      // Update the score data - only replace first occurrence
      // Preserve original capitalization by extracting the marker and using original text
      const tagMarker = newTag.charAt(0); // '#' or '@'
      const preservedCapitalizationTag = `${tagMarker}${originalText}`;
      
      targetScore.notes = targetScore.notes.replace(
        new RegExp(`\\b${originalText}\\b`), 
        preservedCapitalizationTag
      );
      
      // Immediately update the visual display
      notesCell.innerHTML = targetScore.enhancedText(this.tagCache);
      
      // Save in background and refresh tag cache
      try {
        await this.saveScores();
        this.tagCache = await window.api.getTagCache();
        // Final update with fresh cache data
        notesCell.innerHTML = targetScore.enhancedText(this.tagCache);
        
        // Show toaster notification
        const formattedDate = this.formatDateWithOrdinal(targetScore.date);
        this.showToaster(`"${originalText}" converted to ${preservedCapitalizationTag} on ${formattedDate}.`);
      } catch (error) {
        console.error('Error saving converted tag:', error);
        this.showToaster(`Error converting tag: ${error.message}`, 'error');
      }
    }

    refreshCurrentView() {
      // Refresh the current view based on the current route
      const currentPath = window.location.pathname;
      if (currentPath.includes('month')) {
        const monthId = currentPath.split('/').pop();
        this.showMonth(monthId);
      } else if (currentPath.includes('year')) {
        const yearId = currentPath.split('/').pop();
        this.showYear(yearId);
      } else if (currentPath.includes('search')) {
        const searchTerm = currentPath.split('/').pop();
        this.showSearch(searchTerm);
      } else {
        this.showDashboard();
      }
    }

  }

  //@showPlot()

  // showPlot: () ->
  //   <% data_vals = plot_data_months @avg_months %>

  //   var plotData = [{
  //     data:[<%= data_vals.join(',') %>],
  //     <%= plot_style data_vals %>
  //   }];

  //   var plotOptions = {
  //     grid: {
  //       borderWidth: 0,
  //       markings: [<%= plot_markings_months @months %>]
  //     },
  //     xaxis: {ticks: [<%= plotXAxisMonths @months %>]},
  //     yaxis: {minTickSize: 0.5, tickDecimals: 1}
  //   };

  //   $.plot($("#plot"), plotData, plotOptions);
  
  window.onload = function() {
    return window.app = new FaveDayApp();
  };

  window.onConnect = function() {
    return window.app.setupDropbox();
  };

  window.onShowMonth = function(monthId) {
    let [year, month] = monthId.split('-');
    return window.app.showMonth(parseInt(year), parseInt(month));
  };

  window.onShowMonths = function(id) {
    return window.app.showMonths(id);
  };

  window.onShowYear = function(id) {
    return window.app.showYear(id);
  };
  
  window.onShowYears = function() {
    return window.app.showYears();
  };

  window.onShowTags = function() {
    return window.app.showTags();
  };

  window.onShowTagsWithSort = function(sortBy) {
    return window.app.showTags(sortBy);
  };

  window.onShowJourneyAnalytics = async function() {
    return await window.app.showJourneyAnalytics();
  };

  window.onShowDashboard = async function() {
    return await window.app.showDashboard();
  };

  window.onUpdateRandomInspiration = function() {
    return app.updateRandomInspiration();
  };

  window.onToggleScoreDialogue = function() {
    return window.app.toggleScoreDialogue();
  };

  window.onCancelScoreDialogue = function() {
    return window.app.cancelScoreDialogue();
  };
  
  window.onShowEditScore = function(dateId) {
    return window.app.showEditScore(dateId);
  }
  
  window.onSubmitScore = function() {
    return window.app.submitScore();
  }
  
  window.onSelectFolder = function () {
    window.api.selectFolder();
  }

  window.onSelectScoreVal = function (val) {
    return window.app.selectScoreVal(val)
  }

  window.onSelectDay = function (val) {
    return window.app.selectDay(val)
  }

  window.onShowSearch = function(id) {
    if (id != null) {
      $('#search input')[0].value = id;
    }
    return window.app.showSearch(id);
  };

  window.onToggleSearchType = function(checked) {
    window.app.tagsOnly = checked;
    return window.app.showSearch();
  };

  window.onShowSettings = async function() {
    return await window.app.showSettings();
  };

  window.onSaveBirthdate = async function() {
    return await window.app.saveBirthdate();
  };

  window.onRunDiagnostics = function() {
    window.app.runDiagnostics();
  };

  window.onShowTagSuggestion = function(element) {
    if (window.app && window.app.showTagSuggestion) {
      window.app.showTagSuggestion(element);
    } else {
      console.error('window.app or showTagSuggestion method not found!', {app: window.app});
    }
  };

  window.onConvertToTag = function(originalText, newTag, element) {
    window.app.convertToTag(originalText, newTag, element);
  };

  window.onJumpToScoreDate = function(dateId) {
    // Parse the dateId (format: "YYYY-MM-DD") to get year and month
    const dateParts = dateId.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    
    // Navigate to the month view for that date
    window.app.showMonth(year, month);
  };

  window.addEventListener("popstate", (event) => {
    window.poppingState = true;
    handleRoute();
    window.poppingState = false;
  });

  // Call onAppStart when the window 
  function onAppStart() {
    window.app = new FaveDayApp();

    document.getElementById('minimize-btn').addEventListener('click', () => {
      window.api.minimize();
    });

    document.getElementById('maximize-btn').addEventListener('click', () => {
      window.api.maximize();
    });

    document.getElementById('close-btn').addEventListener('click', () => {
      window.api.close();
    });

    document.getElementById('editScoreText').addEventListener('input', function() {
      window.app.updateScoreProgress(this.value.trim())
    });

    document.getElementById('editScoreText').addEventListener('keydown', function() {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault(); // Prevents default behavior (optional, depending on your needs)

        // Call your submit function or trigger a form submission here
        window.app.submitScore();
      }

      if (event.key === 'Escape') {
        window.app.hideEditScore();
      }
    });

    // Handle initial route on app startup
    handleRoute();
    
    // Initialize tag hover popups
    initializeTagPopups();
  }

  // Tag hover popup functionality
  function initializeTagPopups() {
    let popup = null;
    let hideTimeout = null;
    
    // Create popup element
    function createPopup() {
      if (popup && document.body.contains(popup)) return popup;
      
      popup = document.createElement('div');
      popup.className = 'tag-popup';
      document.body.appendChild(popup);
      return popup;
    }
    
    // Show popup for tag
    function showTagPopup(element, event) {
      // Only show popup if element has tag data
      if (!element.dataset || !element.dataset.tag || !element.dataset.uses) {
        return;
      }
      
      const tagData = {
        name: element.dataset.originalName || element.dataset.tag,
        uses: element.dataset.uses,
        avg: element.dataset.avg,
        peak: element.dataset.peak,
        peakCount: element.dataset.peakCount,
        isPerson: element.dataset.isPerson === 'true'
      };
      
      // Format name properly for person tags  
      const formatName = (name, isPerson) => {
        if (!isPerson) return name;
        
        // For person tags, use camelCase splitting on the original casing
        return name.replace(/([a-z])([A-Z])/g, '$1 $2')
                  .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
      };
      
      const popupEl = createPopup();
      const icon = tagData.isPerson ? '👤' : '🏷️';
      
      // Generate sparkline from year stats
      let sparklineHtml = '';
      try {
        const yearStatsData = element.dataset.yearStats || '{}';
        const yearStats = JSON.parse(yearStatsData);
        // Get full year range from app instance (available as window.app)
        const allYears = window.app && window.app.years ? window.app.years : [];
        
        
        if (allYears.length > 0) {
          const yearValues = Object.values(yearStats);
          const maxUses = yearValues.length > 0 ? Math.max(...yearValues) : 1;
          
          sparklineHtml = `
            <div class="sparkline-container">
              <span class="sparkline-label">Years:</span>
              <div class="sparkline">
                ${allYears.map(year => {
                  const uses = yearStats[year] || 0;
                  if (uses === 0) {
                    // Empty year - show as small dot
                    return `<div class="sparkline-dot" title="${year}: 0 uses"></div>`;
                  } else {
                    // Has usage - show as bar
                    const height = Math.max(3, Math.round((uses / maxUses) * 12));
                    return `<div class="sparkline-bar" style="height: ${height}px" title="${year}: ${uses} uses"></div>`;
                  }
                }).join('')}
              </div>
            </div>`;
        }
      } catch (e) {
        console.error('Sparkline error:', e);
        // Show debug info in sparkline
        sparklineHtml = `<div class="sparkline-container"><span style="color: #f00; font-size: 9px;">Debug: ${e.message}</span></div>`;
      }

      popupEl.innerHTML = `
        <div class="popup-header">
          <span class="tag-icon">${icon}</span>
          <span>${formatName(tagData.name, tagData.isPerson)}</span>
        </div>
        <div class="popup-stats">
          <div class="stat-item">
            <span class="stat-label">Uses:</span>
            <span class="stat-value">${tagData.uses}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Score:</span>
            <span class="stat-value">${tagData.avg}</span>
          </div>
        </div>
        ${sparklineHtml}
        <div class="peak-year ${tagData.isPerson ? 'person' : ''}">
          Peak: ${tagData.peak} (${tagData.peakCount} uses)
        </div>
      `;
      
      // Position popup
      const rect = element.getBoundingClientRect();
      popupEl.style.left = `${rect.left + window.scrollX}px`;
      popupEl.style.top = `${rect.bottom + window.scrollY + 5}px`;
      
      // Clear hide timeout and show popup
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      popupEl.classList.add('visible');
    }
    
    // Show chart popup for year bars/dots
    function showChartPopup(element, event) {
      const year = element.dataset.year;
      const count = parseInt(element.dataset.count);
      const avgScore = parseFloat(element.dataset.avgScore);
      const percentage = parseInt(element.dataset.percentage);
      
      const popupEl = createPopup();
      const icon = count > 0 ? '📊' : '📍';
      
      let statsContent = '';
      if (count > 0) {
        statsContent = `
          <div class="stat-item">
            <span class="stat-label">Results:</span>
            <span class="stat-value">${count} (${percentage}%)</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Score:</span>
            <span class="stat-value">${avgScore.toFixed(1)}</span>
          </div>
          <div class="chart-click-hint">Click to jump to ${year}</div>
        `;
      } else {
        statsContent = '<div class="chart-empty-note">No matches found this year</div>';
      }
      
      popupEl.innerHTML = `
        <div class="popup-header">
          <span class="tag-icon">${icon}</span>
          <span>${year}</span>
        </div>
        <div class="popup-stats">
          ${statsContent}
        </div>
      `;
      
      // Position popup below the chart element and near mouse
      const rect = element.getBoundingClientRect();
      
      // Get the chart container to position below the entire chart
      const chartContainer = element.closest('.years-chart-container');
      const containerRect = chartContainer ? chartContainer.getBoundingClientRect() : rect;
      
      // Position below the chart container, centered on the clicked element
      popupEl.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 70}px`;
      popupEl.style.top = `${containerRect.bottom + window.scrollY + 10}px`;
      
      // Clear hide timeout and show popup
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      popupEl.classList.add('visible');
    }
    
    // Hide popup
    function hideTagPopup() {
      if (popup && popup.classList) {
        popup.classList.remove('visible');
      }
    }
    
    // Event delegation for dynamic content
    document.addEventListener('mouseenter', (event) => {
      try {
        const element = event.target;
        if (element && element.classList && 
            (element.classList.contains('tag') || element.classList.contains('person')) && 
            element.dataset && element.dataset.tag) {
          showTagPopup(element, event);
        } else if (element && element.dataset && element.dataset.chartPopup) {
          showChartPopup(element, event);
        }
      } catch (e) {
        console.error('Popup mouseenter error:', e);
      }
    }, true);
    
    document.addEventListener('mouseleave', (event) => {
      try {
        const element = event.target;
        if (element && element.classList && 
            (element.classList.contains('tag') || element.classList.contains('person')) && 
            element.dataset && element.dataset.tag) {
          hideTimeout = setTimeout(hideTagPopup, 300);
        } else if (element && element.dataset && element.dataset.chartPopup) {
          hideTimeout = setTimeout(hideTagPopup, 300);
        }
      } catch (e) {
        console.error('Popup mouseleave error:', e);
      }
    }, true);
    
    // Keep popup visible when hovering over it
    document.addEventListener('mouseenter', (event) => {
      try {
        const element = event.target;
        if (element && element.classList && element.classList.contains('tag-popup')) {
          if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
          }
        }
      } catch (e) {
        console.error('Popup hover error:', e);
      }
    }, true);
    
    document.addEventListener('mouseleave', (event) => {
      try {
        const element = event.target;
        if (element && element.classList && element.classList.contains('tag-popup')) {
          hideTimeout = setTimeout(hideTagPopup, 100);
        }
      } catch (e) {
        console.error('Popup leave error:', e);
      }
    }, true);
    
    // Handle clicks on chart elements
    document.addEventListener('click', (event) => {
      try {
        const element = event.target;
        
        // Check if clicking on a chart element
        if (element && element.dataset && element.dataset.chartPopup) {
          const year = element.dataset.year;
          const yearSection = document.getElementById(`year-${year}`);
          
          if (yearSection) {
            // Smooth scroll to the year section
            yearSection.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
            
            // Brief highlight animation
            yearSection.style.transition = 'background-color 0.3s ease';
            yearSection.style.backgroundColor = 'rgba(66, 153, 225, 0.1)';
            setTimeout(() => {
              yearSection.style.backgroundColor = '';
            }, 800);
          }
          return;
        }
        
        // Hide popup when clicking elsewhere
        if (popup && popup.contains && event.target && !popup.contains(event.target)) {
          hideTagPopup();
        }
      } catch (e) {
        console.error('Chart click error:', e);
      }
    });
  }
  
  function handleRoute() {
    try {
      // Ensure app is loaded before routing
      if (!window.app) {
        return;
      }
      
      // Handle Electron file:// URLs which include drive letters
      let pathname = document.location.pathname;
      // Remove the drive letter part if present (e.g., "C:/year/2014" -> "/year/2014")
      if (pathname.match(/^\/[A-Z]:\//)) {
        pathname = pathname.substring(3); // Remove "/C:" part
      }
      let path = pathname.slice(1).split('/');

      switch (path[0]) {
        case 'year':
          window.app.showYear(Number(path[1]));
          break;
        case 'years':
          window.app.showYears();
          break;
        case 'search':
          // Use wrapper function to maintain search input synchronization
          window.onShowSearch(path[1]);
          break;
        case 'month':
          window.app.showMonth(path[1], path[2]);
          break;
        case 'months':
          window.app.showMonths(path[1]);
          break;
        case 'tags':
          window.app.showTags();
          break;
        case 'analytics':
          window.onShowJourneyAnalytics();
          break;
        case 'settings':
          // Use wrapper function to handle async properly
          window.onShowSettings();
          break;
        default:
          window.app.showDashboard();
      }
    } catch (error) {
      console.error('Route handling error:', error);
      // Fallback to dashboard if routing fails
      if (window.app) {
        window.app.showDashboard();
      }
    }
  }

