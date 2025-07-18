
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

    camelCaseToSpace(str) {
      // Handle sequences like "CallOfTheCovenant" -> "Call Of The Covenant"
      return str.replace(/([a-z])([A-Z])/g, '$1 $2')
        // Handle sequences like "XMLHttpRequest" -> "XML Http Request"  
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
    }

    // Helper method to check if suggestion overlaps with existing tags
    checkOverlap(suggestionStart, suggestionEnd, existingTags) {
      return existingTags.some(tag => 
        (suggestionStart >= tag.start && suggestionStart < tag.end) ||
        (suggestionEnd > tag.start && suggestionEnd <= tag.end)
      );
    }

    // Helper method to create word matching regex
    createWordRegex(word) {
      return new RegExp(`\\b(${word})\\b(?![\\w@#])`, 'i');
    }

    // Extract person suggestions from raw text
    findPersonSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords = new Set()) {
      const suggestions = [];
      
      const personTags = Object.keys(tagCache).filter(tag => 
        tagCache[tag].isPerson && tagCache[tag].totalUses >= minUses
      );
      
      personTags.forEach(tagKey => {
        const tagData = tagCache[tagKey];
        const fullName = tagData.originalName || tagKey;
        const firstName = fullName.split(/(?=[A-Z])/)[0];
        
        if (firstName.length > minWordLength && !suggestedWords.has(firstName.toLowerCase())) {
          const nameMatch = this.createWordRegex(firstName).exec(rawText);
          
          if (nameMatch && !this.checkOverlap(nameMatch.index, nameMatch.index + nameMatch[0].length, existingTags)) {
            suggestions.push({
              text: nameMatch[0],
              start: nameMatch.index,
              end: nameMatch.index + nameMatch[0].length,
              suggestedTag: `@${fullName}`,
              firstName: firstName,
              type: 'person'
            });
            suggestedWords.add(firstName.toLowerCase());
          }
        }
      });
      
      return suggestions;
    }

    // Extract topic suggestions from raw text  
    findTopicSuggestions(rawText, existingTags, tagCache, minUses, minWordLength, suggestedWords = new Set()) {
      const suggestions = [];
      
      const topicTags = Object.keys(tagCache).filter(tag => 
        !tagCache[tag].isPerson && tagCache[tag].totalUses >= minUses
      );
      
      topicTags.forEach(tagKey => {
        const tagData = tagCache[tagKey];
        const fullName = tagData.originalName || tagKey;
        const searchWords = [];
        
        // Add the full tag name (lowercase)
        searchWords.push(fullName.toLowerCase());
        
        // Add camelCase parts if applicable
        if (/[A-Z]/.test(fullName)) {
          const parts = fullName.split(/(?=[A-Z])/).filter(part => part.length > minWordLength);
          searchWords.push(...parts.map(part => part.toLowerCase()));
        }
        
        // Try to match each search word
        for (const searchWord of searchWords) {
          if (searchWord.length > minWordLength && !suggestedWords.has(searchWord)) {
            const wordMatch = this.createWordRegex(searchWord).exec(rawText);
            
            if (wordMatch && !this.checkOverlap(wordMatch.index, wordMatch.index + wordMatch[0].length, existingTags)) {
              suggestions.push({
                text: wordMatch[0],
                start: wordMatch.index,
                end: wordMatch.index + wordMatch[0].length,
                suggestedTag: `#${fullName}`,
                type: 'topic'
              });
              suggestedWords.add(searchWord);
              break; // Only suggest once per tag
            }
          }
        }
      });
      
      return suggestions;
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
      this.tagCache = {};

      this.loadScores();
    }
    
    fmtDiff(val) {
      return (val > 0) ? `▲ ${val.format(2)}` : `▼ ${-val.format(2)}`;
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
        diff = this.fmtDiff(curAvg - prevAvg)
      }

      // Get config for birthdate
      const config = await window.api.getConfig();
      
      // Calculate progress data
      const calendarProgress = this.getCalendarYearProgress();
      const lifeProgress = config.birthdate ? this.getLifeYearProgress(config.birthdate) : null;
      const coverage = this.getCoverageProgress();
      const lastHighScore = this.getDaysSinceLastScore(5);
      const lastLowScore = this.getDaysSinceLastScore(1);
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
        lastHighScore: lastHighScore,
        lastLowScore: lastLowScore,
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
            const needleLower = needle.toLowerCase();
            const regex = new RegExp(`\\b${needleLower}`, 'i'); // 'i' makes it case-insensitive
            foundScores = foundScores.filter(s => regex.test(s.notes));
            
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
        tagGroups: foundScores.length > 0 ? this.getGroupedTags(foundScores) : null
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
      
      // this feels hacky
      let notesElem = $('.notes');
      for (let k = 0; k < notesElem.length; k++) {
        let elem = notesElem[k];

        for (let n = 0; n < keywords.length; n++) {
          let keyword = keywords[n];
          const regex = new RegExp(`(${keyword})`, 'ig');
          $(elem).html(elem.innerHTML.replace(regex, "<em>$1</em>"));
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
      
      this.hideEditScore();
      this.onScoreAdded();
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
      
      return {
        days: daysDiff,
        lastDate: latestScore.dateStr()
      };
    }

    getCoverageProgress() {
      const now = new Date();
      const threeSixtyFiveDaysAgo = new Date(now);
      threeSixtyFiveDaysAgo.setDate(now.getDate() - 365);
      
      // Get the earliest score date to determine actual range
      const firstScoreDate = this.all.length > 0 ? this.all[this.all.length - 1].date : now;
      const rangeStart = threeSixtyFiveDaysAgo > firstScoreDate ? threeSixtyFiveDaysAgo : firstScoreDate;
      
      const daysPassed = Math.floor((now - rangeStart) / (1000 * 60 * 60 * 24)) + 1;
      
      // Count entries in the last 365 days (or since first entry)
      const entriesInRange = this.all.filter(score => score.date >= rangeStart).length;
      
      return {
        entriesMade: entriesInRange,
        daysPassed: daysPassed,
        percentage: daysPassed > 0 ? Math.round((entriesInRange / daysPassed) * 100) : 0
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

      const formatTrend = (diff, trend) => {
        if (diff === 0) return '';
        const arrow = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
        const sign = diff > 0 ? '+' : '';
        return ` ${arrow} ${sign}${diff}`;
      };

      return {
        words: {
          current: currentAvgWords,
          previous: previousAvgWords,
          diff: wordsDiff,
          trend: wordsDiff > 0 ? 'up' : wordsDiff < 0 ? 'down' : 'same',
          trendDisplay: formatTrend(wordsDiff, wordsDiff > 0 ? 'up' : wordsDiff < 0 ? 'down' : 'same')
        },
        entries: {
          current: currentEntries,
          previous: previousEntries,
          diff: entriesDiff,
          trend: entriesDiff > 0 ? 'up' : entriesDiff < 0 ? 'down' : 'same',
          trendDisplay: formatTrend(entriesDiff, entriesDiff > 0 ? 'up' : entriesDiff < 0 ? 'down' : 'same')
        },
        score: {
          current: Math.round(currentAvgScore * 10) / 10,
          previous: Math.round(previousAvgScore * 10) / 10,
          diff: Math.round(scoreDiff * 10) / 10,
          trend: scoreDiff > 0 ? 'up' : scoreDiff < 0 ? 'down' : 'same',
          trendDisplay: formatTrend(Math.round(scoreDiff * 10) / 10, scoreDiff > 0 ? 'up' : scoreDiff < 0 ? 'down' : 'same'),
          trendEmoji: scoreDiff > 0 ? '📈' : scoreDiff < 0 ? '📉' : '➡️'
        },
        topTag: topTag ? { tag: topTag[0], count: topTag[1] } : null
      };
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

    showTagSuggestion(element) {
      const popup = document.getElementById('tag-suggestion-popup');
      const optionsContainer = document.getElementById('suggestion-options');
      
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
      
      // Update the score data
      targetScore.notes = targetScore.notes.replace(
        new RegExp(`\\b${originalText}\\b`, 'g'), 
        newTag
      );
      
      // Immediately update the visual display
      notesCell.innerHTML = targetScore.enhancedText(this.tagCache);
      
      // Save in background and refresh tag cache
      try {
        await this.saveScores();
        this.tagCache = await window.api.getTagCache();
        // Final update with fresh cache data
        notesCell.innerHTML = targetScore.enhancedText(this.tagCache);
      } catch (error) {
        console.error('Error saving converted tag:', error);
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

