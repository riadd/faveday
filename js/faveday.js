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
  
    weekday() {
      return this.date.format("{Weekday}");
    }
  
    text() {
      let re = /#\w+/gi;
      return this.notes.replace(re, str => {
        let word = str.slice(1);
        return `<a onclick="onShowSearch('${word}')">${word}</a>`;
      });
    }
  
    styleClass() {
      if (this.summary == null) {
        return 'val0';
      }
      return 'val' + this.summary;
    }
}

  FaveDayApp = class FaveDayApp {  
    constructor() {
      this.showSearch = this.showSearch.bind(this);
      this.tmplScores = Hogan.compile($('#tmpl-scores').html());
      
      $('#search input').keyup(() => {
        if (this.searchTime != null) {
          window.clearTimeout(this.searchTime);
        }
        return this.searchTime = window.setTimeout(this.showSearch, 500);
      });

      this.all = this.loadScoresFromFiles();
      this.all.sort((a, b) => b.date - a.date); // sort in descending order
      
      this.onScoreLoaded();
    }
    
    loadScoresFromFiles() {
      let files = [];
      for(let i = 2008; i <= 2024; i++) {
        files.push(`scores-${i}.txt`);
      }
      
      let lines= [];
      for (let file of files) {
        let txtFile = new XMLHttpRequest();

        txtFile.open("GET", `http://localhost:8080/scores/${file}`, false); // TODO: make async
        txtFile.send();
        
        if (txtFile.readyState === 4 && txtFile.status === 200) {
          let newLines = txtFile.responseText.split('\n')
          lines = lines.concat(newLines);
        }
      }
      
      let scores = []
      for (let line of lines) {
        let parts = line.split(',');
        
        let date = new Date(parts[0]);
        
        if (!isNaN(date.getTime())) {
          let score = Number(parts[1]);
          
          if (isNaN(score))
            score = 0;
          
          let desc = parts.slice(2).join(',');

          scores.push(new Score(date, score, desc));
        }
      }
      
      return scores;
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
      return this.onScoreLoaded();
    }

    onScoreLoaded() {
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

      let minYear = this.all.last().date.getFullYear();
      let maxYear = this.all.first().date.getFullYear();
      
      this.years = [];
      for (let year = minYear; year <= maxYear; year++) {
        this.years.push(year);
      }

      $('#topArea').show();
      $('#loading').hide();
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

    showDashboard() {
      $('#search input')[0].value = "";
      let recent = this.all.slice(0, 3);
      
      let bestScores = this.all.filter(function(s) {
        return s.summary === 5;
      }).sample();
      
      let today = Date.create();
      let toDate = today.getDate();
      let toMonth = today.getMonth();
      
      let todayScores = this.all.filter(s =>
        s.date.getDate() === toDate && s.date.getMonth() === toMonth
      );
      
      this.pushHistory('/', '');
      
      return this.render('#tmpl-dashboard', '#content', {
        recentScores: this.tmplScores.render({scores: recent}),
        bestScores: this.tmplScores.render({scores: bestScores}),
        todayScores: this.tmplScores.render({scores: todayScores}),
        years: this.years.map(y => ({year: y})),
        streak: this.getMaxStreak(this.all, true)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    hasMonth(date) {
      const isMonthFound = this.all.some(s =>
        s.date.getMonth() === date.getMonth() && s.date.getYear() === date.getYear()
      );

      return isMonthFound ? date.format("{yyyy}-{MM}") : null;
    }

    showMonth(id) {
      let date = Date.create(id);
      let title = date.format('{Month} {yyyy}');

      let monthScores = this.all.filter(s =>
        s.date.getMonth() === date.getMonth() && s.date.getYear() === date.getYear()
      );

      let prevYearDate = new Date(date).addYears(-1);
      let prevMonthDate = new Date(date).addMonths(-1);
      let nextMonthDate = new Date(date).addMonths(1);
      let nextYearDate = new Date(date).addYears(1);
      
      this.pushHistory(`/month/${id}`, title);
      
      return this.render('#tmpl-month', '#content', {
        title: title,
        scores: monthScores.isEmpty() ? [] : this.tmplScores.render({scores: monthScores}),
        years: this.years.map(y => ({year: y})),
        prevYear: this.hasMonth(prevYearDate),
        prevMonth: this.hasMonth(prevMonthDate),
        nextMonth: this.hasMonth(nextMonthDate),
        nextYear: this.hasMonth(nextYearDate)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
        monthBar: Hogan.compile($('#tmpl-month-bar').html())
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
      document.title = `Faveday - ${title}`;
      if (!window.poppingState) 
        history.pushState({}, '', url);
    }
    
    showTags() {
      const re = /#\w+/gi;
      
      let tags = new Set();
      for (let score of this.all)
      {
        let newTags = score.notes.match(re);
        if (newTags != null)
          newTags.forEach(tag => tags.add(tag.slice(1)));
      }

      let hits = {};
      for (let score of this.all) {
        for (let tag of tags) {
          if (score.notes.toLowerCase().indexOf(tag) > -1) {
            if (hits[tag] == null) hits[tag] = 0;
            hits[tag]++;
          }
        }
      }
      
      let results = [];
      for (let [tag,count] of Object.entries(hits))
        results.push({tag: tag, count: count});

      return this.render('#tmpl-tags', '#content', {
        years: this.years.map(y => ({year: y})),
        tags: results
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    showYear(id) {
      var bestScores, byMonth, randomScores, scores, oneYear;
      
      id = parseInt(id);
      oneYear = this.all.filter(s => s.date.getFullYear() === id);
      byMonth = oneYear.groupBy(s => s.date.getMonth());
      
      const monthNums = Array.from({ length: 12 }, (_, index) => index); // 0..11
      const dayNums = Array.from({ length: 31 }, (_, index) => index + 1); // 1..31
      
      let months = monthNums.map(month => {
        scores = byMonth[month] ?? [];

        return {
          date: Date.create(`${id}-${parseInt(month) + 1}`).format('{Mon} {yyyy}'),
          dateId: `${id}-${parseInt(month) + 1}-1`,
          avg: scores.average(s => s.summary).format(2),
          days: dayNums.map(d => scores.find(s => s.date.getDate() === d)?.summary ?? 0),
        }
      });
      
      months.reverse();
      randomScores = oneYear.filter(s => s.summary >=3).sample(5);
      bestScores = oneYear.filter(s => s.summary === 5).sample(1).sortBy(s => s.date, true);

      this.pushHistory(`/year/${id}`, id);
      
      return this.render('#tmpl-year', '#content', {
        year: id,
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
            foundScores = foundScores.filter(s => s.notes.toLowerCase().indexOf(needle) > -1);
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
        streak: this.getMaxStreak(foundScores) 
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

  window.onShowMonth = function(id) {
    return window.app.showMonth(id);
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

  // Call onAppStart when the window loads
  function onAppStart() {
    window.app = new FaveDayApp();
    handleRoute();
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
        window.app.showMonth(path[1]);
        break;
      default:
        window.app.showDashboard();
    }
  }

