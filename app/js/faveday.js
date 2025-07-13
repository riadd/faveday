
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
          return `<a class="person" onclick="onShowSearch('${word}')" title="${this.camelCaseToSpace(word)}">${firstWord}</a>`;
        }
      });
      
      // replace new-lines
      return text.replace(/\n/g, "<br>");
    }

    enhancedText(tagCache) {
      // Enhanced version with tag cache data
      let re = /([#@])\p{L}[\p{L}\d]*/gui;
      let text = this.notes.replace(re, str => {
        let marker = str[0];
        let word = str.slice(1);
        let tagKey = word.toLowerCase();
        
        // Get tag stats from cache if available
        let tagStats = tagCache?.[tagKey];
        let isRecent = tagStats?.recentActivity || false;
        let isPerson = tagStats?.isPerson || marker === '@';
        
        let classes = isPerson ? 'person' : 'tag';
        if (isRecent) classes += ' recent';
        
        let dataAttrs = '';
        if (tagStats) {
          dataAttrs = `data-tag="${tagKey}" data-uses="${tagStats.totalUses}" data-avg="${tagStats.avgScore.toFixed(1)}" data-peak="${tagStats.peakYear}" data-peak-count="${tagStats.peakYearCount}" data-is-person="${isPerson}"`;
        }

        if (marker === '#') {
          return `<a class="${classes}" ${dataAttrs} onclick="onShowSearch('${word}')">${this.camelCaseToSpace(word)}</a>`;
        } else if (marker === '@') {
          let firstWord = word.split(/(?=[A-Z])/)[0];
          return `<a class="${classes}" ${dataAttrs} onclick="onShowSearch('${word}')" title="${this.camelCaseToSpace(word)}">${firstWord}</a>`;
        }
      });
      
      return text.replace(/\n/g, "<br>");
    }

    camelCaseToSpace(str) {
      // Ignore sequences of uppercase letters by ensuring a lowercase letter precedes the uppercase to be spaced
      return str.replace(/([a-z])([A-Z][a-z])/g, '$1 $2')
        // Handle the edge case where the string starts with lowercase followed by uppercase (e.g., "jMemorize")
        .replace(/^(.)([A-Z][a-z])/g, '$1 $2');
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
      
      $('#search input').keyup(() => {
        if (this.searchTime != null) {
          window.clearTimeout(this.searchTime);
        }
        return this.searchTime = window.setTimeout(this.showSearch, 500);
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
        let score = monthScores.find(s => 
          s.date.getFullYear() === yearNum &&
          s.date.getMonth() === monthNum-1 &&
          s.date.getDate() === dateNum);
        
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
    
    getTags(scores) {
      // Extract all tags from scores using the same regex as the notes
      const re = /([#@])\p{L}[\p{L}\d]*/gui;
      
      let tagCounter = {};
      let tagMarkers = {}; // Track which marker was used for each tag
      
      // Count all tag occurrences
      for (let score of scores) {
        let matches = score.notes.match(re);
        if (matches) {
          matches.forEach(match => {
            let marker = match[0];
            let tagName = match.slice(1).toLowerCase();
            tagCounter[tagName] = (tagCounter[tagName] || 0) + 1;
            
            // Track if this tag was ever used with @ (person marker)
            if (marker === '@') {
              tagMarkers[tagName] = true;
            }
          });
        }
      }

      // Build results array with proper styling and data attributes
      let results = [];
      for (let [tagName, count] of Object.entries(tagCounter)) {
        // Get cached stats for this tag
        const cachedStats = this.tagCache[tagName];
        
        // Determine if this is a person tag
        const isPerson = cachedStats?.isPerson || tagMarkers[tagName] || false;
        const isRecent = cachedStats?.recentActivity || false;
        
        // Build CSS classes for styling
        let cssClasses = 'enhanced-tag';
        if (isPerson) cssClasses += ' person';
        if (isRecent) cssClasses += ' recent';
        
        // Build data attributes for popup functionality
        let dataAttributes = '';
        if (cachedStats) {
          // Use cached statistics
          dataAttributes = `data-tag="${tagName}" data-uses="${cachedStats.totalUses}" data-avg="${cachedStats.avgScore.toFixed(1)}" data-peak="${cachedStats.peakYear}" data-peak-count="${cachedStats.peakYearCount}" data-is-person="${isPerson}"`;
        } else {
          // Fallback to basic count data
          dataAttributes = `data-tag="${tagName}" data-uses="${count}" data-avg="0" data-peak="unknown" data-peak-count="0" data-is-person="${isPerson}"`;
        }
        
        results.push({
          tag: tagName,
          count: count,
          weight: 1 + Math.log(count) / 5, // Weight for font sizing
          color: '', // Empty string so template doesn't add inline styles
          classes: cssClasses,
          dataAttrs: dataAttributes
        });
      }

      // Sort by count (most used first)
      results.sort((a, b) => b.count - a.count);
      
      return results;
    }
    
    showTags() {
      let tags = this.getTags(this.all).slice(0,250);
      
      this.pushHistory(`/tags`, 'Tags');

      return this.render('#tmpl-tags', '#content', {
        years: this.years.map(y => ({year: y})),
        tags: tags
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
      id = $('#search input')[0].value;
      
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
          } else if (needle.length > 2) {
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
      
      this.render('#tmpl-search', '#content', {
        count: foundScores.length,
        average: foundScores.average(s => s.summary).format(2),
        scores: this.tmplScores.render({scores: this.enhanceScoresForDisplay(foundScores)}),
        years: this.years.map(y => ({year: y})),
        hits: hits.filter(hit => hit.count > 0),
        streak: this.getMaxStreak(foundScores),
        tags: this.getTags(foundScores)
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
      
      let score = this.all.find(s => s.dateId() === dateId)
      
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
      if (!element.dataset || !element.dataset.tag) {
        console.log('No tag data found for element:', element);
        return;
      }
      
      if (!element.dataset.uses) {
        console.log('No uses data found for tag:', element.dataset.tag, element.dataset);
        return;
      }
      
      const tagData = {
        name: element.dataset.tag,
        uses: element.dataset.uses,
        avg: element.dataset.avg,
        peak: element.dataset.peak,
        peakCount: element.dataset.peakCount,
        isPerson: element.dataset.isPerson === 'true'
      };
      
      const popupEl = createPopup();
      const icon = tagData.isPerson ? '👤' : '🏷️';
      
      // Clean the data to remove quotes
      const cleanName = String(tagData.name).replace(/['"]/g, '');
      const cleanUses = String(tagData.uses).replace(/['"]/g, '');
      const cleanAvg = String(tagData.avg).replace(/['"]/g, '');
      const cleanPeak = String(tagData.peak).replace(/['"]/g, '');
      const cleanPeakCount = String(tagData.peakCount).replace(/['"]/g, '');
      
      popupEl.innerHTML = `
        <div class="popup-header">
          <span class="tag-icon">${icon}</span>
          <span>${cleanName}</span>
        </div>
        <div class="popup-stats">
          <div class="stat-item">
            <span class="stat-label">Uses:</span>
            <span class="stat-value">${cleanUses}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Score:</span>
            <span class="stat-value">${cleanAvg}</span>
          </div>
        </div>
        <div class="peak-year ${tagData.isPerson ? 'person' : ''}">
          Peak: ${cleanPeak} (${cleanPeakCount} uses)
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
        }
      } catch (e) {
        console.error('Tag popup mouseenter error:', e);
      }
    }, true);
    
    document.addEventListener('mouseleave', (event) => {
      try {
        const element = event.target;
        if (element && element.classList && 
            (element.classList.contains('tag') || element.classList.contains('person')) && 
            element.dataset && element.dataset.tag) {
          hideTimeout = setTimeout(hideTagPopup, 200);
        }
      } catch (e) {
        console.error('Tag popup mouseleave error:', e);
      }
    }, true);
    
    // Hide popup when clicking elsewhere
    document.addEventListener('click', (event) => {
      try {
        if (popup && popup.contains && event.target && !popup.contains(event.target)) {
          hideTagPopup();
        }
      } catch (e) {
        console.error('Tag popup click error:', e);
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

