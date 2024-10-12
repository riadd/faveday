
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
          return `<a onclick="onShowSearch('${word}')">${this.camelCaseToSpace(word)}</a>`;
          
        } else if (marker === '@') {
          // For mentions, only keep the first word
          let firstWord = word.split(/(?=[A-Z])/)[0]; // Splits at uppercase letter boundaries
          return `<a onclick="onShowSearch('${word}')" title="${this.camelCaseToSpace(word)}">${firstWord}</a>`;
        }
      });
      
      // replace new-lines
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

    showDashboard() {
      $('#search input')[0].value = "";
      let recent = this.all.slice(0, 3);
      
      let bestScores = this.all.filter(function(s) {
        return s.summary === 5;
      }).sample();
      
      let today = Date.create();
      let toDay = today.getDay();
      let toWeek = today.getISOWeek();
      
      let todayScores = this.all.filter(s =>
        s.date.getDay() === toDay && s.date.getISOWeek() === toWeek
      );
      
      let diff = null;
      let prevMonthScores = this.getScores(today.getFullYear(), today.getMonth()) // month-1
      if (prevMonthScores.length > 0)
      {
        let curMonthScores = this.getScores(today.getFullYear(), today.getMonth()+1) // month
        
        let prevAvg = prevMonthScores.average(s => s.summary)
        let curAvg = curMonthScores.average(s => s.summary)
        diff = this.fmtDiff(curAvg - prevAvg)
      }

      this.pushHistory('/', '');
      
      return this.render('#tmpl-dashboard', '#content', {
        recentScores: this.tmplScores.render({scores: recent}),
        bestScores: this.tmplScores.render({scores: bestScores}),
        hasTodayScores: todayScores.length > 0,
        todayScores: this.tmplScores.render({scores: todayScores}),
        years: this.years.map(y => ({year: y})),
        streak: this.getMaxStreak(this.all, true),
        diff: diff,
        footer: `Total Scores: ${this.all.length}`
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    hasMonth(date) {
      const isMonthFound = this.all.some(s =>
        s.date.getMonth() === date.getMonth() && s.date.getFullYear() === date.getFullYear()
      );

      return isMonthFound ? date.format("{yyyy}-{MM}") : null;
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
      
      this.render('#tmpl-month', '#content', {
        title: title,
        scores: virtualMonthScores.isEmpty() ? [] : this.tmplScores.render({scores: virtualMonthScores}),
        years: this.years.map(y => ({year: y})),
        tags: this.getTags(monthScores),
        
        prevYear: this.hasMonth(prevYearDate),
        prevMonth: this.hasMonth(prevMonthDate),
        nextMonth: this.hasMonth(nextMonthDate),
        nextYear: this.hasMonth(nextYearDate),
        
        average: monthScores.average(s => s.summary).format(2),
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
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
        scores: randomScores.isEmpty() ? [] : this.tmplScores.render({scores: randomScores}),
        inspiration: bestScores.isEmpty() ? [] : this.tmplScores.render({scores: bestScores}),
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
      });
    }

    updateRandomInspiration() {
      const bestScores = this.all.filter(s => s.summary === 5).sample();
      return $('#bestScores').html(this.tmplScores.render({ scores: bestScores }));
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

        return inspiration.isEmpty() ? null : this.tmplScores.render({ scores: inspiration });
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

      this.pushHistory('/years', 'Years');
      
      return this.render('#tmpl-years', '#content', {
        scores: allYears.reverse(),
        inspiration: inspiration.filter(i => i.insp != null).reverse(),
        years: this.years.map(y => ({year: y})),
        bestDays: bestDays.map(s => s.format(2)),
        bestMonths: bestMonths.map(s => s.format(2)),
        streak: this.getMaxStreak(this.all)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    pushHistory(url, title) {
      document.title = (title.length > 0) ? `Faveday - ${title}` : 'Faveday';
      if (!window.poppingState) 
        history.pushState({}, '', url);
    }
    
    getTags(scores) {
      function stringToPastelColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        const pastel = (hash & 0x00FFFFFF)
          .toString(16)
          .toUpperCase();

        const hex = "#" + ("000000" + pastel).slice(-6);
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);

        // Convert to pastel by increasing the luminance
        const pastelR = Math.round((r + 255) / 2);
        const pastelG = Math.round((g + 255) / 2);
        const pastelB = Math.round((b + 255) / 2);

        return `#${pastelR.toString(16).padStart(2, '0')}${pastelG.toString(16).padStart(2, '0')}${pastelB.toString(16).padStart(2, '0')}`;
      }

      const re = /[#@]\p{L}+/gui;
      
      let tagCounter = {};
      for (let score of scores)
      {
        let newTags = score.notes.match(re);
        if (newTags != null)
          newTags.forEach(word => {
            let tag = word.slice(1).toLowerCase();
            tagCounter[tag] = (tagCounter[tag] || 0) + 1;
          });
      }

      let results = [];
      for (let [tag,count] of Object.entries(tagCounter)) {
        if (count <= 1) continue;

        results.push({
          tag: tag,
          count: count,
          weight: 1, // + Math.log(count)/5,
          color: `rgba(0,60,177,${Math.log(count) / 5})` // // stringToPastelColor(tag)
        });
      }

      results = results.sortBy(a => a.count, true);
      
      return results;
    }
    
    showTags() {
      let tags = this.getTags(this.all);
      
      this.pushHistory(`/tags`, 'Tags');

      return this.render('#tmpl-tags', '#content', {
        years: this.years.map(y => ({year: y})),
        tags: tags
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    showYear(yearNum) {
      let id = parseInt(yearNum);
      let oneYear = this.getScores(id)
      let byMonth = oneYear.groupBy(s => s.date.getMonth());
      
      const monthNums = Array.from({ length: 12 }, (_, index) => index); // 0..11
      const dayNums = Array.from({ length: 31 }, (_, index) => index + 1); // 1..31
      
      let months = monthNums.map(month => {
        let scores = byMonth[month] ?? [];
        let date = Date.create(`${id}-${parseInt(month) + 1}`);
        
        return {
          date: date.format('{Mon} {yyyy}'),
          avg: scores.average(s => s.summary).format(2),
          link: `/month/${yearNum}/${parseInt(month) + 1}`,
          monthId: date.format('{yyyy}-{MM}'),
          monthsId: date.format('{MM}'),
          days: dayNums.map(d => {
            return {
              val: scores.find(s => s.date.getDate() === d)?.summary ?? 0,
              weekday: Date.create(`${id}-${parseInt(month) + 1}-${d}`).getDay()
            }
          }),
        }
      });
      
      months.reverse();
      let randomScores = oneYear.filter(s => s.summary >=3).sample(5);
      let bestScores = oneYear.filter(s => s.summary === 5).sample(1).sortBy(s => s.date, true);

      this.pushHistory(`/year/${id}`, id);
      
      return this.render('#tmpl-year', '#content', {
        year: id,
        average: oneYear.average(s => s.summary).format(2),
        scores: randomScores.isEmpty() ? [] : this.tmplScores.render({scores: randomScores}),
        inspiration: bestScores.isEmpty() ? [] : this.tmplScores.render({scores: bestScores}),
        months: months,
        years: this.years.map(y => ({year: y})),
        streak: this.getMaxStreak(oneYear)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
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
        
        // score criteria
        let ref1, ref2;
        if (((ref1 = needle[0]) === '>' || ref1 === '<' || ref1 === '=') && needle.length === 2) {
          let score = parseInt(needle[1]);
          
          let range = needle[0] === '>' ? (function() {
            let results = [];
            for (let k = score; score <= 5 ? k <= 5 : k >= 5; score <= 5 ? k++ : k--){ results.push(k); }
            return results;
          }).apply(this) : needle[0] === '<' ? (function() {
            let results = [];
            for (let k = 0; 0 <= score ? k <= score : k >= score; 0 <= score ? k++ : k--){ results.push(k); }
            return results;
          }).apply(this) : [score];
          
          foundScores = foundScores.filter(s => s.summary, indexOf.call(range, ref2) >= 0);
          
        } else if (needle.last() === '.' && parseInt(needle)) {
          let needleDate = parseInt(needle);
          foundScores = foundScores.filter(s => s.date.getDate() === needleDate);
          
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
        scores: this.tmplScores.render({scores: foundScores}),
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
        dateId = new Date().format("{yyyy}-{MM}-{dd}");
        
      
      if ($('#editScore').is(':visible')) {
        this.hideEditScore();
        return;
      }
      
      $('#editScore').show();
      $('#content').hide();
      
      let score = this.all.find(s => s.dateId() === dateId)
      
      if (score == null)
        score = new Score(new Date(), 3, '')

      this.updateScoreProgress(score.notes)
      $('#editScore .date').text(dateId);
      this.selectScoreVal(score.summary);
      
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

    submitScore() {
      let dateId = $('#editScore .date').text()

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

  window.onShowDashboard = function() {
    return window.app.showDashboard();
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
  
  window.onShowSearch = function(id) {
    if (id != null) {
      $('#search input')[0].value = id;
    }
    return window.app.showSearch(id);
  };

  window.addEventListener("popstate", (event) => {
    if (event.state) {
      window.poppingState = true;
      handleRoute();
      window.poppingState = false;
    }
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
  }
  
  function handleRoute() {
    let path = document.location.pathname.slice(1).split('/');

    switch (path[0]) {
      case 'year':
        window.app.showYear(Number(path[1]));
        break;
      case 'years':
        window.app.showYears();
        break;
      case 'search':
        window.onShowSearch(path[1]); // why two functions for this
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
      default:
        window.app.showDashboard();
    }
  }

